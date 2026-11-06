import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { loadSetState, getMatchRoster } from '../lib/setState'
import { validateSub } from '../lib/substitutionRules'

const router = Router({ mergeParams: true })

// POST /api/sets/:setId/substitutions — log a substitution or libero replacement.
// Validated against the FIVB rules (see lib/substitutionRules.ts). Whether it is a
// libero replacement is derived from the players, not taken from the client.
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { setId } = req.params
  const { playerOutId, playerInId } = req.body

  try {
    const state = await loadSetState(setId)
    if (!state || state.set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (state.set.status === 'completed') return res.status(400).json({ error: 'Set is completed' })

    const { rosterIds, liberoIds } = await getMatchRoster(state.set.match.id, state.set.match.teamId)
    const result = validateSub({
      startingLineup: state.startingLineup,
      lineup: state.lineup,
      servingTeam: state.servingTeam,
      lastRallyIndex: state.lastRallyIndex,
      subs: state.subs,
      liberoIds,
      rosterIds,
    }, playerOutId, playerInId)

    if (!result.ok) return res.status(400).json({ error: result.message, code: result.code })

    const sub = await prisma.substitution.create({
      data: {
        setId,
        rallyIndex: state.lastRallyIndex,
        playerOutId,
        playerInId,
        isLiberoSwap: result.isLiberoSwap,
        atScoreUs: state.lastRally ? state.lastRally.scoreUs : 0,
        atScoreThem: state.lastRally ? state.lastRally.scoreThem : 0,
      },
      include: {
        playerOut: { select: { id: true, firstName: true, lastName: true, jersey: true } },
        playerIn: { select: { id: true, firstName: true, lastName: true, jersey: true } },
      },
    })

    res.status(201).json(sub)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to log substitution' })
  }
})

// GET /api/sets/:setId/substitutions — get substitutions
router.get('/', async (req: Request, res: Response) => {
  const { setId } = req.params
  try {
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: { match: { select: { teamId: true } } },
    })
    if (!set || set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const subs = await prisma.substitution.findMany({
      where: { setId },
      orderBy: { rallyIndex: 'asc' },
      include: {
        playerOut: { select: { id: true, firstName: true, lastName: true, jersey: true } },
        playerIn: { select: { id: true, firstName: true, lastName: true, jersey: true } },
      },
    })
    res.json(subs)
  } catch {
    res.status(500).json({ error: 'Failed to fetch substitutions' })
  }
})

export default router
