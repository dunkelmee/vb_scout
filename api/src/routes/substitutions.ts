import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router({ mergeParams: true })

// POST /api/sets/:setId/substitutions — log substitution
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { setId } = req.params
  const { playerOutId, playerInId, isLiberoSwap } = req.body

  try {
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: {
        match: { select: { teamId: true } },
        rallies: { orderBy: { rallyIndex: 'desc' }, take: 1 },
        substitutions: true,
      },
    })
    if (!set || set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Count non-libero subs
    if (!isLiberoSwap) {
      const regularSubs = set.substitutions.filter(s => !s.isLiberoSwap).length
      if (regularSubs >= 6) return res.status(400).json({ error: 'Maximum 6 substitutions reached' })
    }

    const lastRally = set.rallies[0]
    const rallyIndex = lastRally ? lastRally.rallyIndex : 0
    const atScoreUs = lastRally ? lastRally.scoreUs : set.scoreUs
    const atScoreThem = lastRally ? lastRally.scoreThem : set.scoreThem

    const sub = await prisma.substitution.create({
      data: {
        setId,
        rallyIndex,
        playerOutId: playerOutId || undefined,
        playerInId: playerInId || undefined,
        isLiberoSwap: isLiberoSwap || false,
        atScoreUs,
        atScoreThem,
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
