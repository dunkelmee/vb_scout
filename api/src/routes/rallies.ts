import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { addPoint, Lineup } from '../lib/rotation'
import { loadSetState, getMatchRoster } from '../lib/setState'
import { applySub, liberoForcedExit } from '../lib/substitutionRules'

const router = Router({ mergeParams: true })

const WINNER_SUBTYPES = ['ace', 'kill', 'block']
const ERROR_SUBTYPES = ['serve', 'reception', 'attack', 'other']

/**
 * Validate the granular subtype against the pointType.
 * Required for our own terminal actions (us_positive / us_error); rejected for
 * opponent-side points (they stay unclassified). Returns the value to store or throws.
 */
function resolveSubtype(pointType: string, pointSubtype: unknown): string | null {
  if (pointType === 'us_positive') {
    if (typeof pointSubtype === 'string' && WINNER_SUBTYPES.includes(pointSubtype)) return pointSubtype
    throw new Error('pointSubtype must be one of ace|kill|block for us_positive')
  }
  if (pointType === 'us_error') {
    if (typeof pointSubtype === 'string' && ERROR_SUBTYPES.includes(pointSubtype)) return pointSubtype
    throw new Error('pointSubtype must be one of serve|reception|attack|other for us_error')
  }
  // them_positive / them_error — no subtype.
  return null
}

function isSetComplete(scoreUs: number, scoreThem: number, setNumber: number): boolean {
  const target = setNumber === 5 ? 15 : 25
  if (scoreUs >= target && scoreUs - scoreThem >= 2) return true
  if (scoreThem >= target && scoreThem - scoreUs >= 2) return true
  return false
}

// GET /api/sets/:setId/rallies — get all rallies
router.get('/', async (req: Request, res: Response) => {
  const { setId } = req.params
  try {
    // Verify team access
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: { match: { select: { teamId: true } } },
    })
    if (!set || set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const rallies = await prisma.rally.findMany({
      where: { setId },
      orderBy: { rallyIndex: 'asc' },
    })
    res.json(rallies)
  } catch {
    res.status(500).json({ error: 'Failed to fetch rallies' })
  }
})

// POST /api/sets/:setId/rallies — add rally (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { setId } = req.params
  const { scorer, pointType, pointSubtype } = req.body

  if (!scorer || !pointType) return res.status(400).json({ error: 'scorer and pointType are required' })

  let subtype: string | null
  try {
    subtype = resolveSubtype(pointType, pointSubtype)
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid pointSubtype' })
  }

  try {
    const state = await loadSetState(setId)
    if (!state) return res.status(404).json({ error: 'Set not found' })
    const { set, lastRally } = state
    if (set.match.teamId !== req.user!.teamId!) return res.status(403).json({ error: 'Access denied' })
    if (set.status === 'completed') return res.status(400).json({ error: 'Set is completed' })

    // Determine current state from last rally
    const currentScoreUs = lastRally ? lastRally.scoreUs : 0
    const currentScoreThem = lastRally ? lastRally.scoreThem : 0
    const rallyIndex = lastRally ? lastRally.rallyIndex + 1 : 0

    if (isSetComplete(currentScoreUs, currentScoreThem, set.setNumber)) {
      return res.status(400).json({ error: 'Set is already won' })
    }

    // Lineup on court = last rally's rotation + substitutions made since then
    const currentServer = state.servingTeam
    const currentLineup: Lineup = state.lineup

    // Compute new state
    const { newLineup, rotated, newServer } = addPoint({
      scorer: scorer as 'us' | 'them',
      currentServer,
      currentLineup,
    })

    const newScoreUs = currentScoreUs + (scorer === 'us' ? 1 : 0)
    const newScoreThem = currentScoreThem + (scorer === 'them' ? 1 : 0)

    // A libero who rotated into the front row must leave; the player they replaced returns.
    const { liberoIds } = await getMatchRoster(set.match.id, set.match.teamId)
    const forcedExit = rotated ? liberoForcedExit(newLineup, state.subs, liberoIds) : null
    const lineupAfter = forcedExit
      ? applySub(newLineup, forcedExit.playerOutId, forcedExit.playerInId)
      : newLineup

    const { rally, liberoExit } = await prisma.$transaction(async (tx) => {
      const rally = await tx.rally.create({
        data: {
          setId,
          rallyIndex,
          scorer,
          pointType,
          pointSubtype: subtype,
          scoreUs: newScoreUs,
          scoreThem: newScoreThem,
          servingTeam: currentServer,
          rotationAfter: lineupAfter as unknown as Record<string, string>,
          rotated,
          currentServer: newServer,
        },
      })

      const liberoExit = forcedExit
        ? await tx.substitution.create({
            data: {
              setId,
              rallyIndex,
              playerOutId: forcedExit.playerOutId,
              playerInId: forcedExit.playerInId,
              isLiberoSwap: true,
              atScoreUs: newScoreUs,
              atScoreThem: newScoreThem,
            },
          })
        : null

      // Update set score
      await tx.set.update({
        where: { id: setId },
        data: { scoreUs: newScoreUs, scoreThem: newScoreThem },
      })

      return { rally, liberoExit }
    })

    res.status(201).json({ ...rally, liberoExit })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add rally' })
  }
})

// DELETE /api/sets/:setId/rallies/last — undo last rally (manager only)
router.delete('/last', requireManager, async (req: Request, res: Response) => {
  const { setId } = req.params
  try {
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: { match: { select: { teamId: true } } },
    })
    if (!set || set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const lastRally = await prisma.rally.findFirst({
      where: { setId },
      orderBy: { rallyIndex: 'desc' },
    })
    if (!lastRally) return res.status(400).json({ error: 'No rallies to undo' })

    // Substitutions logged after this rally (including a forced libero exit)
    // belong to it, so undoing the rally removes them as well.
    await prisma.$transaction([
      prisma.substitution.deleteMany({ where: { setId, rallyIndex: { gte: lastRally.rallyIndex } } }),
      prisma.rally.delete({ where: { id: lastRally.id } }),
    ])

    // Restore set score from previous rally
    const prevRally = await prisma.rally.findFirst({
      where: { setId },
      orderBy: { rallyIndex: 'desc' },
    })

    await prisma.set.update({
      where: { id: setId },
      data: {
        scoreUs: prevRally ? prevRally.scoreUs : 0,
        scoreThem: prevRally ? prevRally.scoreThem : 0,
      },
    })

    res.json({ message: 'Last rally undone', restoredRally: prevRally || null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to undo rally' })
  }
})

export default router
