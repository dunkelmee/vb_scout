# Rallytics — Auth, Invitation & Multi-Team To-Do List

---

## 1. Database schema changes

All changes go in `api/prisma/schema.prisma`.

- [ ] Update `users` model
  ```prisma
  model User {
    id               String    @id @default(cuid())
    email            String    @unique
    passwordHash     String
    firstName        String
    lastName         String
    role             String    @default("player")  // superadmin | manager | player
    onboardingDone   Boolean   @default(false)
    createdAt        DateTime  @default(now())
    updatedAt        DateTime  @updatedAt

    teamMemberships    TeamMember[]
    inviteCodesCreated InviteCode[]     @relation("CreatedBy")
    pushSubscriptions  PushSubscription[]
  }
  ```
  - `googleId` column is intentionally **omitted** for now — add when Google OAuth
    is implemented
  - `passwordHash` is non-nullable — all users register with email + password for now

- [ ] Create `TeamMember` join table (replaces single `team_id` on users)
  ```prisma
  model TeamMember {
    id        String   @id @default(cuid())
    userId    String
    teamId    String
    role      String              // manager | player
    isDefault Boolean @default(false)   // team shown on login
    joinedAt  DateTime @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

    @@unique([userId, teamId])
  }
  ```

- [ ] Create `InviteCode` model
  ```prisma
  model InviteCode {
    id          String    @id @default(cuid())
    code        String    @unique   // 8-char uppercase alphanumeric e.g. "VB3X9KQM"
    codeHash    String    @unique   // bcrypt hash — what is checked on redemption
    role        String              // manager | player
    teamId      String?             // null for superadmin-generated manager codes
    boundEmail  String?             // if set, only this email address can redeem the code
    createdById String
    usedById    String?
    usedAt      DateTime?
    expiresAt   DateTime            // 7 days from creation
    maxUses     Int       @default(1)
    useCount    Int       @default(0)
    emailSentAt DateTime?           // null if email not yet sent or no email was requested
    createdAt   DateTime  @default(now())

    team      Team? @relation(fields: [teamId], references: [id], onDelete: SetNull)
    createdBy User  @relation("CreatedBy", fields: [createdById], references: [id])
  }
  ```

  Key additions vs the previous version:
  - `boundEmail` — when set, the registration endpoint rejects any attempt to
    redeem the code with a different email address. For manager invites created by
    the superadmin this is **always set**. For player invites created by managers
    it is optional — managers may want to generate a code and share it verbally
    rather than by email.
  - `emailSentAt` — tracks whether the invitation email was successfully handed
    to Resend. If Resend fails the code still exists and the superadmin can
    trigger a resend manually.

- [ ] Run migration
  ```bash
  npx prisma migrate dev --name add_invite_codes_multi_team
  ```

---

## 2. Invitation code system

### 2.1 Code generation (backend)

- [ ] Create `api/src/lib/inviteCode.ts`
  - `generateCode()` — 8-char random uppercase alphanumeric (e.g. `VB3X9KQM`)
  - Store only the `bcrypt` hash in the DB; return plaintext to the creator once
  - Display format in the UI: split into two groups of 4 separated by a dot
    (`VB3X · 9KQM`) — strip the separator before validating
