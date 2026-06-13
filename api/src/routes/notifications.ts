import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { sendPushToUser } from '../lib/push'
import { requireManager } from '../middleware/requireRole'

const router = Router()

function formatDateTime(date: Date, startTime?: string): string {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return startTime ? `${dateStr} · ${startTime}` : dateStr
}

// POST /api/notifications/reminder — manager sends manual RSVP reminder
router.post('/reminder', requireManager, async (req: Request, res: Response) => {
  const { entityType, entityId, message, targetFilter } = req.body as {
    entityType?:   string
    entityId?:     string
    message?:      string
    targetFilter?: 'all' | 'no_response' | 'no_response_and_maybe'
  }

  if (!entityType || !['training', 'game'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be "training" or "game"' })
  }
  if (!entityId) return res.status(400).json({ error: 'entityId is required' })

  const filter = targetFilter ?? 'no_response'

  try {
    // Fetch entity
    let entity: { id: string; title?: string; opponent?: string | null; date: Date; location?: string | null; teamId: string; startTime?: string } | null = null
    let entityName = ''

    if (entityType === 'training') {
      const t = await prisma.trainingSession.findFirst({
        where: { id: entityId, teamId: req.user!.teamId! },
      })
      if (!t) return res.status(404).json({ error: 'Training session not found' })
      entity = { ...t, title: t.title, date: new Date(t.date) }
      entityName = t.title
    } else {
      const m = await prisma.match.findFirst({
        where: { id: entityId, teamId: req.user!.teamId!, matchType: 'playing' },
      })
      if (!m) return res.status(404).json({ error: 'Match not found' })
      entity = { ...m }
      entityName = `vs ${m.opponent ?? 'opponent'}`
    }

    const title = entityType === 'training'
      ? `Training reminder: ${entityName}`
      : `Match reminder: ${entityName}`

    const body = message ?? `${formatDateTime(entity!.date, entity!.startTime)} · ${entity!.location ?? 'TBC'} — please confirm your attendance`

    // Get all players with user accounts in the team
    const players = await prisma.player.findMany({
      where: { teamId: req.user!.teamId!, userId: { not: null } },
    })

    // Get existing RSVPs
    const existingRsvps = await prisma.rsvp.findMany({
      where: { entityType, entityId },
      select: { playerId: true, status: true },
    })
    const rsvpByUserId = new Map(existingRsvps.map(r => [r.playerId, r.status]))

    // Filter targets
    let targetUserIds: string[] = []
    for (const p of players) {
      if (!p.userId) continue
      const rsvpStatus = rsvpByUserId.get(p.userId)
      if (filter === 'all') {
        targetUserIds.push(p.userId)
      } else if (filter === 'no_response') {
        if (!rsvpStatus || rsvpStatus === 'pending') targetUserIds.push(p.userId)
      } else {
        // no_response_and_maybe
        if (!rsvpStatus || rsvpStatus === 'pending' || rsvpStatus === 'maybe') targetUserIds.push(p.userId)
      }
    }

    // Get user notification preferences
    const users = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: {
        id: true,
        notifTrainingReminder: true,
        notifMatchReminder: true,
      },
    })

    const prefField = entityType === 'training' ? 'notifTrainingReminder' : 'notifMatchReminder'
    const eligibleUserIds = users.filter(u => u[prefField]).map(u => u.id)

    const url = entityType === 'training' ? `/trainings/${entityId}` : `/games/${entityId}`
    const tag = `reminder-${entityType}-${entityId}`

    // Send notifications — count users who actually received at least one push
    const deliveryCounts = await Promise.all(
      eligibleUserIds.map(uid => sendPushToUser(uid, { title, body, url, tag })),
    )
    const reachedUserIds = eligibleUserIds.filter((_, i) => deliveryCounts[i] > 0)

    // Log only the users we actually reached
    if (reachedUserIds.length > 0) {
      await prisma.notificationLog.createMany({
        data: reachedUserIds.map(uid => ({
          userId:     uid,
          type:       'rsvp_request',
          entityType,
          entityId,
          title,
          body,
        })),
      })
    }

    res.json({ sent: reachedUserIds.length })
  } catch (err) {
    console.error('[notifications/reminder]', err)
    res.status(500).json({ error: 'Failed to send reminder' })
  }
})

// GET /api/notifications/last-reminder — when was the last reminder sent for an entity
router.get('/last-reminder', requireManager, async (req: Request, res: Response) => {
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string }
  if (!entityType || !entityId) return res.status(400).json({ error: 'entityType and entityId required' })

  try {
    const log = await prisma.notificationLog.findFirst({
      where: { entityType, entityId, type: 'rsvp_request' },
      orderBy: { sentAt: 'desc' },
    })
    res.json({ sentAt: log?.sentAt ?? null })
  } catch (err) {
    console.error('[last-reminder]', err)
    res.status(500).json({ error: 'Failed to fetch last reminder' })
  }
})

export default router
