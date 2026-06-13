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

// GET /api/notifications — current user's in-app notifications (newest first)
router.get('/', async (req: Request, res: Response) => {
  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notificationLog.findMany({
        where:   { userId: req.user!.id },
        orderBy: { sentAt: 'desc' },
        take:    30,
        select: {
          id: true, type: true, entityType: true, entityId: true,
          title: true, body: true, sentAt: true, readAt: true,
        },
      }),
      prisma.notificationLog.count({ where: { userId: req.user!.id, readAt: null } }),
    ])
    res.json({ items, unreadCount })
  } catch (err) {
    console.error('[notifications GET]', err)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// POST /api/notifications/read — mark notifications read (all unread, or a given set of ids)
router.post('/read', async (req: Request, res: Response) => {
  const { ids } = req.body as { ids?: string[] }
  try {
    const result = await prisma.notificationLog.updateMany({
      where: {
        userId: req.user!.id,
        readAt: null,
        ...(Array.isArray(ids) && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    })
    res.json({ updated: result.count })
  } catch (err) {
    console.error('[notifications/read]', err)
    res.status(500).json({ error: 'Failed to mark notifications read' })
  }
})

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

    // In-app log for every eligible recipient (shows in the bell even without push)
    if (eligibleUserIds.length > 0) {
      await prisma.notificationLog.createMany({
        data: eligibleUserIds.map(uid => ({
          userId:     uid,
          type:       'rsvp_request',
          entityType,
          entityId,
          title,
          body,
        })),
      })
    }

    // Send push — report how many users were actually reached (≥1 delivered)
    const deliveryCounts = await Promise.all(
      eligibleUserIds.map(uid => sendPushToUser(uid, { title, body, url, tag })),
    )
    const reached = deliveryCounts.filter(n => n > 0).length

    res.json({ sent: reached })
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
