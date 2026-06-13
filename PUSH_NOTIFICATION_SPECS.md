# Courtside — Push Notification Specification

---

## Overview

Courtside uses the Web Push API with VAPID (Voluntary Application Server
Identification) for push notifications. Notifications are delivered via the
browser vendor's push relay (Google for Android/Chrome, Apple for iOS Safari)
to the user's device, even when the app is not open.

Push notifications serve three purposes in Courtside:
1. **RSVP requests** — managers prompt players to confirm attendance for
   training sessions and games
2. **RSVP responses** — managers are notified when players respond
3. **System events** — post-match analysis ready, subscription reminders

---

## 1. Platform support and constraints

| Platform | Support | Condition |
|---|---|---|
| Android Chrome | Full — works when app is closed | No special setup required |
| iOS Safari ≥ 16.4 | Works when app is closed | Must be added to home screen first |
| iOS Safari < 16.4 | Not supported | — |
| Desktop Chrome / Edge | Full support | — |
| Firefox | Full support | — |

**iOS home screen requirement** must be communicated clearly during onboarding.
When a player first opens the app on iOS and grants notification permission,
show a one-time prompt:

```
For notifications to work on iPhone, add Courtside to your home screen.

Tap the share icon → "Add to Home Screen"

[Show me how]    [Got it]
```

---

## 2. Database schema

### 2.1 New model: `PushSubscription`

Stores each device's push subscription object returned by the browser.
One user can have multiple subscriptions (multiple devices).

```prisma
model PushSubscription {
  id           String    @id @default(cuid())
  userId       String
  subscription String    // JSON stringified PushSubscriptionJSON object
  deviceLabel  String?   // e.g. "iPhone 15", auto-detected from user agent
  createdAt    DateTime  @default(now())
  lastUsedAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 2.2 New model: `Rsvp`

Tracks attendance responses for both training sessions and games.

```prisma
model Rsvp {
  id          String    @id @default(cuid())
  playerId    String
  entityType  String    // "training" | "game"
  entityId    String    // training session ID or match ID
  status      String    // "confirmed" | "declined" | "maybe" | "pending"
  respondedAt DateTime?
  note        String?   // optional player note e.g. "arriving 10 min late"
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  player User @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, entityType, entityId])
}
```

### 2.3 New model: `NotificationLog`

Audit trail of every push notification sent. Used to prevent duplicate sends
and to track delivery.

```prisma
model NotificationLog {
  id           String    @id @default(cuid())
  userId       String
  type         String
  // rsvp_request | rsvp_response | analysis_ready |
  // match_reminder | subscription_grace | subscription_expired
  entityType   String?   // "training" | "game" | "match"
  entityId     String?
  title        String
  body         String
  sentAt       DateTime  @default(now())
  deliveryStatus String  @default("sent") // sent | failed | stale

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 2.4 Additions to `User` model

```prisma
// Add to User model — notification preferences
notifRsvpRequests   Boolean @default(true)  // receive RSVP requests (players)
notifRsvpResponses  Boolean @default(true)  // receive RSVP responses (managers)
notifMatchReminder  Boolean @default(true)  // receive game reminders
notifTrainingReminder Boolean @default(true) // receive training reminders
notifAnalysisReady  Boolean @default(true)  // receive analysis ready (managers)
```

### 2.5 Additions to `TrainingSession` model

```prisma
// Add to TrainingSession model
rsvpEnabled         Boolean   @default(true)
rsvpDeadline        DateTime? // null = no deadline
autoReminderSent    Boolean   @default(false)  // has the 24h auto-reminder fired
autoReminderTime    DateTime? // defaults to 24h before session, overridable
```

### 2.6 Additions to `Match` model

```prisma
// Add to Match model (playing matches only)
rsvpEnabled         Boolean   @default(true)
rsvpDeadline        DateTime? // null = no deadline
autoReminderSent    Boolean   @default(false)
autoReminderTime    DateTime? // defaults to 24h before match
```

---

## 3. VAPID setup

### 3.1 Dependencies

```bash
npm install web-push
npm install -D @types/web-push
```

### 3.2 Generate VAPID keys (one time)

```bash
npx web-push generate-vapid-keys
```

Store the output in `.env`:

```env
VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_MAILTO=mailto:you@yourdomain.com
```

The `VAPID_PUBLIC_KEY` is exposed to the frontend (it is not secret). Add to
`web/.env`:

```env
VITE_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.3 Initialise web-push (`api/src/lib/push.ts`)

```typescript
import webpush from 'web-push'
import { prisma } from './prisma'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title:    string
  body:     string
  icon?:    string   // defaults to /icons/icon-192.png
  badge?:   string   // defaults to /icons/badge-72.png
  url?:     string   // deep link opened on notification tap
  tag?:     string   // replaces previous notification with same tag
  data?:    Record<string, unknown>
}

