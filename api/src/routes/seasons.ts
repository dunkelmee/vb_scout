import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { getSeasonStats } from '../lib/seasonStats'

const router = Router()

// GET /api/seasons — list all seasons (manager only)
router.get('/', requireManager, async (req: Request, res: Response) => {
  try {
    const seasons = await prisma.season.findMany({
      where: { teamId: req.user!.teamId! },
      orderBy: { startDate: 'desc' },
    })
    res.json(seasons)
  } catch {
    res.status(500).json({ error: 'Failed to fetch seasons' })
  }
})

// GET /api/seasons/active — get active season
router.get('/active', async (req: Request, res: Response) => {
  try {
    const season = await prisma.season.findFirst({
      where: { teamId: req.user!.teamId!, isActive: true },
    })
    res.json(season || null)
  } catch {
    res.status(500).json({ error: 'Failed to fetch active season' })
  }
})

// POST /api/seasons — create season (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { name, startDate, endDate, isActive } = req.body
  if (!name || !startDate) return res.status(400).json({ error: 'name and startDate required' })

  try {
    if (isActive) {
      // Deactivate all other seasons for this team
      await prisma.season.updateMany({
        where: { teamId: req.user!.teamId! },
        data: { isActive: false },
      })
    }

    const season = await prisma.season.create({
      data: {
        teamId: req.user!.teamId!,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: isActive || false,
      },
    })
    res.status(201).json(season)
  } catch {
    res.status(500).json({ error: 'Failed to create season' })
  }
})

// GET /api/seasons/:id — get season with stats
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const season = await prisma.season.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!season) return res.status(404).json({ error: 'Season not found' })

    const stats = await getSeasonStats(id, req.user!.teamId!)
    res.json({ ...season, stats })
  } catch {
    res.status(500).json({ error: 'Failed to fetch season' })
  }
})

// PATCH /api/seasons/:id — update season (manager only)
router.patch('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, startDate, endDate, isActive } = req.body

  try {
    const existing = await prisma.season.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Season not found' })

    if (isActive) {
      await prisma.season.updateMany({
        where: { teamId: req.user!.teamId!, NOT: { id } },
        data: { isActive: false },
      })
    }

    const season = await prisma.season.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(season)
  } catch {
    res.status(500).json({ error: 'Failed to update season' })
  }
})

// DELETE /api/seasons/:id — delete season (manager only)
router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const existing = await prisma.season.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Season not found' })

    await prisma.season.delete({ where: { id } })
    res.json({ message: 'Season deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete season' })
  }
})

// GET /api/seasons/:id/stats — season-level aggregated stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const season = await prisma.season.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!season) return res.status(404).json({ error: 'Season not found' })

    const stats = await getSeasonStats(id, req.user!.teamId!)
    res.json(stats)
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
