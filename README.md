# VB Scout

A mobile-optimised volleyball team management and match logging application for coaches, managers, and players.

---

## Table of Contents

- [User Guide](#user-guide)
  - [Getting Started as a Manager](#getting-started-as-a-manager)
  - [Installing as an App (PWA)](#installing-as-an-app-pwa)
  - [Managing Your Roster](#managing-your-roster)
  - [Organising Seasons](#organising-seasons)
  - [Scheduling and Managing Matches](#scheduling-and-managing-matches)
  - [Live Match Logging](#live-match-logging)
  - [Offline Mode](#offline-mode)
  - [Match Statistics and AI Analysis](#match-statistics-and-ai-analysis)
  - [Training Sessions](#training-sessions)
  - [Training Priorities](#training-priorities)
  - [Player Guide](#player-guide)
- [Developer Guide](#developer-guide)
  - [Tech Stack](#tech-stack)
  - [Architecture Overview](#architecture-overview)
  - [Project Structure](#project-structure)
  - [Environment Variables](#environment-variables)
  - [Docker Deployment (Recommended)](#docker-deployment-recommended)
  - [Local Development (Without Docker)](#local-development-without-docker)
  - [Database](#database)
  - [API Reference](#api-reference)
  - [Analysis Service](#analysis-service)
  - [Auth System](#auth-system)
  - [Progressive Web App (PWA)](#progressive-web-app-pwa)
  - [Design System — Kinetic Court](#design-system--kinetic-court)
  - [Testing](#testing)
  - [Ports](#ports)

---

## User Guide

### Getting Started as a Manager

Registration is invite-code gated. You need a manager invite code from the superadmin before you can create an account.

1. Obtain a manager invite code from the superadmin.
2. Open the app at `http://localhost:3004` (or your hosted URL) and click **Register**.
3. Enter your name, email, password, invite code, and (for manager codes without a pre-assigned team) a team name. This creates your account, your team, and an initial active season.
4. On first login you are guided through a brief **Onboarding** flow to finish setting up your profile.
5. You land on the **Dashboard**, which shows your team's KPIs, upcoming games and trainings, and recent AI analysis highlights.

---

### Installing as an App (PWA)

Courtside is a Progressive Web App (PWA). You can install it directly on your phone or tablet for a full-screen, native-like experience — no app store required.

**Android (Chrome)**
1. Open the app in Chrome.
2. Tap the three-dot menu → **Add to Home screen**.
3. Tap **Install**. The app appears on your home screen and opens without the browser chrome.

**iOS (Safari)**
1. Open the app in Safari.
2. Tap the Share icon (square with arrow) → **Add to Home Screen**.
3. Tap **Add**. The app appears on your home screen.

**Desktop (Chrome / Edge)**
1. Look for the install icon in the address bar (a `+` or screen icon).
2. Click it and confirm. The app opens in its own window.

Once installed, the app shell loads from cache even without a network connection, and live match logging works fully offline (see [Offline Mode](#offline-mode)).

---

### Managing Your Roster

Navigate to **Players** in the bottom nav.

**Adding a player**
1. Tap **+** (or **Add Player**).
2. Fill in: first name, last name, jersey number, height, date of birth, playing positions, and whether the player is a libero or holds a referee licence.
3. Save. The player is added to your roster with a *pending* invite status.

**Inviting a player to log in**
1. Go to **Settings → Invite Codes** and tap **+ New Invite**.
2. Set the role to *player*, optionally bind the code to the player's email address, and select the player profile to link. The app generates a 7-day invite code.
3. Share the code with the player. They register at the **Register** screen using the code; their new account is automatically linked to their player profile.

**Editing or deleting a player**
- Open the player profile and tap **Edit** to update any field.
- Upload or change a profile photo (JPEG/PNG, max 5 MB).
- Tap **Delete** to remove the player permanently. This cannot be undone.

---

### Organising Seasons

Seasons are intentionally tucked away. Access them via **Settings → Seasons**.

- A default active season is created on registration.
- Create additional seasons with a name, start date, and end date.
- Mark a season **active** to associate new matches with it.
- View per-season win/loss records and statistics.

---

### Scheduling and Managing Matches

Navigate to **Games** in the bottom nav.

**Creating a match**
1. Tap **+ New Game**.
2. Choose the match type:
   - **Playing** — your team is competing. Rotation tracking and live logging are available.
   - **Officiating** — your team is refereeing. Score tracking only.
3. Set opponent name, date, time, location, referees, and scorers.
4. The match is created with status **upcoming**.

**Editing match details**
- Open any match and tap **Edit** to update opponent, location, or officials.

**Filtering the match list**
- Use the **All / Playing / Officiating** toggle to narrow the list.
- Upcoming and completed matches are shown in separate sections.

---

### Live Match Logging

Open a **Playing** match and tap **Start / Continue Logging**.

The live logging screen (`GameLog`) is designed for one-handed use during a real match.

**Scoring a rally**
- Tap **Us** or **Them** depending on who won the point.
- Select a **point type**: positive play (ace, kill, block) or error (unforced error, reception error, etc.).
- The score updates instantly. Rotation advances automatically when your team wins a rally while receiving.

**Logging a substitution**
- Tap **Sub** and choose the player going out and the player coming in.
- The app enforces the standard limit of 6 regular substitutions per set. Libero swaps are tracked separately.

**Logging a timeout**
- Tap **Timeout** and choose whether it was called by **us** or **them**.

**Starting a new set**
- When a set ends, tap **New Set**. The app creates Set 2 (or 3, etc.) and initialises the lineup.

**Undoing the last rally**
- Tap **Undo** to remove the most recent rally and restore the previous score and rotation.

**Real-time stats during the match**
- The **Stats** tab in the live screen shows live TUS (Timeout Urgency Score), error ratio by rotation, and score context — all computed client-side with zero latency.

**Match completion**
- The match is automatically marked **completed** when a team wins 3 sets (or your configured set threshold).
- Post-match AI analysis is triggered immediately after completion.

---

### Offline Mode

The live logging screen works without an internet connection. This is useful when logging in a sports hall with poor Wi-Fi or no mobile signal.

**What works offline:**
- Scoring rallies (tap Us / Them, then point type)
- Logging substitutions
- Logging timeouts (countdown timer still runs)
- Undoing the last rally (only if it was logged during the same offline session)
- Viewing the current score, lineup, and rotation

**What requires a connection:**
- Ending a set or match
- Viewing historical stats and AI analysis
- Undoing a rally that was logged before going offline

**How syncing works:**

While offline, every scored rally, substitution, and timeout is saved to a local queue on the device. A banner at the top of the live logging screen shows the connection status and how many actions are pending.

As soon as the connection is restored, the app automatically replays the queued actions to the server in the order they were logged, then refreshes its state from the server to ensure everything is in sync. No manual action is required.

> The offline queue survives page refreshes and app restarts — actions are stored persistently on the device and will sync the next time the app connects.

---

### Match Statistics and AI Analysis

Open any completed match and switch to the **Stats** tab.

**What's shown**
- Final score and set-by-set breakdown.
- Point distribution: positive plays vs errors per set.
- Rotation efficiency: which of the 6 rotation positions performed best/worst.
- TUS timeline: a graph of Timeout Urgency Score across the match, showing momentum swings.
- Error clustering: whether errors came in streaks (Wald-Wolfowitz test) or were random.

**AI Analysis tab**
The analysis service runs a full statistical pipeline in the background (~30 seconds). The frontend polls every 3 seconds and displays results as soon as they are ready. The analysis covers:

- **Strengths** — rotations, serve-receive patterns, or substitution combinations that produced positive outcomes.
- **Weaknesses** — areas where error clustering or negative TUS trends were detected.
- **Action items** — specific drill recommendations ranked by expected impact.
- **Monte Carlo simulation** — 10 000 simulated matches based on observed point probabilities, estimating win likelihood under different lineup strategies.
- **Substitution impact** — whether substitutions shifted point-scoring rates.
- **Timeout impact** — whether called timeouts produced a measurable score-momentum change.

If fewer than 20 rallies were logged the analysis returns **Insufficient data**.

---

### Training Sessions

Navigate to **Trainings** in the bottom nav.

**Creating a session (manager)**
1. Tap **+ New Training**.
2. Set title, date, start time, end time, location, notes, and optional focus tags (e.g. *serve*, *block*, *reception*).
3. Save. All players are auto-enrolled with status **pending**.

**Managing attendance**
- Open a session to see the attendance list.
- Tap a player's status to change it to **Coming** or **Not Coming** on their behalf.

**Deleting a session**
- Open the session and tap **Delete**.

---

### Training Priorities

After match analysis completes, the system may generate **Training Priorities** — specific metrics that need improvement based on recent match insights.

Access them from the **Dashboard** (pinned cards) or via the API.

Each priority shows:
- The metric to improve (e.g., *reception error rate in rotation 3*).
- A baseline value (from the source match) and a target value.
- Outcome history: how the metric moved in subsequent matches.
- Status: **Active**, **Improving**, **Resolved**, **Regressed**, or **Dismissed**.

A manager can update the note on a priority or dismiss it from the active list.

---

### Player Guide

When a manager sends you an invite code:
1. Open the app and tap **Register**.
2. Enter your name, email, password, and the invite code you received.
3. Tap **Register** — your account is created and linked to your player profile automatically.
4. Log in. If it is your first login you will be taken through a short onboarding flow.

As a player, you can:
- View your own profile (name, positions, jersey, height).
- View your team's match list and individual match statistics.
- View AI analysis for completed matches.
- See upcoming training sessions.
- RSVP to training sessions by changing your own attendance status to **Coming** or **Not Coming**.

You cannot create matches, edit other players' data, or manage the roster.

---

## Developer Guide

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State / Data | Zustand + TanStack Query |
| PWA | vite-plugin-pwa (Workbox) |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL 15 |
| Analysis | Python 3.11 + FastAPI |
| Infrastructure | Docker Compose |

---

### Architecture Overview

```
Browser (React)
    │
    ├─ REST calls ──► Express API (port 3005)
    │                     │
    │                     ├─ Prisma ──► PostgreSQL (port 5446)
    │                     │
    │                     └─ HTTP ──► FastAPI Analysis Service (port 8001)
    │                                       │
    │                                       └─ psycopg2 ──► PostgreSQL
    │
    └─ Polling (every 3 s) ──► GET /api/games/:id/analysis
```

**Key design decisions:**
- Rotation logic is mirrored in `web/src/lib/rotation.ts` and `api/src/lib/rotation.ts` so the frontend can compute rotations locally with no round-trip during live logging.
- TUS is computed fully client-side during a live match for zero-latency display, then recomputed server-side for persistence.
- Post-match analysis is asynchronous: the API triggers a `POST /analyse/:id` call to the analysis service, then the frontend polls `GET /api/games/:id/analysis` until `status === "ready"`.
- Seasons are intentionally hidden from the main navigation. They are only accessible through Settings to reduce cognitive load during live matches.

---

### Project Structure

```
volleyball_scout/
├── api/                        # Express + Prisma backend
│   ├── src/
│   │   ├── routes/             # One file per resource
│   │   │   ├── auth.ts
│   │   │   ├── invites.ts      # Invite code management
│   │   │   ├── admin.ts        # Superadmin-only team/user management
│   │   │   ├── players.ts
│   │   │   ├── games.ts
│   │   │   ├── seasons.ts
│   │   │   ├── sets.ts
│   │   │   ├── rallies.ts
│   │   │   ├── substitutions.ts
│   │   │   ├── timeouts.ts
│   │   │   ├── team.ts
│   │   │   ├── trainings.ts
│   │   │   ├── attendance.ts
│   │   │   └── stats.ts
│   │   ├── lib/
│   │   │   ├── rotation.ts     # Shared rotation logic (mirrored in web/)
│   │   │   ├── email.ts        # Resend email helpers (invite, welcome)
│   │   │   ├── inviteCode.ts   # Code generation and bcrypt verification
│   │   │   └── seed.ts         # Superadmin seeding on startup
│   │   └── middleware/         # Auth, role guards, superadmin guard
│   └── prisma/
│       └── schema.prisma       # Full data model
│
├── web/                        # React + Vite frontend
│   └── src/
│       ├── app/                # Page components
│       │   ├── DashboardPage.tsx
│       │   ├── OnboardingPage.tsx  # First-login setup flow
│       │   ├── GamesPage.tsx
│       │   ├── GameLogPage.tsx
│       │   ├── GameStatsPage.tsx
│       │   ├── GameEditPage.tsx
│       │   ├── PlayersPage.tsx
│       │   ├── PlayerFormPage.tsx
│       │   ├── TrainingsPage.tsx
│       │   ├── TrainingDetailPage.tsx
│       │   ├── TrainingFormPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── admin/
│       │   │   └── AdminTeamsPage.tsx  # Superadmin team management
│       │   └── auth/
│       │       ├── LoginPage.tsx
│       │       └── RegisterPage.tsx
│       └── lib/
│           ├── rotation.ts     # Shared rotation logic (mirrored in api/)
│           └── tus.ts          # Client-side TUS computation
│
├── analysis-service/           # Python + FastAPI analysis
│   ├── main.py
│   ├── analysis/
│   │   ├── clustering.py       # Wald-Wolfowitz error streak detection
│   │   ├── simulation.py       # Monte Carlo (10 000 sims)
│   │   ├── tus_retrospective.py
│   │   ├── rotation_profiles.py
│   │   ├── substitution_impact.py
│   │   ├── timeout_impact.py
│   │   ├── score_context.py
│   │   ├── set_profiles.py
│   │   ├── season_prior.py
│   │   ├── profiles.py
│   │   └── outcome_tracker.py
│   └── tests/
│       ├── test_clustering.py
│       ├── test_rotation.py
│       └── test_tus.py
│
├── docker-compose.yml
└── .env.example
```

---

### Environment Variables

Copy `.env.example` to `.env` and fill in the two required values before starting:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | **Yes** | Password for the `vbuser` database account |
| `JWT_SECRET` | **Yes** | Secret used to sign JWTs — generate with `openssl rand -base64 32` |
| `SUPERADMIN_EMAIL` | **Yes** | Email address seeded for the superadmin account |
| `SUPERADMIN_PASSWORD` | **Yes** | Password seeded for the superadmin account |
| `RESEND_API_KEY` | Recommended | API key for [Resend](https://resend.com) — used to send invite and welcome emails. If omitted, emails are skipped silently. |

All other variables are set automatically by `docker-compose.yml` and do not need manual configuration unless you are running services outside Docker:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | set by Compose | Full PostgreSQL connection string |
| `ANALYSIS_SERVICE_URL` | `http://analysis:8001` | API → analysis service URL |
| `PORT` | `3005` | Express API port |
| `VITE_API_URL` | `http://localhost:3005` | Frontend → API URL (build-time) |
| `UPLOADS_DIR` | `/app/uploads` | Player and user photo storage path |
| `ALLOWED_ORIGINS` | *(none)* | Comma-separated extra origins for CORS (e.g. your production domain) |
| `N_SIMS` | `10000` | Monte Carlo simulation count |
| `N_SENSITIVITY` | `5000` | Sensitivity simulation count |
| `MIN_RALLIES` | `20` | Minimum rallies required for analysis |
| `TUS_WINDOW` | `6` | Rolling window for TUS computation |

---

### Local Development

Run each service in a separate terminal. You need PostgreSQL 15 running locally first.

**API (Express)**
```bash
cd api
npm install
cp ../.env.example .env
# Edit .env: set DATABASE_URL to your local postgres, e.g.:
#   DATABASE_URL=postgresql://postgres:password@localhost:5432/vbscout
npx prisma db push       # apply schema
npm run dev              # runs on http://localhost:3005
```

**Frontend (React + Vite)**
```bash
cd web
npm install
# VITE_API_URL defaults to http://localhost:3005 in dev
npm run dev              # runs on http://localhost:5173
```

**Analysis Service (FastAPI)**
```bash
cd analysis-service
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set DATABASE_URL to your local postgres
uvicorn main:app --reload --port 8001
# Docs: http://localhost:8001/docs
```

---

### Database

The schema lives in `api/prisma/schema.prisma`. Key models:

| Model | Description |
|---|---|
| `User` | Auth credential; role is `superadmin`, `manager`, or `player`; holds `onboardingDone` and `avatarUrl` |
| `Team` | Top-level tenant; owns all players, seasons, and matches |
| `TeamMember` | Junction between `User` and `Team`; supports multi-team membership; one membership is flagged `isDefault` |
| `InviteCode` | Hashed, time-limited invite code for registering a manager or player; optionally bound to an email or player profile |
| `Player` | Roster member with positions, jersey number, and optional user link |
| `Season` | Date-bounded grouping for matches; one season is active at a time |
| `Match` | A game (playing or officiating) with score, sets, and analysis result |
| `MatchPlayer` | Junction: which players were part of a specific match |
| `Set` | One set within a match; holds the starting lineup and score |
| `Rally` | Single point logged in a set; carries score snapshot and rotation state |
| `Substitution` | Player swap within a set |
| `Timeout` | Timeout event within a set |
| `TrainingSession` | Scheduled training with focus tags |
| `TrainingAttendance` | Per-player RSVP for a training session |
| `MatchAnalysis` | Analysis result (status + JSON insights) keyed per match |
| `TrainingPriority` | Actionable training recommendation generated from analysis |
| `PriorityOutcome` | Tracks how a priority metric changed in subsequent matches |

**Applying schema changes:**
```bash
cd api
npx prisma db push        # dev / Docker (no migration files)
# or
npx prisma migrate dev    # if you want tracked migration history
```

**Prisma Studio (GUI):**
```bash
cd api
npx prisma studio         # opens at http://localhost:5555
```

---

### API Reference

All routes are prefixed with `/api`. Authentication uses httpOnly cookies containing a JWT access token (15-minute expiry for superadmin, 7-day expiry for managers and players) and a refresh token (30-day expiry for all roles).

#### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public (invite code required) | Create account using an invite code; manager codes create a new team |
| POST | `/auth/login` | Public | Log in, sets cookies |
| POST | `/auth/refresh` | Cookie | Rotate access token |
| POST | `/auth/logout` | Cookie | Clear cookies |
| GET | `/auth/me` | Cookie | Current user profile |
| PATCH | `/auth/me` | Cookie | Update name or `onboardingDone` flag |
| POST | `/auth/me/photo` | Cookie | Upload or replace profile photo (max 5 MB) |
| DELETE | `/auth/me/photo` | Cookie | Remove profile photo |
| GET | `/auth/me/teams` | Cookie | List all team memberships for the current user |
| POST | `/auth/switch-team` | Cookie | Re-issue JWT scoped to a different team |
| POST | `/auth/teams/join` | Cookie | Join an additional team using an invite code |

#### Invite Codes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/invites/validate` | Public | Check whether an invite code is valid and return its metadata |
| POST | `/invites` | Manager | Create a player invite code; superadmin can also create manager codes |
| GET | `/invites` | Manager | List invite codes created by the current user (superadmin sees all) |
| DELETE | `/invites/:id` | Manager | Revoke an invite code |
| POST | `/invites/:id/resend` | Superadmin | Resend the invite email for a bound code |

#### Admin (Superadmin only)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/teams` | Superadmin | List all teams with member, player, and match counts |
| POST | `/admin/teams` | Superadmin | Create a new team (with an initial season) |
| DELETE | `/admin/teams/:id` | Superadmin | Delete a team and all its data (cascades fully) |
| GET | `/admin/users` | Superadmin | List all users with their team memberships |
| GET | `/admin/invites` | Superadmin | List all invite codes across all teams |

#### Players

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/players` | Any | List all team players |
| POST | `/players` | Manager | Create player |
| GET | `/players/:id` | Any | Get player (privacy rules for self vs manager) |
| PATCH | `/players/:id` | Manager | Update player |
| POST | `/players/:id/photo` | Manager | Upload/replace player photo (max 5 MB) |
| DELETE | `/players/:id/photo` | Manager | Remove player photo |
| DELETE | `/players/:id` | Manager | Delete player |

#### Matches

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/games` | Any | List matches (filterable by type, season, status) |
| POST | `/games` | Manager | Create match (auto-creates Set 1 if playing) |
| GET | `/games/:id` | Any | Match details with sets and lineups |
| PATCH | `/games/:id` | Manager | Update match; triggers analysis when status → completed |
| DELETE | `/games/:id` | Manager | Delete match |
| GET | `/games/:id/stats` | Any | Computed stats: rotations, TUS timeline, error clustering |
| GET | `/games/:id/analysis` | Any | Analysis status and insights |

#### Sets, Rallies, Substitutions, Timeouts

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/games/:gameId/sets` | Manager | Add new set to match |
| GET | `/games/:gameId/sets/:setId` | Any | Set with rallies, subs, timeouts |
| PATCH | `/games/:gameId/sets/:setId` | Manager | Update set; auto-completes match at 3 set wins |
| GET | `/sets/:setId/rallies` | Any | List rallies |
| POST | `/sets/:setId/rallies` | Manager | Log rally with auto rotation tracking |
| DELETE | `/sets/:setId/rallies/last` | Manager | Undo last rally |
| GET | `/sets/:setId/substitutions` | Any | List substitutions |
| POST | `/sets/:setId/substitutions` | Manager | Log sub (max 6 per set; libero swaps unlimited) |
| GET | `/sets/:setId/timeouts` | Any | List timeouts |
| POST | `/sets/:setId/timeouts` | Manager | Log timeout |

#### Seasons

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/seasons` | Manager | List team seasons |
| GET | `/seasons/active` | Any | Get active season |
| POST | `/seasons` | Manager | Create season |
| GET | `/seasons/:id` | Manager | Season with stats |
| PATCH | `/seasons/:id` | Manager | Update season |
| DELETE | `/seasons/:id` | Manager | Delete season |
| GET | `/seasons/:id/stats` | Manager | Aggregated season statistics |

#### Trainings

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/trainings` | Any | List sessions with attendance counts |
| POST | `/trainings` | Manager | Create session |
| GET | `/trainings/:id` | Any | Session details and attendance |
| PATCH | `/trainings/:id` | Manager | Update session |
| DELETE | `/trainings/:id` | Manager | Delete session |
| GET | `/trainings/:id/attendance` | Any | Get attendance records |
| PATCH | `/trainings/:id/attendance/:playerId` | Player/Manager | Update RSVP (players can only update own) |

#### Dashboard & Training Priorities

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | Any | KPIs, upcoming games, trainings, recent analysis |
| GET | `/training-priorities` | Manager | Active priorities |
| PATCH | `/training-priorities/:id` | Manager | Update priority note or status |

#### Team

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/team` | Any | Team name and initials |
| PATCH | `/team` | Manager | Update team name/initials |

---

### Analysis Service

The FastAPI service runs independently and connects to PostgreSQL directly.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Database connectivity check |
| POST | `/analyse/{match_id}` | Queue analysis for a completed match (runs in background, ~30 s) |
| GET | `/insights/{match_id}` | Poll for analysis status and results |
| GET | `/training/{team_id}` | Fetch active/resolved training priorities |
| PATCH | `/training/priority/{priority_id}` | Update a priority's note or status |

**Analysis modules:**

| Module | What it computes |
|---|---|
| `clustering.py` | Wald-Wolfowitz runs test for error streaks |
| `simulation.py` | Monte Carlo win probability (N_SIMS=10 000) |
| `tus_retrospective.py` | Timeout Urgency Score retrospective (window=6 rallies) |
| `rotation_profiles.py` | Point efficiency by rotation position |
| `substitution_impact.py` | Before/after point rate change per substitution |
| `timeout_impact.py` | Score momentum shift after timeouts |
| `score_context.py` | Pressure situations and momentum analysis |
| `set_profiles.py` | Set-level performance patterns |
| `season_prior.py` | Season baseline for Bayesian adjustment |
| `profiles.py` | Player and team performance profiles |
| `outcome_tracker.py` | Tracks training priority metric over subsequent matches |

**Interactive API docs:** `http://localhost:8001/docs`

---

### Auth System

**Roles:**
- `superadmin` — platform-wide access; manages teams and issues manager invite codes. Seeded on startup from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
- `manager` — full write access to all resources within their team
- `player` — read access to team data, write access to own RSVP only

**Multi-team:** Users can belong to multiple teams via the `TeamMember` table. Each user has one default team; calling `POST /api/auth/switch-team` updates the default and re-issues tokens scoped to the new team.

**Token storage:** httpOnly cookies (`Secure` in production, `SameSite=Lax`). No tokens are stored in `localStorage`.

**Access token TTL:** 15 minutes for `superadmin`; 7 days for `manager` and `player`. **Refresh token TTL:** 30 days (all roles). Cookie `maxAge` matches the JWT expiry.

**Password hashing:** bcrypt, cost factor 12.

**Invite code flow:**
1. Superadmin creates a manager invite code via `POST /api/invites` (role: `manager`).
2. Manager registers at `POST /api/auth/register` using that code, providing a team name. A new team and default season are created.
3. Manager creates player invite codes via `POST /api/invites` (role: `player`), optionally binding each to a player profile and email address.
4. Players register at `POST /api/auth/register` using their code. If the code was linked to a player profile, the new user account is automatically connected to that profile.
5. An existing logged-in user can join a second team by calling `POST /api/auth/teams/join` with a valid invite code.

**Invite code details:**
- Codes are randomly generated, stored bcrypt-hashed, and expire after 7 days.
- If `boundEmail` is set, only that email address may use the code.
- `maxUses` defaults to 1; superadmins can set higher values for open-registration codes.
- If a `RESEND_API_KEY` is configured, an invite email is sent automatically when `boundEmail` is provided.

---

### Progressive Web App (PWA)

The frontend is configured as a PWA using [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox under the hood).

**What's cached:**

| Resource | Strategy |
|---|---|
| App shell (HTML, JS, CSS, images, fonts) | Pre-cached at install time — available offline immediately |
| Google Fonts stylesheets + files | `CacheFirst`, 1-year TTL |
| API responses | Not cached — always require a live connection |

**Offline queue (`offlineStore`):**

Queued operations are persisted in `localStorage` via a dedicated Zustand store (`web/src/store/offlineStore.ts`). Each entry records the HTTP method, URL, and body needed to replay the action. The queue key is `vbscout-offline-queue`.

**Sync hook (`useSyncQueue`):**

Mounted inside `GameLogPage`. Listens for the `online` browser event. On reconnect, replays the queue sequentially (order matters — rallies must reach the server in the order they were logged). After all items process, calls `refreshFromDB()` to reconcile local state with the canonical server response.

Server 4xx responses for a queued item are treated as permanently invalid (e.g. the set was closed while offline) and are discarded to prevent the queue from blocking.

**Icons:**

PWA icons are generated from `web/public/vb-icon.svg` using `@vite-pwa/assets-generator`. To regenerate after changing the icon:

```bash
cd web
npx pwa-assets-generator --preset minimal-2023 public/vb-icon.svg
```

This produces `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, and `favicon.ico` in `web/public/`.

**Testing PWA features:**

The service worker is intentionally disabled in `vite dev` mode to avoid conflicts with Hot Module Replacement. To test installation and offline behaviour, use a production build:

```bash
cd web
npm run build
npm run preview   # serves the built app at http://localhost:4173
```

Then open Chrome DevTools → **Application → Service Workers** to inspect the SW state, or use the **Network** tab to simulate offline.

**Nginx (production):**

`web/nginx.conf` serves the service worker with `Cache-Control: no-cache` so browser updates are applied immediately when a new version is deployed. The manifest is similarly uncached.

---

### Design System — Kinetic Court

| Token | Value |
|---|---|
| Background | `#101415` |
| Primary (Orange) | `#FF5C00` |
| Secondary (Electric Blue) | `#00E0FF` |
| Text | `#E0E3E5` |
| Headings | Montserrat |
| Body | Inter |

---

### Testing

**Analysis service (pytest):**
```bash
cd analysis-service
pytest tests/ -v
```

Test coverage:
- `test_clustering.py` — error streak detection
- `test_rotation.py` — rotation efficiency calculations
- `test_tus.py` — TUS computation correctness

**API (Jest) — planned**

**Frontend (Vitest) — planned**

---

### Ports

| Service | Host Port | Internal Port |
|---|---|---|
| Web (React) | 3004 | 3000 |
| API (Express) | 3005 | 3005 |
| Analysis (FastAPI) | 8001 | 8001 |
| PostgreSQL | 5446 | 5432 |