export async function sendPushToUser(
  userId:  string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  })

  if (subscriptions.length === 0) return

  const notification = JSON.stringify({
    title:  payload.title,
    body:   payload.body,
    icon:   payload.icon  ?? '/icons/icon-192.png',
    badge:  payload.badge ?? '/icons/badge-72.png',
    url:    payload.url   ?? '/',
    tag:    payload.tag,
    data:   payload.data,
  })

  await Promise.allSettled(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription),
          notification
        )
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data:  { lastUsedAt: new Date() }
        })
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid — remove it
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
      }
    })
  )
}

export async function sendPushToTeam(
  teamId:       string,
  payload:      PushPayload,
  options?: {
    roles?:          ('manager' | 'player')[]  // filter by role
    excludeUserId?:  string                    // exclude the sender
    notifType?:      keyof User                // check user preference field
  }
): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: {
      teamId,
      ...(options?.roles ? { role: { in: options.roles } } : {}),
      ...(options?.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
    },
    include: { user: true }
  })

  const eligible = options?.notifType
    ? members.filter(m => m.user[options.notifType!] === true)
    : members

  await Promise.all(
    eligible.map(m => sendPushToUser(m.userId, payload))
  )
}
```

---

## 4. Frontend — subscription management

### 4.1 Helper utility (`web/src/lib/pushSubscription.ts`)

```typescript
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(subscription.toJSON()),
  })

  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await subscription.unsubscribe()

  await fetch('/api/push/unsubscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint: subscription.endpoint }),
  })
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}
```

### 4.2 When to prompt for permission

Do **not** prompt for push permission on first app load — browsers block
auto-prompts and users reject them without context.

Prompt at two specific moments:

1. **End of onboarding** — after the manager or player completes their profile
   setup, show a contextual prompt:
   ```
   Stay in the loop

   Get notified when players confirm attendance, when
   analysis is ready, and before your next match.

   [Turn on notifications]    [Not now]
   ```

2. **When a manager first taps "Send reminder"** — if they haven't subscribed yet:
   ```
   To send reminders, Courtside needs notification
   permission on your device too.

   [Enable notifications]    [Cancel]
   ```

Store a `pushPromptDismissed` flag in localStorage. If the user dismisses twice,
stop prompting automatically — they can enable from Settings.

### 4.3 Service worker (`web/public/sw.ts`)

```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  const data = event.data.json() as {
    title:  string
    body:   string
    icon?:  string
    badge?: string
    url?:   string
    tag?:   string
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon  ?? '/icons/icon-192.png',
      badge: data.badge ?? '/icons/badge-72.png',
      tag:   data.tag,
      data:  { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // If app is already open, focus it and navigate
        const existing = clients.find(c => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(url)
          return
        }
        // Otherwise open a new window
        return self.clients.openWindow(url)
      })
  )
})
```

---

## 5. API routes

### 5.1 Subscription management

```
POST   /api/push/subscribe      register a device subscription
POST   /api/push/unsubscribe    remove a device subscription
GET    /api/push/status         check if current device is subscribed
```

```typescript
// POST /api/push/subscribe
router.post('/push/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys, expirationTime } = req.body
  const userAgent = req.headers['user-agent'] ?? ''
  const deviceLabel = parseDeviceLabel(userAgent) // "iPhone 15", "Chrome on Android", etc.

  await prisma.pushSubscription.upsert({
    where:  { userId_endpoint: { userId: req.user.id, endpoint } },  // add @@unique
    update: { subscription: JSON.stringify(req.body), lastUsedAt: new Date() },
    create: {
      userId:       req.user.id,
      subscription: JSON.stringify(req.body),
      deviceLabel,
    }
  })

  res.json({ success: true })
})
```

Add `@@unique([userId, endpoint])` to `PushSubscription` model so a user
can't have duplicate subscriptions for the same device endpoint.

### 5.2 RSVP

```
POST  /api/rsvp                       create or update an RSVP
GET   /api/rsvp/:entityType/:entityId  get all RSVPs for a training/game
GET   /api/rsvp/me/:entityType/:entityId  get current user's RSVP
```

```typescript
// POST /api/rsvp
router.post('/rsvp', requireAuth, async (req, res) => {
  const { entityType, entityId, status, note } = req.body
  // status: "confirmed" | "declined" | "maybe"

  const rsvp = await prisma.rsvp.upsert({
    where:  { playerId_entityType_entityId: {
      playerId: req.user.id, entityType, entityId
    }},
    update: { status, note, respondedAt: new Date() },
    create: { playerId: req.user.id, entityType, entityId, status, note,
              respondedAt: new Date() }
  })

  // Notify the team manager(s)
  const teamId = await getTeamIdForEntity(entityType, entityId)
  const player = await prisma.user.findUnique({ where: { id: req.user.id } })

  const emoji   = status === 'confirmed' ? '✅' : status === 'declined' ? '❌' : '🤔'
  const label   = status === 'confirmed' ? 'confirmed' : status === 'declined' ? 'declined' : 'marked as maybe'
  const dLabel  = status === 'bestätigt' ? '' : '' // handled by locale in notification

  await sendPushToTeam(teamId, {
    title: `${player?.firstName} ${player?.lastName} ${label}`,
    body:  note
      ? `"${note}"`
      : entityType === 'training'
        ? 'For the training session'
        : 'For the match',
    url:   entityType === 'training'
      ? `/trainings/${entityId}`
      : `/games/${entityId}`,
    tag:   `rsvp-${entityType}-${entityId}`,  // groups multiple responses
  }, {
    roles:         ['manager'],
    excludeUserId: req.user.id,
    notifType:     'notifRsvpResponses',
  })

  res.json({ rsvp })
})
```

### 5.3 Send reminder (manual)

```
POST /api/notifications/reminder
Body: { entityType: "training" | "game", entityId: string, message?: string }
Auth: manager only
```

```typescript
router.post('/notifications/reminder', requireAuth, requireManagerRole, async (req, res) => {
  const { entityType, entityId, message } = req.body

  const entity  = await getEntity(entityType, entityId)
  const teamId  = entity.teamId
  const players = await getTeamPlayers(teamId)

  const title   = entityType === 'training'
    ? `Training reminder: ${entity.name}`
    : `Match reminder: vs ${entity.opponent}`

  const body = message ?? (
    entityType === 'training'
      ? `${formatDateTime(entity.date)} · ${entity.location ?? 'Location TBC'} — please confirm your attendance`
      : `${formatDateTime(entity.date)} · ${entity.location ?? 'Location TBC'} — please confirm your availability`
  )

  await sendPushToTeam(teamId, {
    title,
    body,
    url:  entityType === 'training' ? `/trainings/${entityId}` : `/games/${entityId}`,
    tag:  `reminder-${entityType}-${entityId}`,
  }, {
    roles:         ['player'],
    notifType:     entityType === 'training' ? 'notifTrainingReminder' : 'notifMatchReminder',
  })

  // Log the manual send
  await prisma.notificationLog.createMany({
    data: players.map(p => ({
      userId:     p.id,
      type:       'rsvp_request',
      entityType,
      entityId,
      title,
      body,
    }))
  })

  res.json({ sent: players.length })
})
```

### 5.4 Analysis ready notification

Called from the analysis microservice after `status = 'ready'`:

```typescript
// api/src/lib/notifications.ts
export async function notifyAnalysisReady(matchId: string, teamId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })

  await sendPushToTeam(teamId, {
    title: 'Match analysis ready',
    body:  `Your post-match analysis for vs ${match?.opponent} is ready to view`,
    url:   `/games/${matchId}/stats`,
    tag:   `analysis-${matchId}`,
  }, {
    roles:     ['manager'],
    notifType: 'notifAnalysisReady',
  })
}
```

---

## 6. RSVP flow (end to end)

### 6.1 Manager sends a reminder

The manager opens a training session or game detail page. They see the current
RSVP summary and a "Send reminder" button.

**RSVP summary card:**

```
ATTENDANCE                              [Send reminder]
──────────────────────────────────────────────────────
✅ Confirmed    5   Sara K. · Tom C. · Romeo S. …
❌ Declined     1   Larry S.
🤔 Maybe        2   Paul C. · Yuji T.
⏳ No response  4   Mark W. · Randy K. …
```

Tapping "Send reminder" opens a bottom sheet:

```
Send reminder