- [ ] Add invite code routes in `api/src/routes/invites.ts`
  - `POST /api/invites`
    - Body: `{ role: 'manager' | 'player', teamId?: string, maxUses?: number, boundEmail?: string }`
    - **Superadmin creating a manager code: `boundEmail` is required**
    - Manager creating a player code: `boundEmail` is optional; `teamId` auto-filled
    - After creating the DB record, if `boundEmail` is set → call
      `sendInviteEmail()` from `api/src/lib/email.ts` (see §2.4)
    - If the email send fails, the code is still created and saved — do not roll
      back. Set `emailSentAt = null` to indicate the email was not sent.
      Return the code to the caller with a `emailSent: false` flag so the
      superadmin knows to retry.
    - Returns:
      ```typescript
      {
        code:       'VB3X9KQM',   // plaintext — shown once, never stored
        expiresAt:  Date,
        role:       'manager',
        teamId:     null,
        boundEmail: 'coach@example.de',
        emailSent:  true,
      }
      ```
  - `GET /api/invites` — list all codes created by the current user
    - Returns code metadata only — **never the plaintext again after creation**
    - Include `emailSentAt` so the UI can show "Email pending" if null
  - `DELETE /api/invites/:id` — revoke a code
  - `POST /api/invites/:id/resend` — resend the invitation email
    - Superadmin only
    - Only valid if the code has a `boundEmail`, is not yet used, and is not expired
    - Calls `sendInviteEmail()` again and updates `emailSentAt`
  - `POST /api/invites/validate` — check a code without auth
    - Body: `{ code: string }`
    - Returns: `{ valid: boolean, role, teamName, invitedBy }` or `{ valid: false, reason }`
    - **Does not reveal `boundEmail` to the client** — the binding is enforced
      silently at registration time
    - Rate-limited: 100 req/hour per IP (see §9)

### 2.2 Code redemption during registration

- [ ] Update `POST /api/auth/register`
  - Required body: `{ firstName, lastName, email, password, inviteCode }`
  - Validate invite code: exists, not expired, `useCount < maxUses`
  - **If `inviteCode.boundEmail` is set: verify it matches the submitted `email`
    (case-insensitive). Reject with `422` if they differ.**
    - Error message: "This invitation was sent to a different email address."
    - Do not reveal which email address the code is bound to.
  - On success:
    - Hash password with bcrypt (rounds = 12)
    - Create `User` record
    - Create `TeamMember` record linking user to the code's `teamId` and `role`
    - Increment `useCount` on the invite code; set `usedAt` and `usedById`
    - Issue JWT access token (15 min) + refresh token (30 days)
    - Send welcome email via Resend (see §2.4)
    - Return `{ user, teamId, isFirstLogin: true }` — frontend routes to `/onboarding`
  - Error responses:
    - `400` — missing fields, invalid password length
    - `409` — email already registered
    - `422` — invite code invalid, expired, or fully used
    - `422` — invite code is bound to a different email address

### 2.3 Player joining additional teams

- [ ] Add `POST /api/teams/join`
  - Auth required (any role)
  - Body: `{ inviteCode: string }`
  - Validates: code is valid, user is not already a member of that team
  - **If `boundEmail` is set: verify it matches the authenticated user's email**
  - Creates new `TeamMember` record
  - Returns the new `Team` object
- [ ] Frontend: Settings page → "Join another team" section
  - Shown in the team switcher bottom sheet as the last row ("+ Join another team")
  - Also accessible from Settings → Teams
  - Input field for invite code with the same live-preview behaviour as registration
  - On success: new team appears in the switcher immediately (optimistic update)

---

### 2.4 Resend email integration

### Setup

- [ ] Install Resend
  ```bash
  npm install resend
  ```
- [ ] Add to `api/.env`
  ```env
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
  RESEND_FROM=Rallytics <noreply@yourdomain.com>
  APP_URL=http://localhost:3004
  ```
- [ ] Verify your sending domain in the Resend dashboard
  - Add the DNS TXT record they provide to your domain registrar
  - This takes ~5 minutes and is required before any email can be sent
  - During development you can use `onboarding@resend.dev` as the `from` address
    to avoid needing a verified domain yet

### Email client (`api/src/lib/email.ts`)

