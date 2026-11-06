import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { getMatchRoster } from '../lib/setState'
import { MAX_LIBEROS, validateStartingLineup } from '../lib/substitutionRules'

const router = Router({ mergeParams: true })

const ANALYSIS_SERVICE_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8001'

// ── Helpers ───────────────────────────────────────────────────────────────
// The parent route registers the game ID as ':gameId' (app.use('/api/games/:gameId/sets', ...))
// so req.params always has 'gameId', never 'id'.
const getMatchId = (req: Request) => (req.params as Record<string, string>).gameId || req.params.id

// POST /api/games/:gameId/sets — create new set
router.post('/', requireManager, async (req: Request, res: Response) => {
  const matchId = getMatchId(req)
  const { startingLineup, servingFirst } = req.body

  if (!startingLineup) return res.status(400).json({ error: 'startingLineup is required' })

  try {
    const match = await prisma.match.findFirst({
      where: { id: matchId, teamId: req.user!.teamId! },
      include: { sets: true },
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    const { liberoIds } = await getMatchRoster(match.id, match.teamId)
    const lineupError = validateStartingLineup(startingLineup, liberoIds)
    if (lineupError) return res.status(400).json({ error: lineupError })

    const nextSetNumber = match.sets.length + 1
    const set = await prisma.set.create({
      data: {
        matchId,
        setNumber: nextSetNumber,
        startingLineup,
        servingFirst: servingFirst || match.firstServe,
        status: 'in_progress',
      },
    })
    res.status(201).json(set)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create set' })
  }
})

// GET /api/games/:gameId/sets/:setId
router.get('/:setId', async (req: Request, res: Response) => {
  const matchId = getMatchId(req)
  const { setId } = req.params
  try {
    const set = await prisma.set.findFirst({
      where: { id: setId, matchId },
      include: {
        rallies: { orderBy: { rallyIndex: 'asc' } },
        substitutions: {
          orderBy: { rallyIndex: 'asc' },
          include: {
            playerOut: { select: { id: true, firstName: true, lastName: true, jersey: true } },
            playerIn:  { select: { id: true, firstName: true, lastName: true, jersey: true } },
          },
        },
        timeouts: { orderBy: { rallyIndex: 'asc' } },
      },
    })
    if (!set) return res.status(404).json({ error: 'Set not found' })

    const match = await prisma.match.findFirst({ where: { id: matchId, teamId: req.user!.teamId! } })
    if (!match) return res.status(403).json({ error: 'Access denied' })

    res.json(set)
  } catch {
    res.status(500).json({ error: 'Failed to fetch set' })
  }
})

// PATCH /api/games/:gameId/sets/:setId — update set status / score / lineup
router.patch('/:setId', requireManager, async (req: Request, res: Response) => {
  const matchId = getMatchId(req)
  const { setId } = req.params
  const { status, scoreUs, scoreThem, startingLineup, servingFirst, liberoIds } = req.body

  if (servingFirst !== undefined && servingFirst !== 'us' && servingFirst !== 'them') {
    return res.status(400).json({ error: "servingFirst must be 'us' or 'them'" })
  }

  try {
    const match = await prisma.match.findFirst({ where: { id: matchId, teamId: req.user!.teamId! } })
    if (!match) return res.status(403).json({ error: 'Access denied' })

    const set = await prisma.set.findFirst({ where: { id: setId, matchId } })
    if (!set) return res.status(404).json({ error: 'Set not found' })

    // The starting lineup and first server can only change before the first rally;
    // after that, changes go through substitutions.
    const changesLineup = !!startingLineup || !!servingFirst || liberoIds !== undefined
    if (changesLineup) {
      const rallyCount = await prisma.rally.count({ where: { setId } })
      if (rallyCount > 0) {
        return res.status(409).json({ error: 'The lineup cannot be changed after the first rally — use a substitution' })
      }
    }

    // Liberos are chosen per game, so they can only change before the game's first rally
    const roster = await getMatchRoster(match.id, match.teamId)
    let newLiberoIds: string[] | null = null
    if (liberoIds !== undefined) {
      if (!Array.isArray(liberoIds) || liberoIds.length > MAX_LIBEROS) {
        return res.status(400).json({ error: `At most ${MAX_LIBEROS} liberos per game` })
      }
      if (set.setNumber !== 1) {
        return res.status(409).json({ error: 'Liberos are chosen per game and can only change before the first set starts' })
      }
      const rosterPlayers = await prisma.matchPlayer.count({ where: { matchId } })
      if (rosterPlayers === 0) return res.status(400).json({ error: 'This game has no roster' })
      if (liberoIds.some((id: unknown) => typeof id !== 'string' || !roster.rosterIds.includes(id))) {
        return res.status(400).json({ error: 'Liberos must be on the roster for this game' })
      }
      newLiberoIds = liberoIds as string[]
    }

    if (startingLineup || newLiberoIds) {
      const lineupError = validateStartingLineup(
        startingLineup ?? set.startingLineup,
        newLiberoIds ?? roster.liberoIds,
      )
      if (lineupError) return res.status(400).json({ error: lineupError })
    }

    const updatedSet = await prisma.$transaction(async (tx) => {
      if (newLiberoIds) {
        await tx.matchPlayer.updateMany({ where: { matchId }, data: { isLibero: false } })
        await tx.matchPlayer.updateMany({ where: { matchId, playerId: { in: newLiberoIds } }, data: { isLibero: true } })
      }
      // Libero replacements made before the first serve refer to the old lineup / liberos
      if (startingLineup || newLiberoIds) await tx.substitution.deleteMany({ where: { setId } })
      return tx.set.update({
        where: { id: setId },
        data: {
          ...(status              && { status }),
          ...(scoreUs  !== undefined && { scoreUs }),
          ...(scoreThem !== undefined && { scoreThem }),
          ...(startingLineup     && { startingLineup }),
          ...(servingFirst       && { servingFirst }),
        },
      })
    })

    // When set is completed, update match score arrays and check for match completion
    if (status === 'completed') {
      const allSets = await prisma.set.findMany({
        where: { matchId },
        orderBy: { setNumber: 'asc' },
      })

      const scoreUsArr   = allSets.map(s => s.id === setId ? (scoreUs   ?? s.scoreUs)   : s.scoreUs)
      const scoreThemArr = allSets.map(s => s.id === setId ? (scoreThem ?? s.scoreThem) : s.scoreThem)

      const setsWonUs   = scoreUsArr.filter((u, i)   => u > scoreThemArr[i]).length
      const setsWonThem = scoreThemArr.filter((t, i) => t > scoreUsArr[i]).length

      const matchComplete = setsWonUs === 3 || setsWonThem === 3
      const padded      = [...scoreUsArr,   ...Array(Math.max(0, 5 - scoreUsArr.length)).fill(0)]
      const paddedThem  = [...scoreThemArr, ...Array(Math.max(0, 5 - scoreThemArr.length)).fill(0)]

      await prisma.match.update({
        where: { id: matchId },
        data: {
          scoreUs:    padded.slice(0, 5),
          scoreThem:  paddedThem.slice(0, 5),
          setsWonUs,
          setsWonThem,
          setsPlayed: allSets.length,
          ...(matchComplete && { status: 'completed' }),
        },
      })

      if (matchComplete) {
        try {
          const actor = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { locale: true } })
          await fetch(`${ANALYSIS_SERVICE_URL}/analyse/${matchId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: actor?.locale ?? 'de' }),
          })
        } catch (e) {
          console.error('Failed to trigger analysis:', e)
        }
      }
    }

    res.json(updatedSet)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update set' })
  }
})

export default router
