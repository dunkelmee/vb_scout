import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { addPoint, Lineup } from '../lib/rotation'

const router = Router({ mergeParams: true })

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
  const { scorer, pointType } = req.body

  if (!scorer || !pointType) return res.status(400).json({ error: 'scorer and pointType are required' })

  try {
    const set = await prisma.set.findUnique({
      where: { id: setId },
      include: {
        match: true,
        rallies: { orderBy: { rallyIndex: 'desc' }, take: 1 },
      },
    })
    if (!set) return res.status(404).json({ error: 'Set not found' })
    if (set.match.teamId !== req.user!.teamId!) return res.status(403).json({ error: 'Access denied' })
    if (set.status === 'completed') return res.status(400).json({ error: 'Set is completed' })

    // Determine current state from last rally
    const lastRally = set.rallies[0]
    const currentScoreUs = lastRally ? lastRally.scoreUs : 0
    const currentScoreThem = lastRally ? lastRally.scoreThem : 0
    const rallyIndex = lastRally ? lastRally.rallyIndex + 1 : 0

    // Determine serving team
    let currentServer: 'us' | 'them' = set.servingFirst as 'us' | 'them'
    let currentLineup: Lineup = (set.startingLineup as unknown) as Lineup

    if (lastRally) {
      currentServer = lastRally.currentServer as 'us' | 'them'
      currentLineup = (lastRally.rotationAfter as unknown) as Lineup
    }

    // Compute new state
    const { newLineup, rotated, newServer } = addPoint({
      scorer: scorer as 'us' | 'them',
      currentServer,
      currentLineup,
    })

    const newScoreUs = currentScoreUs + (scorer === 'us' ? 1 : 0)
    const newScoreThem = currentScoreThem + (scorer === 'them' ? 1 : 0)

    const rally = await prisma.rally.create({
      data: {
        setId,
        rallyIndex,
        scorer,
        pointType,
        scoreUs: newScoreUs,
        scoreThem: newScoreThem,
        servingTeam: currentServer,
        rotationAfter: newLineup as unknown as Record<string, string>,
        rotated,
        currentServer: newServer,
      },
    })

    // Update set score
    await prisma.set.update({
      where: { id: setId },
      data: { scoreUs: newScoreUs, scoreThem: newScoreThem },
    })

    res.status(201).json(rally)
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

    await prisma.rally.delete({ where: { id: lastRally.id } })

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
