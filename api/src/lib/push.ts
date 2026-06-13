import webpush from 'web-push'
import prisma from './prisma'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title:   string
  body:    string
  icon?:   string
  badge?:  string
  url?:    string
  tag?:    string
  data?:   Record<string, unknown>
}

/** Returns the number of subscriptions the push was successfully delivered to. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return 0

  const notification = JSON.stringify({
    title:  payload.title,
    body:   payload.body,
    icon:   payload.icon  ?? '/icons/icon-192.png',
    badge:  payload.badge ?? '/icons/badge-72.png',
    url:    payload.url   ?? '/',
    tag:    payload.tag,
    data:   payload.data,
  })

  const results = await Promise.allSettled(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), notification)
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data:  { lastUsedAt: new Date() },
        })
        return true
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
        return false
      }
    })
  )

  return results.filter(r => r.status === 'fulfilled' && r.value === true).length
}

type NotifPrefField =
  | 'notifRsvpRequests'
  | 'notifRsvpResponses'
  | 'notifMatchReminder'
  | 'notifTrainingReminder'
  | 'notifAnalysisReady'

export async function sendPushToTeam(
  teamId:   string,
  payload:  PushPayload,
  options?: {
    roles?:          ('manager' | 'player')[]
    excludeUserId?:  string
    notifPrefField?: NotifPrefField
    /** When set, also persists an in-app NotificationLog for every eligible recipient. */
    log?:            { type: string; entityType?: string | null; entityId?: string | null }
  }
): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: {
      teamId,
      ...(options?.roles ? { role: { in: options.roles } } : {}),
      ...(options?.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
    },
    include: { user: true },
  })

  const eligible = options?.notifPrefField
    ? members.filter(m => m.user[options.notifPrefField!] === true)
    : members

  // In-app log for every eligible recipient — independent of push delivery, so the
  // bell shows the notification even for users who haven't enabled push.
  if (options?.log && eligible.length > 0) {
    await prisma.notificationLog.createMany({
      data: eligible.map(m => ({
        userId:     m.userId,
        type:       options.log!.type,
        entityType: options.log!.entityType ?? null,
        entityId:   options.log!.entityId ?? null,
        title:      payload.title,
        body:       payload.body,
      })),
    })
  }

  await Promise.all(eligible.map(m => sendPushToUser(m.userId, payload)))
}