- [ ] Create `api/src/lib/email.ts`

  ```typescript
  import { Resend } from 'resend'

  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM   = process.env.RESEND_FROM ?? 'Rallytics <noreply@rallytics.app>'
  const APP    = process.env.APP_URL     ?? 'http://localhost:3004'

  // ── 1. Manager/coach invitation (superadmin → new manager) ──────────────────
  export async function sendManagerInviteEmail(params: {
    to:        string   // the boundEmail on the invite code
    code:      string   // plaintext code e.g. "VB3X9KQM"
    expiresAt: Date
    invitedBy: string   // superadmin display name
  }): Promise<boolean> {
    const formatted  = params.code.slice(0,4) + ' · ' + params.code.slice(4)
    const registerUrl = `${APP}/auth/register`
    const expiry      = params.expiresAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

    try {
      await resend.emails.send({
        from:    FROM,
        to:      params.to,
        subject: 'You have been invited to Rallytics',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
            <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">Rallytics</div>
            <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">Volleyball analytics for your team</p>

            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">
              You've been invited to manage a team on Rallytics
            </h2>
            <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
              ${params.invitedBy} has invited you to join as a <strong>Head Coach / Team Manager</strong>.
              Use the code below when registering.
            </p>

            <div style="background:#161412;border:1px solid rgba(35,181,211,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:11px;font-weight:600;color:#23B5D3;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px;">
                Your invitation code
              </div>
              <div style="font-size:32px;font-weight:800;color:#23B5D3;letter-spacing:0.18em;">
                ${formatted}
              </div>
              <div style="font-size:11px;color:#4A4A5A;margin-top:10px;">
                Valid until ${expiry} · single use
              </div>
            </div>

            <a href="${registerUrl}"
               style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
              Create your account →
            </a>

            <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
              Go to ${registerUrl}, paste your invitation code, and complete your registration.
              If you did not expect this email you can ignore it — the code will expire automatically.
            </p>
          </div>
        `,
      })
      return true
    } catch (err) {
      console.error('[Resend] Manager invite email failed:', err)
      return false
    }
  }

  // ── 2. Player invitation (manager → new player) ──────────────────────────────
  export async function sendPlayerInviteEmail(params: {
    to:        string
    code:      string
    teamName:  string
    expiresAt: Date
    invitedBy: string
  }): Promise<boolean> {
    const formatted   = params.code.slice(0,4) + ' · ' + params.code.slice(4)
    const registerUrl = `${APP}/auth/register`
    const expiry      = params.expiresAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

    try {
      await resend.emails.send({
        from:    FROM,
        to:      params.to,
        subject: `${params.invitedBy} invited you to join ${params.teamName} on Rallytics`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
            <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">Rallytics</div>
            <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">Volleyball analytics for your team</p>

            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">
              You've been invited to join ${params.teamName}
            </h2>
            <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
              ${params.invitedBy} has invited you to join as a <strong>Player</strong>.
            </p>

            <div style="background:#161412;border:1px solid rgba(35,181,211,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:11px;font-weight:600;color:#23B5D3;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px;">
                Your invitation code
              </div>
              <div style="font-size:32px;font-weight:800;color:#23B5D3;letter-spacing:0.18em;">
                ${formatted}
              </div>
              <div style="font-size:11px;color:#4A4A5A;margin-top:10px;">
                Valid until ${expiry} · single use
              </div>
            </div>

            <a href="${registerUrl}"
               style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
              Create your account →
            </a>

            <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
              Go to ${registerUrl} and paste the invitation code to register.
              If you were not expecting this you can safely ignore it.
            </p>
          </div>
        `,
      })
      return true
    } catch (err) {
      console.error('[Resend] Player invite email failed:', err)
      return false
    }
  }

  // ── 3. Welcome email (sent after successful registration) ────────────────────
  export async function sendWelcomeEmail(params: {
    to:        string
    firstName: string
    teamName:  string
    role:      'manager' | 'player'
  }): Promise<boolean> {
    const dashboardUrl = `${APP}/dashboard`

    try {
      await resend.emails.send({
        from:    FROM,
        to:      params.to,
        subject: `Welcome to Rallytics, ${params.firstName}!`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
            <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">Rallytics</div>

            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">
              Welcome, ${params.firstName}! 🏐
            </h2>
            <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
              Your account has been created and you've joined
              <strong style="color:#F7F7FF;">${params.teamName}</strong>
              as a <strong>${params.role === 'manager' ? 'Head Coach / Team Manager' : 'Player'}</strong>.
            </p>

            <a href="${dashboardUrl}"
               style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
              Go to your dashboard →
            </a>

            <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
              Track every rally, rotation, and momentum shift — live on the court.
            </p>
          </div>
        `,
      })
      return true
    } catch (err) {
      console.error('[Resend] Welcome email failed:', err)
      return false
    }
  }
  ```

### Where each email is triggered

| Email | Trigger | Function |
|---|---|---|
| Manager invitation | `POST /api/invites` (superadmin, manager code) | `sendManagerInviteEmail()` |
| Player invitation | `POST /api/invites` (manager, player code, with `boundEmail`) | `sendPlayerInviteEmail()` |
| Welcome | `POST /api/auth/register` on success | `sendWelcomeEmail()` |
| Resend invite | `POST /api/invites/:id/resend` | same function as original |

### Important behaviour notes

- Email sending is **fire-and-forget** — do not `await` the send call in a way
  that blocks the API response. The code is created and returned regardless.
  ```typescript
  // In POST /api/invites:
  const emailSent = await sendManagerInviteEmail({ to, code, expiresAt, invitedBy })
  await prisma.inviteCode.update({
    where: { id: newCode.id },
    data:  { emailSentAt: emailSent ? new Date() : null }
  })
  // Return the code to the caller with emailSent flag
  ```
- The plaintext `code` is passed to the email function **before** being discarded.
  The hash is what's stored in the DB. The email function receives the plaintext
  and formats it for display.
- Email failures are logged to the console but do not cause the API to return an
  error. The superadmin can retry via `POST /api/invites/:id/resend`.
- During local development, Resend can be disabled by omitting `RESEND_API_KEY`.
  Add a guard in `email.ts`:
  ```typescript
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set — skipping email send')
    return false
  }
  ```

---

## 3. Auth pages — UI implementation

All screens are built using the design mocks already produced. Refer to
`auth_dashboard_teamswitch.html` and `google_oauth_flow.html` for exact layouts.

### 3.1 Login page (`/auth/login`)

- [ ] Build the full-bleed gradient hero (turquoise top-right, blue bottom-left)
  with the SVG volleyball wireframe decoration and heavy grain layer (45% opacity)
- [ ] Form panel as a glassmorphic card (`backdrop-filter: blur(20px)`)
  - Email input with mail icon
  - Password input with lock icon
  - "Forgot password?" link (right-aligned, turquoise) — placeholder route for now
  - Primary CTA: "Sign in" with turquoise→blue gradient
- [ ] "Continue with Google" button — renders as a visible button **but is non-functional**
  - `onClick`: show a toast / modal: "Google sign-in is coming soon"
  - Do **not** wire up any OAuth redirect
  - Do **not** install any OAuth dependencies
- [ ] "No account yet? Create one →" link → `/auth/register`
- [ ] On successful login: redirect to `/dashboard`
  - If `isFirstLogin = true` on the returned user → redirect to `/onboarding` instead

### 3.2 Register page (`/auth/register`)

- [ ] Back button → `/auth/login`
- [ ] Full-bleed gradient hero (pink top-right, turquoise bottom-left), same grain
- [ ] **Invite code field — most prominent element at the top of the form panel**
  - Highlighted container with turquoise border and key icon
  - Input styled with large monospaced characters, centered, uppercase
  - On paste/blur: call `POST /api/invites/validate`
    - Valid → show preview row: "Joining [Team Name] as [Role] · Invited by [Name] ✓"
    - Invalid / expired → show error: "This code is invalid or has expired"
    - Loading state while the API call is in flight
  - Input accepts format `VB3X9KQM` or `VB3X · 9KQM` — strip whitespace and dots before sending
- [ ] Role toggle (Head Coach / Team Manager)
  - Shown but **auto-set and locked** once a valid invite code is entered
  - The role displayed matches what the invite code specifies
  - Greyed out with a tooltip "Role is set by your invitation code" when locked
- [ ] Team name field — pre-filled from the invite code validation response, editable
- [ ] First name + Last name — two-column row
- [ ] Email input
- [ ] Password input with strength indicator bar (4 segments: weak=pink, mid=blue, strong=turquoise)
- [ ] Terms checkbox (pre-styled, not a native checkbox)
- [ ] Primary CTA: "Create team account" with pink→turquoise→blue gradient
- [ ] "Sign up with Google" button — **non-functional, same toast as login**
- [ ] "Already have an account? Sign in →" → `/auth/login`
- [ ] On successful registration → redirect to `/onboarding`

---

## 4. Onboarding flow (`/onboarding`)

- [ ] Route guard: if `user.onboardingDone === true` → redirect to `/dashboard`
- [ ] Progress tracker at top showing 4 steps with connector lines
  - Done steps: turquoise filled circle with check icon
  - Current step: gradient filled circle
  - Pending steps: dimmed circle, faint text

### 4.1 Manager onboarding steps

**Step 1 — Team confirmed** (auto-completed)
- Show the team name card (logo initials + team name + role tag)
- This step is marked done immediately on arrival — no action required
- Auto-advance to step 2 display

**Step 2 — Add first players**
- [ ] Simplified inline player add: name + position + jersey number
- [ ] "Add another" button repeats the inline form
- [ ] "Skip for now" text button — advances to step 3 without adding players
- [ ] Minimum 0 players required to proceed (they can add later)

**Step 3 — Create first season**
- [ ] Season name input (e.g. "2025/26")
- [ ] Start date picker
- [ ] "Skip for now" text button
- [ ] On save: creates `Season` record via `POST /api/seasons`

**Step 4 — Done**
- [ ] Confirmation screen: "You're all set, [firstName]!"
- [ ] "Go to dashboard" primary CTA → `/dashboard`
  - Sets `onboardingDone = true` via `PATCH /api/auth/me`

### 4.2 Player onboarding steps

**Step 1 — Welcome**
- Show team name and role confirmation
- No action required

**Step 2 — Your profile**
- [ ] Birthday (date picker, optional)
- [ ] Height in metres (optional)
- [ ] Positions (multi-select chips): Setter · Outside · Opposite · Middle · Libero · DS
- [ ] Jersey number (optional)
- [ ] "Skip for now" available

**Step 3 — Done**
- [ ] "Go to dashboard" → `/dashboard`
  - Sets `onboardingDone = true`

---

## 5. Dashboard — new header

The dashboard header replaces the old app name + logo with a user-first greeting.
Refer to the dashboard mock in `auth_dashboard_teamswitch.html`.

- [ ] Remove the existing logo/app-name header from the dashboard
- [ ] Build the new `DashboardHeader` component
  - **User avatar** — 46×46px circle, turquoise→blue gradient background,
    user initials (first letter of firstName + first letter of lastName), white text
    - Online dot: 10×10px turquoise circle, bottom-right, white border
    - `box-shadow: 0 0 0 2px rgba(35,181,211,0.25), 0 0 0 4px rgba(35,181,211,0.08)`
  - **Greeting text** — "Hi, [firstName] 👋" in 18px Montserrat 800
    - The first name is turquoise-coloured
  - **Team name row** — below the greeting, 12px Inter 500, muted colour
    - Shows current active team name
    - Has a `ti-chevron-down` icon to signal it is tappable
    - Tap opens the team switcher bottom sheet (see §6)
  - **Notification bell** — top-right, 36×36px circle button
    - Pink dot indicator when there are unread notifications
  - **Subtle radial glow** — `::before` pseudo, turquoise at 12% opacity, top-right corner
  - **Season context bar** — directly below the user row
    - Shows active season name, competition name, games played count
    - Shows win–loss record on the right
    - Tap opens season switcher (within the team switcher sheet)

---

## 6. Team switcher bottom sheet

Refer to the team switcher mock in `auth_dashboard_teamswitch.html`.

- [ ] Create `TeamSwitcherSheet` component (bottom sheet, slides up from bottom)
  - Triggered by tapping the team name row in the dashboard header
  - Backdrop: semi-transparent dark overlay, tap to dismiss
  - Handle bar at top
  - Sheet title: "Switch team" · subtitle: "You are a member of N teams"

- [ ] **Team list section**
  - One row per team the user is a member of
  - Each row shows:
    - Team logo (coloured initials in a rounded square, gradient per team)
    - Team name (bold)
    - Role tag (Manager = turquoise, Player = blue bell)
    - Mini season record ("6–2 this season") and competition name
    - Active team: turquoise filled check icon on the right
    - Inactive teams: right chevron on the right
  - Tapping an inactive team:
    - Updates `activeTeamId` in the store
    - Persists to `localStorage`
    - Closes the sheet
    - Invalidates all React Query caches
    - Refetches dashboard data for the new team

- [ ] **Season section** (below the team list)
  - Section label: "Seasons · [Active team name]"
  - Lists all seasons for the current team
  - Active season has a turquoise dot and "Active" tag
  - Tap a season to set it as the active context
  - Tapping a season does not close the sheet — user can also switch team

- [ ] **Join another team row** (bottom of sheet)
  - Dashed border icon + "Join another team" + "Paste an invitation code" sub-label
  - Tap: slides the sheet into a code-entry mode (input appears inline in the sheet)
  - On valid code: creates `TeamMember`, adds team to list, auto-selects it

- [ ] Update `seasonStore.ts` to become a combined `teamSeasonStore.ts`
  ```typescript
  interface TeamSeasonStore {
    activeTeamId:   string | null
    activeTeamRole: 'manager' | 'player' | null
    activeSeasonId: string | null
    allTeams:       TeamWithMembership[]
    allSeasons:     Season[]           // seasons for the active team only

    setActiveTeam:   (teamId: string) => Promise<void>
    setActiveSeason: (seasonId: string) => void
    loadTeams:       () => Promise<void>
    loadSeasons:     (teamId: string) => Promise<void>
  }
  ```
  - Persist `activeTeamId` and `activeSeasonId` in `localStorage`
  - On load: validate stored IDs still exist; fall back to default membership if not

---

## 7. API changes for multi-team

- [ ] All team-scoped routes accept `teamId` as a query param or from the JWT context
  - `GET /api/games?teamId=...`
  - `GET /api/players?teamId=...`
  - `GET /api/trainings?teamId=...`
  - `GET /api/dashboard?teamId=...`
  - `GET /api/seasons?teamId=...`
- [ ] Middleware: validate the requesting user is a member of the requested `teamId`
  ```typescript
  // api/src/middleware/requireTeamMember.ts
  export const requireTeamMember = async (req, res, next) => {
    const teamId = req.query.teamId || req.body.teamId
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user.id, teamId } }
    })
    if (!membership) return res.status(403).json({ error: 'Not a member of this team' })
    req.teamMembership = membership
    next()
  }
  ```
- [ ] `GET /api/auth/me/teams` — returns all teams + memberships for the current user
  - Used by `teamSeasonStore` on app load

---

## 8. Superadmin role

- [ ] `role = 'superadmin'` is set manually in the DB — no registration flow
  - First user created: run `UPDATE users SET role = 'superadmin' WHERE email = 'your@email.com'`
  - Or seed it via `prisma/seed.ts`
- [ ] Superadmin guard middleware
  ```typescript
  // api/src/middleware/requireSuperAdmin.ts
  export const requireSuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' })
    next()
  }
  ```
- [ ] Superadmin-only routes (no UI needed — use Prisma Studio or curl)
  - `POST /api/admin/invites` — create manager codes (no `teamId`)
  - `GET /api/admin/teams` — all teams
  - `GET /api/admin/users` — all users

---

## 9. Security checklist

- [ ] Invite codes hashed with bcrypt before storage — plaintext never persists in DB
- [ ] Codes expire after 7 days — checked server-side on every redemption attempt
- [ ] `useCount` increment is atomic — use a Prisma transaction:
  ```typescript
  await prisma.$transaction([
    prisma.inviteCode.update({ where: { id }, data: { useCount: { increment: 1 }, usedAt: new Date(), usedById: userId } }),
    prisma.teamMember.create({ data: { userId, teamId, role } }),
  ])
  ```
- [ ] JWT refresh tokens rotated on every use (issue new, invalidate old)
- [ ] `requireTeamMember` middleware on every team-scoped API route
- [ ] Superadmin routes behind `requireSuperAdmin` middleware — separate from role check on JWT
- [ ] Rate-limit `POST /api/invites/validate`: 100 req/hour per IP (use `express-rate-limit`)
- [ ] Rate-limit `POST /api/auth/register` and `POST /api/auth/login`: 20 req/hour per IP

---

## 10. Google OAuth (deferred — UI only for now)

Google sign-in is **visible in the UI but non-functional**. The button renders on
both the login and register pages and triggers a "coming soon" message when tapped.

### 10.1 UI — what to build now

- [ ] "Continue with Google" button on login page
  - Renders with the Google logo SVG and correct styling (dark surface button)
  - `onClick` handler shows a toast notification:
    ```
    "Google sign-in is coming soon. Please use email and password for now."
    ```
  - No routing, no API call, no OAuth redirect

- [ ] "Sign up with Google" button on register page
  - Same styling and same toast behaviour

- [ ] Do **not** install any of the following packages yet:
  - `passport`
  - `passport-google-oauth20`
  - `express-session`
  - `@types/passport`

### 10.2 What to build when Google OAuth is activated (future)

The full flow is documented in `google_oauth_flow.html`. In summary:

1. User taps "Continue with Google" → redirected to `GET /api/auth/google`
2. Google consent screen → redirect to `GET /api/auth/google/callback`
3. If Google account matches existing user → issue tokens → dashboard
4. If new user → create pending user → redirect to `/auth/accept-invite`
5. `/auth/accept-invite` → user pastes invite code → `POST /api/auth/accept-invite`
6. On success → redirect to `/onboarding`

When activating, the `users` schema gains:
- `googleId String? @unique` — nullable, null for email/password users
- `passwordHash` becomes nullable — Google users have no password

The backend implementation requires:
- `passport` + `passport-google-oauth20` + `express-session`
- Google Cloud Console project with OAuth 2.0 credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` in `.env`

---

## 11. Environment variables

```env
# api/.env additions
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=Rallytics <noreply@yourdomain.com>
APP_URL=http://localhost:3004
```

During local development, if `RESEND_API_KEY` is omitted, email sending is
skipped silently. All other functionality works normally.

---

## 12. Suggested implementation order

Each block is independently shippable. Complete them in sequence.

1. **Schema migration** (§1) — unblocks everything else
2. **Resend setup** (§2.4) — install package, verify domain, write `email.ts`
   before touching any invite logic so emails work from day one
3. **Invite code API + email sending** (§2.1) — with `boundEmail` enforcement
   and Resend calls wired in
4. **Register + login pages** (§3) — with invite code flow, `boundEmail`
   validation error handling, Google button as non-functional stub
5. **Onboarding pages** (§4) — required before any real user can complete setup
6. **Dashboard new header** (§5) — visual change only, low risk
7. **Team switcher** (§6) — requires §1 and §5 to be done first
8. **Multi-team API changes** (§7) — do alongside §6
9. **Superadmin setup** (§8) — manual DB operation, 10 minutes
10. **Security hardening** (§9) — do before any external user gets access
11. **Google OAuth** (§10) — activate when ready, self-contained
