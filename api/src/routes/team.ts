import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router()

// GET /api/team — return current team name and initials
router.get('/', async (req: Request, res: Response) => {
  const teamId = req.user?.teamId
  if (!teamId) return res.status(401).json({ error: 'No team' })

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, initials: true },
    })
    if (!team) return res.status(404).json({ error: 'Team not found' })
    res.json(team)
  } catch {
    res.status(500).json({ error: 'Failed to fetch team' })
  }
})

// PATCH /api/team — update team name and/or initials (manager only)
router.patch('/', requireManager, async (req: Request, res: Response) => {
  const teamId = req.user?.teamId
  if (!teamId) return res.status(401).json({ error: 'No team' })

  const { name, initials } = req.body as { name?: string; initials?: string }
  if (!name && initials === undefined) {
    return res.status(400).json({ error: 'Provide name and/or initials to update' })
  }

  try {
    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(initials !== undefined && { initials: initials.trim() || null }),
      },
      select: { id: true, name: true, initials: true },
    })
    res.json(team)
  } catch {
    res.status(500).json({ error: 'Failed to update team' })
  }
})

export default router
