import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router({ mergeParams: true })

// GET /api/trainings/:id/attendance
router.get('/', async (req: Request, res: Response) => {
  const { id: trainingId } = req.params
  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id: trainingId, teamId: req.user!.teamId! },
    })
    if (!session) return res.status(404).json({ error: 'Training session not found' })

    const where: Record<string, unknown> = { trainingSessionId: trainingId }

    // Players can only see own attendance
    if (req.user!.role === 'player') {
      const player = await prisma.player.findFirst({ where: { userId: req.user!.id } })
      if (!player) return res.status(404).json({ error: 'Player not found' })
      where.playerId = player.id
    }

    const attendance = await prisma.trainingAttendance.findMany({
      where,
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true, jersey: true, positions: true },
        },
      },
      orderBy: { player: { lastName: 'asc' } },
    })

    res.json(attendance)
  } catch {
    res.status(500).json({ error: 'Failed to fetch attendance' })
  }
})

// PATCH /api/trainings/:id/attendance/:playerId — update RSVP
router.patch('/:playerId', async (req: Request, res: Response) => {
  const { id: trainingId, playerId } = req.params
  const { status, note } = req.body

  if (!status || !['coming', 'not_coming', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be coming | not_coming | pending' })
  }

  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id: trainingId, teamId: req.user!.teamId! },
    })
    if (!session) return res.status(404).json({ error: 'Training session not found' })

    // Players can only update own RSVP
    if (req.user!.role === 'player') {
      const myPlayer = await prisma.player.findFirst({ where: { userId: req.user!.id } })
      if (!myPlayer || myPlayer.id !== playerId) {
        return res.status(403).json({ error: 'You can only update your own RSVP' })
      }
    }

    const attendance = await prisma.trainingAttendance.upsert({
      where: {
        trainingSessionId_playerId: { trainingSessionId: trainingId, playerId },
      },
      update: {
        status,
        note: note !== undefined ? note : undefined,
        respondedAt: new Date(),
      },
      create: {
        trainingSessionId: trainingId,
        playerId,
        status,
        note,
        respondedAt: new Date(),
      },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true, jersey: true },
        },
      },
    })

    res.json(attendance)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update attendance' })
  }
})

export default router
