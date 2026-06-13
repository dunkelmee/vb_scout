import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router()

function computeAutoReminderTime(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(':').map(Number)
  const sessionStart = new Date(date)
  sessionStart.setHours(hours, minutes, 0, 0)
  return new Date(sessionStart.getTime() - 24 * 60 * 60 * 1000)
}

// GET /api/trainings — list training sessions
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.trainingSession.findMany({
      where: { teamId: req.user!.teamId! },
      orderBy: { date: 'desc' },
    })

    // For each session, get RSVP counts
    const sessionIds = sessions.map(s => s.id)
    const rsvps = await prisma.rsvp.findMany({
      where: { entityType: 'training', entityId: { in: sessionIds } },
      select: { entityId: true, playerId: true, status: true },
    })

    const rsvpsBySession = new Map<string, typeof rsvps>()
    for (const r of rsvps) {
      if (!rsvpsBySession.has(r.entityId)) rsvpsBySession.set(r.entityId, [])
      rsvpsBySession.get(r.entityId)!.push(r)
    }

    const result = sessions.map(s => {
      const sessionRsvps = rsvpsBySession.get(s.id) ?? []
      const counts = { confirmed: 0, declined: 0, maybe: 0, pending: 0 }
      for (const r of sessionRsvps) {
        if (r.status === 'confirmed') counts.confirmed++
        else if (r.status === 'declined') counts.declined++
        else if (r.status === 'maybe') counts.maybe++
        else counts.pending++
      }
      const myRsvp = req.user?.role === 'player'
        ? sessionRsvps.find(r => r.playerId === req.user!.id) ?? null
        : null
      return { ...s, rsvpCounts: counts, myRsvp }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch training sessions' })
  }
})

// POST /api/trainings — create session (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { date, startTime, endTime, title, notes, location, focusTags, rsvpEnabled, autoReminderTime } = req.body
  if (!date || !startTime || !title) {
    return res.status(400).json({ error: 'date, startTime and title are required' })
  }

  try {
    const sessionDate = new Date(date)
    const reminderTime = autoReminderTime
      ? new Date(autoReminderTime)
      : computeAutoReminderTime(sessionDate, startTime)

    const session = await prisma.trainingSession.create({
      data: {
        teamId:          req.user!.teamId!,
        date:            sessionDate,
        startTime,
        endTime:         endTime || undefined,
        title,
        notes,
        location,
        focusTags:       focusTags || [],
        createdBy:       req.user!.id,
        rsvpEnabled:     rsvpEnabled !== false,
        autoReminderTime: reminderTime,
      },
    })

    res.status(201).json(session)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create training session' })
  }
})

// GET /api/trainings/:id — get session with RSVP data
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!session) return res.status(404).json({ error: 'Training session not found' })

    // Get all RSVPs for this session
    const rsvps = await prisma.rsvp.findMany({
      where: { entityType: 'training', entityId: id },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (req.user?.role === 'player') {
      const myRsvp = rsvps.find(r => r.playerId === req.user!.id) ?? null
      const confirmedCount = rsvps.filter(r => r.status === 'confirmed').length
      return res.json({ ...session, myRsvp, confirmedCount })
    }

    // Manager view: get all players and join with RSVP data
    const players = await prisma.player.findMany({
      where: { teamId: req.user!.teamId! },
      select: { id: true, firstName: true, lastName: true, jersey: true, positions: true, userId: true },
      orderBy: { lastName: 'asc' },
    })

    const rsvpByUserId = new Map(rsvps.map(r => [r.playerId, r]))

    const attendanceRoster = players.map(p => ({
      playerId: p.id,
      userId:   p.userId,
      firstName: p.firstName,
      lastName:  p.lastName,
      jersey:    p.jersey,
      positions: p.positions,
      rsvp: p.userId ? (rsvpByUserId.get(p.userId) ?? null) : null,
    }))

    // Get last reminder sent time
    const lastReminder = await prisma.notificationLog.findFirst({
      where: { entityType: 'training', entityId: id, type: 'rsvp_request' },
      orderBy: { sentAt: 'desc' },
    })

    res.json({ ...session, attendanceRoster, lastReminderSentAt: lastReminder?.sentAt ?? null })
  } catch {
    res.status(500).json({ error: 'Failed to fetch training session' })
  }
})

// PATCH /api/trainings/:id — update session (manager only)
router.patch('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  const { date, startTime, endTime, title, notes, location, focusTags, rsvpEnabled, autoReminderTime } = req.body

  try {
    const existing = await prisma.trainingSession.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Training session not found' })

    const newDate      = date      ? new Date(date)      : existing.date
    const newStartTime = startTime ? startTime            : existing.startTime
    const newReminderTime = autoReminderTime
      ? new Date(autoReminderTime)
      : (date || startTime) ? computeAutoReminderTime(newDate, newStartTime) : undefined

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
        ...(rsvpEnabled !== undefined && { rsvpEnabled }),
        ...(newReminderTime && { autoReminderTime: newReminderTime, autoReminderSent: false }),
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
