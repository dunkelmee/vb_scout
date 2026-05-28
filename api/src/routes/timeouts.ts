import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router({ mergeParams: true })

// POST /api/sets/:setId/timeouts — log timeout
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { setId } = req.params
  const { calledBy } = req.body

  if (!calledBy) return res.status(400).json({ error: 'calledBy is required' })

  try {
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: {
        match: { select: { teamId: true } },
        rallies: { orderBy: { rallyIndex: 'desc' }, take: 1 },
      },
    })
    if (!set || set.match.teamId !== req.user!.teamId!) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const lastRally = set.rallies[0]
    const rallyIndex = lastRally ? lastRally.rallyIndex : 0
    const atScoreUs = lastRally ? lastRally.scoreUs : set.scoreUs
    const atScoreThem = lastRally ? lastRally.scoreThem : set.scoreThem

    const timeout = await prisma.timeout.create({
      data: { setId, rallyIndex, calledBy, atScoreUs, atScoreThem },
    })

    res.status(201).json(timeout)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to log timeout' })
  }
})

// GET /api/sets/:setId/timeouts — get timeouts
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

    const timeouts = await prisma.timeout.findMany({
      where: { setId },
      orderBy: { rallyIndex: 'asc' },
    })
    res.json(timeouts)
  } catch {
    res.status(500).json({ error: 'Failed to fetch timeouts' })
  }
})

export default router