Training: Montagstraining
Mon 8 Jun · 20:30 · Weiherhofhalle

[Send to all players]
[Send to no-response only]  ← default, recommended

Custom message (optional):
┌────────────────────────────────┐
│ Please confirm by Sunday 18:00 │
└────────────────────────────────┘

Reminder will be sent to 4 players.

[Send now]
```

After sending: "Reminder sent to 4 players" toast confirmation.

The "Send reminder" button shows a cooldown indicator if a reminder was sent
within the last hour: "Sent 23 min ago — send again?" to prevent spam.

### 6.2 Player receives the notification

On the player's device (even if the app is closed):

```
┌─────────────────────────────────────┐
│ 🏐 Courtside                        │
│ Training reminder: Montagstraining  │
│ Mon 8 Jun · 20:30 · Weiherhofhalle  │
│ Please confirm by Sunday 18:00      │
└─────────────────────────────────────┘
```

Tapping the notification opens the app directly to the training/game detail page.

### 6.3 Player responds in the app

The training/game detail page shows a prominent RSVP card for players who
haven't responded (or want to change their response):

```
┌──────────────────────────────────────────┐
│ Are you coming?                          │
│ Montagstraining · Mon 8 Jun · 20:30      │
│                                          │
│ [✅ Yes]    [🤔 Maybe]    [❌ No]         │
│                                          │
│ Add a note (optional)                    │
│ ┌──────────────────────────────────┐     │
│ │ Arriving 10 min late             │     │
│ └──────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

