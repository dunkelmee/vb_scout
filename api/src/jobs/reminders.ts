import cron from 'node-cron'
import prisma from '../lib/prisma'
import { sendPushToUser } from '../lib/push'

function formatDateTime(date: Date, startTime?: string): string {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return startTime ? `${dateStr} · ${startTime}` : dateStr
}

async function sendRsvpReminderForEntity(
  entityType: 'training' | 'game',
  entityId:   string,
  teamId:     string
) {
  // Get all players in team who have user accounts
  const players = await prisma.player.findMany({
    where: { teamId, userId: { not: null } },
    select: { userId: true },
  })
  const userIds = players.map(p => p.userId!)

  // Find which users have already responded
  const responded = await prisma.rsvp.findMany({
    where: { entityType, entityId, playerId: { in: userIds } },
    select: { playerId: true },
  })
  const respondedSet = new Set(responded.map(r => r.playerId))
  const noResponseIds = userIds.filter(id => !respondedSet.has(id))

  if (noResponseIds.length === 0) return

  // Get entity details
  let title: string
  let body: string
  let url: string

  if (entityType === 'training') {
    const t = await prisma.trainingSession.findUnique({ where: { id: entityId } })
    if (!t) return
    title = `Training reminder: ${t.title}`
    body  = `${formatDateTime(new Date(t.date), t.startTime)} · ${t.location ?? 'TBC'} — please confirm your attendance`
    url   = `/trainings/${entityId}`
  } else {
    const m = await prisma.match.findUnique({ where: { id: entityId } })
    if (!m) return
    title = `Match reminder: vs ${m.opponent ?? 'opponent'}`
    body  = `${formatDateTime(new Date(m.date))} · ${m.location ?? 'TBC'} — please confirm your attendance`
    url   = `/games/${entityId}`
  }

  const tag = `reminder-${entityType}-${entityId}`
  const prefField = entityType === 'training' ? 'notifTrainingReminder' : 'notifMatchReminder'

  // Check preferences and send
  const users = await prisma.user.findMany({
    where: { id: { in: noResponseIds } },
    select: { id: true, notifTrainingReminder: true, notifMatchReminder: true },
  })

  const eligible = users.filter(u => u[prefField])

  await Promise.all(eligible.map(u => sendPushToUser(u.id, { title, body, url, tag })))

  // Log
  if (eligible.length > 0) {
    await prisma.notificationLog.createMany({
      data: eligible.map(u => ({
        userId: u.id,
        type:   'rsvp_request',
        entityType,
        entityId,
        title,
        body,
      })),
    })
  }
}

export function startReminderCron() {
  // Runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now        = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    try {
      // Training sessions whose reminder time has arrived (lte now also covers
      // sessions created <24h before the event — they fire on the next cycle).
      const trainings = await prisma.trainingSession.findMany({
        where: {
          rsvpEnabled:      true,
          autoReminderSent: false,
          autoReminderTime: { lte: now },
          date:             { gte: todayStart },
        },
      })
      for (const t of trainings) {
        await sendRsvpReminderForEntity('training', t.id, t.teamId)
        await prisma.trainingSession.update({
          where: { id: t.id },
          data:  { autoReminderSent: true },
        })
      }

      // Playing matches
      const matches = await prisma.match.findMany({
        where: {
          matchType:        'playing',
          rsvpEnabled:      true,
          autoReminderSent: false,
          status:           'upcoming',
          autoReminderTime: { lte: now },
          date:             { gte: todayStart },
        },
      })
      for (const m of matches) {
        await sendRsvpReminderForEntity('game', m.id, m.teamId)
        await prisma.match.update({
          where: { id: m.id },
          data:  { autoReminderSent: true },
        })
      }
    } catch (err) {
      console.error('[reminder-cron]', err)
    }
  })

  console.log('Reminder cron started (every 15 min)')
}
