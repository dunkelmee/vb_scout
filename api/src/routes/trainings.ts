import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router()

// GET /api/trainings — list training sessions
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.trainingSession.findMany({
      where: { teamId: req.user!.teamId! },
      orderBy: { date: 'desc' },
      include: {
        trainingAttendance: {
          select: { status: true, playerId: true },
        },
      },
    })

    // Add attendance counts
    const result = sessions.map(s => {
      const counts = { coming: 0, not_coming: 0, pending: 0 }
      for (const att of s.trainingAttendance) {
        if (att.status === 'coming') counts.coming++
        else if (att.status === 'not_coming') counts.not_coming++
        else counts.pending++
      }

      // For player role: also include own RSVP status
      let myRsvp = null
      if (req.user?.role === 'player') {
        // This needs player id — we'll handle in the client
        myRsvp = null
      }

      return {
        ...s,
        attendanceCounts: counts,
        myRsvp,
      }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch training sessions' })
  }
})

// POST /api/trainings — create session (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { date, startTime, endTime, title, notes, location, focusTags } = req.body
  if (!date || !startTime || !title) {
    return res.status(400).json({ error: 'date, startTime and title are required' })
  }

  try {
    const session = await prisma.trainingSession.create({
      data: {
        teamId: req.user!.teamId!,
        date: new Date(date),
        startTime,
        endTime: endTime || undefined,
        title,
        notes,
        location,
        focusTags: focusTags || [],
        createdBy: req.user!.id,
      },
    })

    // Create pending attendance for all team players
    const players = await prisma.player.findMany({
      where: { teamId: req.user!.teamId! },
      select: { id: true },
    })

    if (players.length > 0) {
      await prisma.trainingAttendance.createMany({
        data: players.map(p => ({
          trainingSessionId: session.id,
          playerId: p.id,
          status: 'pending',
        })),
        skipDuplicates: true,
      })
    }

    const result = await prisma.trainingSession.findUnique({
      where: { id: session.id },
      include: { trainingAttendance: true },
    })

    res.status(201).json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create training session' })
  }
})

// GET /api/trainings/:id — get session with attendance
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id, teamId: req.user!.teamId! },
      include: {
        trainingAttendance: {
          include: {
            player: {
              select: { id: true, firstName: true, lastName: true, jersey: true, positions: true, userId: true },
            },
          },
          orderBy: [{ status: 'asc' }, { player: { lastName: 'asc' } }],
        },
      },
    })
    if (!session) return res.status(404).json({ error: 'Training session not found' })

    // For player role: only show own attendance detail, list of coming players (names only)
    if (req.user?.role === 'player') {
      const myAttendance = session.trainingAttendance.find(
        a => a.player.userId === req.user!.id
      )
      const comingPlayers = session.trainingAttendance
        .filter(a => a.status === 'coming')
        .map(a => `${a.player.firstName} ${a.player.lastName}`)

      return res.json({
        ...session,
        trainingAttendance: undefined,
        myAttendance,
        comingPlayers,
      })
    }

    res.json(session)
  } catch {
    res.status(500).json({ error: 'Failed to fetch training session' })
  }
})

// PATCH /api/trainings/:id — update session (manager only)
router.patch('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  const { date, startTime, endTime, title, notes, location, focusTags } = req.body

  try {
    const existing = await prisma.trainingSession.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Training session not found' })

    const session = await prisma.trainingSession.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(title && { title }),
        ...(notes !== undefined && { notes }),
        ...(location !== undefined && { location }),
        ...(focusTags && { focusTags }),
      },
    })
    res.json(session)
  } catch {
    res.status(500).json({ error: 'Failed to update training session' })
  }
})

// DELETE /api/trainings/:id — delete session (manager only)
router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const existing = await prisma.trainingSession.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Training session not found' })

    await prisma.trainingSession.delete({ where: { id } })
    res.json({ message: 'Training session deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete training session' })
  }
})

export default router