All three buttons are equal size (minimum 48px height). Tapping any of them:
- Updates the RSVP record immediately (optimistic UI)
- Sends a push notification to the manager(s)
- Shows a brief confirmation: "Response saved ✓"

The RSVP card stays visible after responding so the player can change their
answer — tapping a different button updates their response.

### 6.4 Manager receives the response notification

```
┌─────────────────────────────────────┐
│ 🏐 Courtside                        │
│ Sara Kowalski confirmed              │
│ For the training session             │
└─────────────────────────────────────┘
```

If multiple players respond within a short window, notifications are grouped
by the `tag` field (browsers collapse them into a summary):

```
┌─────────────────────────────────────┐
│ 🏐 Courtside · 3 responses          │
│ Sara K., Tom C., Romeo S.           │
│ For Montagstraining                 │
└─────────────────────────────────────┘
```

Tapping the notification opens the attendance summary for that session.

---

## 7. Automatic reminders (cron)

The cron job checks for upcoming sessions and games that haven't had their
auto-reminder sent yet.

```typescript
// api/src/jobs/reminders.ts
import cron from 'node-cron'

// Runs every 15 minutes — checks for sessions starting in ~24 hours
cron.schedule('*/15 * * * *', async () => {
  const now        = new Date()
  const in24h      = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h      = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Training sessions
  const trainings = await prisma.trainingSession.findMany({
    where: {
      rsvpEnabled:     true,
      autoReminderSent: false,
      autoReminderTime: { gte: now, lte: in25h }
      // autoReminderTime defaults to 24h before session.date
      // but can be overridden by the manager
    },
    include: { team: true }
  })

  for (const training of trainings) {
    await sendRsvpReminderForEntity('training', training.id, training.teamId)
    await prisma.trainingSession.update({
      where: { id: training.id },
      data:  { autoReminderSent: true }
    })
  }

  // Games (playing matches only)
  const matches = await prisma.match.findMany({
    where: {
      matchType:       'playing',
      rsvpEnabled:     true,
      autoReminderSent: false,
      status:          'upcoming',
      autoReminderTime: { gte: now, lte: in25h }
    },
    include: { team: true }
  })

  for (const match of matches) {
    await sendRsvpReminderForEntity('game', match.id, match.teamId)
    await prisma.match.update({
      where: { id: match.id },
      data:  { autoReminderSent: true }
    })
  }
})
```

Helper that sends to all players who haven't yet responded:

