# VB Scout

A mobile-optimised volleyball team management and match logging application for coaches, managers, and players.

---

## Table of Contents

- [User Guide](#user-guide)
  - [Getting Started as a Manager](#getting-started-as-a-manager)
  - [Managing Your Roster](#managing-your-roster)
  - [Organising Seasons](#organising-seasons)
  - [Scheduling and Managing Matches](#scheduling-and-managing-matches)
  - [Live Match Logging](#live-match-logging)
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
  - [Design System — Kinetic Court](#design-system--kinetic-court)
  - [Testing](#testing)
  - [Ports](#ports)

---

## User Guide

### Getting Started as a Manager

1. Open the app at `http://localhost:3004` (or your hosted URL).
2. Click **Register** and enter your name, email, password, and team name. This creates your account, your team, and an initial active season.
3. Log in. You land on the **Dashboard**, which shows your team's KPIs, upcoming games and trainings, and recent AI analysis highlights.

---

### Managing Your Roster

Navigate to **Players** in the bottom nav.

**Adding a player**
1. Tap **+** (or **Add Player**).
2. Fill in: first name, last name, jersey number, height, date of birth, playing positions, and whether the player is a libero or holds a referee licence.
3. Save. The player is added to your roster with a *pending* invite status.

**Inviting a player to log in**
1. Open the player's profile.
2. Tap **Send Invite**. The app generates a one-time invite link valid for 7 days.
3. Share the link with the player. When they follow it they set their email and password and their account is linked to their profile.

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

When a manager sends you an invite link:
1. Follow the link to the **Accept Invite** page.
2. Enter your email and choose a password.
3. Log in.

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
│   │   │   └── rotation.ts     # Shared rotation logic (mirrored in web/)
│   │   └── middleware/         # Auth, error handling
│   └── prisma/
│       └── schema.prisma       # Full data model
│
├── web/                        # React + Vite frontend
│   └── src/
│       ├── app/                # Page components
│       │   ├── DashboardPage.tsx
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
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   └── AcceptInvitePage.tsx
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

All other variables are set automatically by `docker-compose.yml` and do not need manual configuration unless you are running services outside Docker:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | set by Compose | Full PostgreSQL connection string |
| `ANALYSIS_SERVICE_URL` | `http://analysis:8001` | API → analysis service URL |
| `PORT` | `3005` | Express API port |
| `VITE_API_URL` | `http://localhost:3005` | Frontend → API URL (build-time) |
| `UPLOADS_DIR` | `/app/uploads` | Player photo storage path |
| `N_SIMS` | `10000` | Monte Carlo simulation count |
| `N_SENSITIVITY` | `5000` | Sensitivity simulation count |
| `MIN_RALLIES` | `20` | Minimum rallies required for analysis |
| `TUS_WINDOW` | `6` | Rolling window for TUS computation |

---

### Docker Deployment (Recommended)

**Prerequisites:** Docker Desktop (or Docker Engine + Compose plugin) installed.

```bash
# 1. Clone the repo
git clone <repo-url>
cd volleyball_scout

# 2. Configure secrets
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SECRET

# Generate a strong JWT secret:
openssl rand -base64 32

# 3. Build and start all services
docker compose up --build

# Services:
#   Frontend  →  http://localhost:3004
#   API       →  http://localhost:3005
#   Analysis  →  http://localhost:8001/docs
#   Database  →  localhost:5446 (internal only in production)
```

**Subsequent starts (no rebuild needed):**
```bash
docker compose up
```

**Stop and remove containers:**
```bash
docker compose down
```

**Stop and wipe all data (destructive):**
```bash
docker compose down -v   # removes pgdata and player_photos volumes
```

**Viewing logs:**
```bash
docker compose logs -f          # all services
docker compose logs -f api      # API only
docker compose logs -f analysis # analysis service only
```

**Rebuilding a single service:**
```bash
docker compose up --build api
```

**Service startup order:**
`db` → (healthy) → `api` + `analysis` → `web`

The `api` service runs `prisma db push` on startup, so the database schema is applied automatically on first run and on schema changes.

---

### Local Development (Without Docker)

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
| `User` | Auth credential linked to a team; role is `manager` or `player` |
| `Team` | Top-level tenant; owns all players, seasons, and matches |
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

All routes are prefixed with `/api`. Authentication uses httpOnly cookies containing a JWT access token (7-day expiry) and a refresh token (30-day expiry).

#### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create manager account + team |
| POST | `/auth/login` | Public | Log in, sets cookies |
| POST | `/auth/refresh` | Cookie | Rotate access token |
| POST | `/auth/logout` | Cookie | Clear cookies |
| POST | `/auth/invite/:playerId` | Manager | Generate player invite token |
| POST | `/auth/accept-invite` | Token | Player sets password and links account |

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
- `manager` — full write access to all team resources
- `player` — read access to team data, write access to own RSVP only

**Token storage:** httpOnly cookies (`Secure` in production, `SameSite=Lax`). No tokens are stored in `localStorage`.

**Access token TTL:** 7 days. **Refresh token TTL:** 30 days.

**Password hashing:** bcrypt, cost factor 12.

**Player invite flow:**
1. Manager calls `POST /api/auth/invite/:playerId` → receives a signed 7-day JWT invite token.
2. Manager shares the invite URL with the player.
3. Player calls `POST /api/auth/accept-invite` with the token, email, and chosen password → account is created and linked to the player record.

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
