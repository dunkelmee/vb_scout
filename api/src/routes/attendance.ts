import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router({ mergeParams: true })

// GET /api/trainings/:id/attendance — RSVP roster for a training (manager only)
// Returns all players with their RSVP status
router.get('/', async (req: Request, res: Response) => {
  const { id: trainingId } = req.params
  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id: trainingId, teamId: req.user!.teamId! },
    })
    if (!session) return res.status(404).json({ error: 'Training session not found' })

    const players = await prisma.player.findMany({
      where: { teamId: req.user!.teamId! },
      select: { id: true, firstName: true, lastName: true, jersey: true, positions: true, userId: true },
      orderBy: { lastName: 'asc' },
    })

    const rsvps = await prisma.rsvp.findMany({
      where: { entityType: 'training', entityId: trainingId },
    })
    const rsvpByUserId = new Map(rsvps.map(r => [r.playerId, r]))

    const result = players.map(p => ({
      playerId:  p.id,
      userId:    p.userId,
      firstName: p.firstName,
      lastName:  p.lastName,
      jersey:    p.jersey,
      positions: p.positions,
      rsvp:      p.userId ? (rsvpByUserId.get(p.userId) ?? null) : null,
    }))

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to fetch attendance' })
  }
})

export default router