```typescript
async function sendRsvpReminderForEntity(
  entityType: 'training' | 'game',
  entityId:   string,
  teamId:     string
) {
  // Find players with no RSVP yet
  const allPlayers = await getTeamPlayers(teamId)
  const responded  = await prisma.rsvp.findMany({
    where: { entityType, entityId },
    select: { playerId: true }
  })
  const respondedIds  = new Set(responded.map(r => r.playerId))
  const noResponse    = allPlayers.filter(p => !respondedIds.has(p.id))

  if (noResponse.length === 0) return

  const entity = await getEntity(entityType, entityId)

  const title = entityType === 'training'
    ? `Training reminder: ${entity.name}`
    : `Match reminder: vs ${entity.opponent}`

  const body = `${formatDateTime(entity.date)} · ${entity.location ?? 'TBC'} — please confirm your attendance`

  await Promise.all(
    noResponse.map(player => {
      const prefField = entityType === 'training'
        ? 'notifTrainingReminder'
        : 'notifMatchReminder'
      if (!player[prefField]) return  // respect opt-out
      return sendPushToUser(player.id, {
        title,
        body,
        url: entityType === 'training' ? `/trainings/${entityId}` : `/games/${entityId}`,
        tag: `reminder-${entityType}-${entityId}`,
      })
    })
  )
}
```

### 7.1 Setting the auto-reminder time

When a manager creates or edits a training session or game, the reminder time
defaults to 24 hours before the session. They can override it:

In the create/edit form, below the date/time fields:

```
REMINDER
────────────────────────────────────────
Auto-remind players   [toggle: ON]

Send reminder:
  ● 24 hours before   (default)
  ○ 48 hours before
  ○ 1 week before
  ○ Custom time
```

Selecting "Custom time" shows a date-time picker. The selected time is stored
as `autoReminderTime` on the session/match record.

If the session is created with less than 24 hours until the event, the
auto-reminder fires immediately (within the next cron cycle).

---

## 8. Notification settings (player and manager)

In the Settings page, a "Notifications" section appears for all users.

### 8.1 UI

```
NOTIFICATIONS
─────────────────────────────────────────────────────

Push notifications
● Enabled on this device    [Disable]

─────────────────────────────────────────────────────

WHAT TO NOTIFY ME ABOUT

Training reminders          [toggle]
  Get reminded before training sessions

Match reminders             [toggle]
  Get reminded before games

(managers only)
Player responses            [toggle]
  When a player confirms, declines, or marks maybe

Analysis ready              [toggle]
  When post-match analysis is complete

─────────────────────────────────────────────────────

Push notifications only work when Courtside is
added to your home screen on iPhone.
[Learn more]
```

### 8.2 Enabling / disabling per notification type

Each toggle calls `PATCH /api/auth/me` with the relevant preference field:

```typescript
{ notifTrainingReminder: false }  // player turns off training reminders
{ notifRsvpResponses: false }     // manager turns off response notifications
```

This is stored in the DB and checked by `sendPushToTeam()` before every send.

### 8.3 Disabling push entirely

Tapping "Disable" on the device row:
1. Calls `unsubscribeFromPush()` on the frontend (removes browser subscription)
2. Calls `POST /api/push/unsubscribe` to delete the `PushSubscription` record
3. The "Push notifications · Enabled on this device" row changes to
   "Push notifications · Disabled · [Enable]"

To re-enable, the user taps "Enable" which calls `subscribeToPush()` and
re-prompts for browser permission if needed.

---

## 9. Notification types reference

Full list of all notification types sent by Courtside.

| Type | Recipient | Trigger | Preference field |
|---|---|---|---|
| `rsvp_request` | Players | Manager sends reminder (manual or auto) | `notifTrainingReminder` / `notifMatchReminder` |
| `rsvp_response_confirmed` | Managers | Player confirms attendance | `notifRsvpResponses` |
| `rsvp_response_declined` | Managers | Player declines attendance | `notifRsvpResponses` |
| `rsvp_response_maybe` | Managers | Player marks as maybe | `notifRsvpResponses` |
| `analysis_ready` | Managers | Analysis microservice completes | `notifAnalysisReady` |
| `match_reminder` | Players | Auto-reminder 24h before game | `notifMatchReminder` |
| `training_reminder` | Players | Auto-reminder 24h before training | `notifTrainingReminder` |

---

## 10. RSVP summary in training and game detail pages

Both the training detail page and the game detail page show a live RSVP
summary visible to the manager.

### 10.1 Manager view

```
ATTENDANCE (12 players)
─────────────────────────────────────────────────────
✅ Confirmed  5    Sara K. · Tom C. · Romeo S.
             D. Wright · J. Miller

❌ Declined   1    Larry S.
              "Away that week"

🤔 Maybe      2    Paul C. · Yuji T.

⏳ No reply   4    Mark W. · Randy K.
             T. Chen · M. Vance

[Send reminder to 6 players ▾]
```

The "Send reminder" button defaults to "no reply + maybe" recipients. The
dropdown lets the manager choose: all players / no reply only / maybe + no reply.

### 10.2 Player view

Players see only their own status and a simplified count:

```
ARE YOU COMING?
Montagstraining · Mon 8 Jun · 20:30

[✅ Yes]    [🤔 Maybe]    [❌ No]

7 players have responded
```

Players cannot see other players' individual responses — only the aggregate
count. This avoids social pressure dynamics where a player's decline influences
others.

---

## 11. Internationalisation

All notification titles and bodies must respect the user's `locale` setting.
Wrap notification content in a locale-aware helper:

```typescript
// api/src/lib/notificationContent.ts
type Locale = 'en' | 'de'

export function rsvpRequestContent(
  entityType: 'training' | 'game',
  entityName: string,
  dateTime:   string,
  location:   string,
  locale:     Locale
) {
  if (locale === 'de') return {
    title: entityType === 'training'
      ? `Trainingserinnerung: ${entityName}`
      : `Spielerinnerung: ${entityName}`,
    body:  `${dateTime} · ${location} — bitte Teilnahme bestätigen`,
  }
  return {
    title: entityType === 'training'
      ? `Training reminder: ${entityName}`
      : `Match reminder: ${entityName}`,
    body:  `${dateTime} · ${location} — please confirm your attendance`,
  }
}

export function rsvpResponseContent(
  playerName: string,
  status:     'confirmed' | 'declined' | 'maybe',
  locale:     Locale
) {
  const statusLabels = {
    en: { confirmed: 'confirmed', declined: 'declined', maybe: 'marked as maybe' },
    de: { confirmed: 'hat zugesagt', declined: 'hat abgesagt', maybe: 'ist unsicher' },
  }
  return {
    title: `${playerName} ${statusLabels[locale][status]}`,
    body:  locale === 'de' ? 'Für die Trainingseinheit' : 'For the training session',
  }
}

export function analysisReadyContent(opponent: string, locale: Locale) {
  if (locale === 'de') return {
    title: 'Spielanalyse bereit',
    body:  `Deine Nachspielanalyse gegen ${opponent} ist jetzt verfügbar`,
  }
  return {
    title: 'Match analysis ready',
    body:  `Your post-match analysis vs ${opponent} is ready to view`,
  }
}
```

Pass `req.user.locale` or the target user's `locale` from the DB into every
notification content function.

---

## 12. Implementation order

1. **Dependencies** — `npm install web-push` + `npm install -D @types/web-push`

2. **Generate VAPID keys** — store in `.env` and `web/.env`

3. **DB migration** — `PushSubscription`, `Rsvp`, `NotificationLog`,
   additions to `User`, `TrainingSession`, `Match` (§2)

4. **Service worker** — create `web/public/sw.ts`, register in `web/src/main.tsx`

5. **Frontend subscription utilities** — `web/src/lib/pushSubscription.ts` (§4.1)

6. **Backend push utility** — `api/src/lib/push.ts` with `sendPushToUser()`
   and `sendPushToTeam()` (§3.3)

7. **Subscription API routes** — `POST /api/push/subscribe`,
   `POST /api/push/unsubscribe`, `GET /api/push/status` (§5.1)

8. **Permission prompt in onboarding** — contextual, not on first load (§4.2)

9. **RSVP API route** — `POST /api/rsvp` with manager push notification (§5.2)

10. **Manual reminder route** — `POST /api/notifications/reminder` (§5.3)

11. **RSVP UI** — attendance summary card on training/game detail pages,
    player RSVP response card (§6.1, §6.3)

12. **Reminder settings in create/edit forms** — auto-reminder time override (§7.1)

13. **Auto-reminder cron job** — runs every 15 minutes (§7)

14. **Notification settings in Settings page** — per-type toggles (§8)

15. **Analysis ready notification** — called from analysis microservice
    after `status = 'ready'` (§5.4)

16. **i18n for notification content** — `notificationContent.ts` (§11)

---

## 13. Environment variables

```env
# api/.env additions
VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_MAILTO=mailto:you@yourdomain.com

# web/.env additions
VITE_VAPID_PUBLIC_KEY=B...
```
