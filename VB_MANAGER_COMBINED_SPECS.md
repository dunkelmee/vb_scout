# VB Manager — Combined Application & Analysis Service Specification

Complete specification for VB Manager: a mobile-optimised React volleyball team management
and match logging application with persistent PostgreSQL storage, live court visualisation,
rotation tracking, match statistics, post-match AI analysis, and training session management.

> **Scope note:** Post-match annotation (rally-by-rally skill entry) is explicitly out of
> scope for this version and will be specified separately. Season management is present in
> the data model for match scoping but is **hidden from the main navigation** — it is
> accessible only through Settings. The primary coach workflow replaces the Seasons tab
> with a **Trainings tab** for scheduling training sessions and tracking attendance.

---

## 1. Product overview

VB Manager is a mobile-first web app for volleyball coaches and team managers to:
- Manage a team roster with player profiles and per-player login access
- Organise matches into seasons (background, via Settings)
- Create and track matches (playing or officiating) within a season
- Log live match scores, rotations, substitutions and timeouts
- Track real-time statistics and a Timeout Urgency Score during matches
- Automatically trigger post-match AI analysis via a Python microservice
- View match and season-level statistics and AI-generated insights after completion
- Schedule training sessions and track player attendance (RSVP)

### Role model
- **Manager / Coach** — full write access: create games, log matches, manage players, manage trainings, view all statistics and analysis
- **Player** — read-only: view own profile, view match statistics and analysis, RSVP to training sessions. Cannot create or log games.

### Design principles
- **Mobile-first** — primary target is a phone screen (375px+). All interactions designed for thumbs. Tap targets minimum 44×44px.
- **Tablet-enhanced** — on tablets (768px+), layout expands to show more context alongside the primary action area
- **Dark theme** — dark background (`#101415`), primary accent orange (`#FF5C00`), electric blue (`#00E0FF`), crisp white (`#F8FAFC`)
- **Fast entry** — scoring a point should take 2 taps maximum
- **Undo always available** — no destructive action is irreversible in one step
- **No annotation during live logging** — rally-by-rally skill entry is post-match only

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React 18 + Vite | SPA with React Router v6 |
| Language | TypeScript | Full type safety |
| Styling | Tailwind CSS | Mobile-first utility classes |
| Client state | Zustand | Live match state + session |
| Data fetching | TanStack Query (React Query) | Server state, polling, caching |
| Charts | Recharts | KPI visualisations |
| Drag and drop | @dnd-kit/core | Court lineup setup |
| Export | @react-pdf/renderer + papaparse | PDF and CSV |
| Backend API | Node.js + Express | REST API server |
| Database | PostgreSQL 15 | Persistent relational storage |
| ORM | Prisma | Type-safe queries + migrations |
| Auth | JWT + bcrypt | Access + refresh tokens, role-based |
| Analysis service | Python 3.11 + FastAPI | Post-match microservice |
| Simulation | NumPy + SciPy + Pandas | Monte Carlo, statistical analysis |
| Task queue | FastAPI BackgroundTasks | Sufficient for club-level load |
| Hosting | Docker Compose | All components in one stack |

### Port mapping (host → container)

| Service | Host port | Container port |
|---|---|---|
| React frontend (Vite) | 3004 | 3000 |
| Express API | 3005 | 3005 |
| FastAPI analysis service | 8001 | 8001 |
| PostgreSQL | 5446 | 5432 |

---

## 3. Docker architecture

```
docker-compose.yml
├── db            — PostgreSQL 15
├── api           — Node.js / Express (Prisma ORM)
├── analysis      — Python FastAPI microservice
└── web           — React / Vite (served via nginx in production)
```

### docker-compose.yml (outline)

```yaml
version: "3.9"

services:
  db:
    image: postgres:15
    container_name: vbmanager_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: vbuser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: vbmanager
    ports:
      - "5446:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vbuser -d vbmanager"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: vbmanager_api
    restart: unless-stopped
    ports:
      - "3005:3005"
    environment:
      DATABASE_URL: postgresql://vbuser:${POSTGRES_PASSWORD}@db:5432/vbmanager
      JWT_SECRET: ${JWT_SECRET}
      ANALYSIS_SERVICE_URL: http://analysis:8001
    depends_on:
      db:
        condition: service_healthy

  analysis:
    build:
      context: ./analysis-service
      dockerfile: Dockerfile
    container_name: vbmanager_analysis
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      DATABASE_URL: postgresql://vbuser:${POSTGRES_PASSWORD}@db:5432/vbmanager
      N_SIMS: 10000
      N_SENSITIVITY: 5000
      MIN_RALLIES: 20
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8001/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: vbmanager_web
    restart: unless-stopped
    ports:
      - "3004:3000"
    environment:
      VITE_API_URL: http://localhost:3005
    depends_on:
      - api

volumes:
  pgdata:
```

### .env (required variables)
```env
POSTGRES_PASSWORD=<strong password>
JWT_SECRET=<output of: openssl rand -base64 32>
```

### Local development
```bash
git clone <repo>
cd vb-manager
cp .env.example .env
# fill POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
# Frontend: http://localhost:3004
# API:      http://localhost:3005
# Analysis: http://localhost:8001
```

On first run the API entrypoint automatically runs `prisma db push` before starting Express.

---

## 4. Project structure

```
vb-manager/
├── web/                          # React + Vite frontend
│   ├── src/
│   │   ├── app/                  # route-level page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── GamesPage.tsx
│   │   │   ├── GameLogPage.tsx
│   │   │   ├── GameStatsPage.tsx
│   │   │   ├── TrainingsPage.tsx
│   │   │   ├── PlayersPage.tsx
│   │   │   ├── PlayerProfilePage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── auth/
│   │   │       ├── LoginPage.tsx
│   │   │       └── RegisterPage.tsx
│   │   ├── components/
│   │   │   ├── court/
│   │   │   │   ├── CourtView.tsx
│   │   │   │   ├── PlayerToken.tsx
│   │   │   │   ├── ZoneLabel.tsx
│   │   │   │   └── RotationToast.tsx
│   │   │   ├── score/
│   │   │   │   ├── ScoreControls.tsx
│   │   │   │   ├── UndoButton.tsx
│   │   │   │   └── SetScoreHeader.tsx
│   │   │   ├── stats/
│   │   │   │   ├── TUSBar.tsx
│   │   │   │   ├── TUSBreakdown.tsx
│   │   │   │   ├── RotationTable.tsx
│   │   │   │   ├── ErrorPressureCard.tsx
│   │   │   │   ├── PointQualityCard.tsx
│   │   │   │   ├── ScoreTimeline.tsx
│   │   │   │   ├── TUSTimeline.tsx
│   │   │   │   ├── DashboardCharts.tsx
│   │   │   │   └── InsightCards.tsx       # renders analysis microservice output
│   │   │   ├── analysis/
│   │   │   │   ├── AnalysisPending.tsx    # polling state while analysis runs
│   │   │   │   ├── InsightCard.tsx        # single strength/weakness/action card
│   │   │   │   ├── TrainingPriorityList.tsx
│   │   │   │   └── PriorityOutcomeBadge.tsx
│   │   │   ├── game/
│   │   │   │   ├── GameCard.tsx
│   │   │   │   ├── GameList.tsx
│   │   │   │   ├── CreateGameWizard.tsx
│   │   │   │   ├── LineupSetup.tsx
│   │   │   │   ├── SubstitutionModal.tsx
│   │   │   │   ├── TimeoutModal.tsx
│   │   │   │   └── EndSetModal.tsx
│   │   │   ├── training/
│   │   │   │   ├── TrainingCard.tsx
│   │   │   │   ├── TrainingList.tsx
│   │   │   │   ├── TrainingForm.tsx
│   │   │   │   ├── AttendanceToggle.tsx   # player RSVP toggle
│   │   │   │   └── AttendanceRoster.tsx   # manager view of responses
│   │   │   ├── timeline/
│   │   │   │   ├── RallyFeed.tsx
│   │   │   │   └── RallyRow.tsx
│   │   │   ├── players/
│   │   │   │   ├── PlayerCard.tsx
│   │   │   │   ├── PlayerForm.tsx
│   │   │   │   └── PlayerChecklist.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Select.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Toast.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── BottomSheet.tsx
│   │   │       ├── Tabs.tsx
│   │   │       ├── FAB.tsx
│   │   │       └── ProgressBar.tsx
│   │   ├── lib/
│   │   │   ├── rotation.ts           # client-side rotation logic
│   │   │   ├── statistics.ts         # live match stats (TUS, error ratio, etc.)
│   │   │   ├── tus.ts
│   │   │   ├── clustering.ts         # Wald-Wolfowitz (client-side for live TUS)
│   │   │   └── api.ts                # typed fetch wrappers
│   │   ├── store/
│   │   │   ├── matchStore.ts         # live match state (Zustand)
│   │   │   ├── authStore.ts          # JWT + user role
│   │   │   └── seasonStore.ts        # active season (persisted in localStorage)
│   │   ├── hooks/
│   │   │   ├── useMatchAnalysis.ts   # polling hook for analysis results
│   │   │   └── useRole.ts            # role-based access helper
│   │   └── router/
│   │       └── index.tsx             # React Router routes + role guards
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   └── nginx.conf                    # production static serving
│
├── api/                              # Express + Prisma backend
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT verification + role check
│   │   │   └── requireRole.ts        # 'manager' guard middleware
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── players.ts
│   │   │   ├── seasons.ts
│   │   │   ├── games.ts
│   │   │   ├── sets.ts
│   │   │   ├── rallies.ts
│   │   │   ├── substitutions.ts
│   │   │   ├── timeouts.ts
│   │   │   ├── trainings.ts
│   │   │   ├── attendance.ts
│   │   │   └── stats.ts
│   │   └── lib/
│   │       ├── prisma.ts
│   │       ├── rotation.ts
│   │       ├── statistics.ts
│   │       └── seasonStats.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── Dockerfile
│   └── package.json
│
└── analysis-service/                 # Python FastAPI microservice
    ├── main.py
    ├── db.py
    ├── orchestrator.py
    ├── models.py
    ├── analysis/
    │   ├── profiles.py
    │   ├── rotation_profiles.py
    │   ├── set_profiles.py
    │   ├── score_context.py
    │   ├── simulation.py
    │   ├── substitution_impact.py
    │   ├── timeout_impact.py
    │   ├── tus_retrospective.py
    │   ├── season_prior.py
    │   ├── clustering.py
    │   └── outcome_tracker.py
    ├── insights/
    │   ├── assembler.py
    │   ├── strengths.py
    │   ├── weaknesses.py
    │   └── thresholds.py
    ├── tests/
    ├── requirements.txt
    ├── Dockerfile
    └── .env.example
```

---

## 5. Database schema

### Table: `users`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
email         TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
role          TEXT NOT NULL DEFAULT 'player'  -- manager | player
team_id       UUID REFERENCES teams(id) ON DELETE SET NULL
created_at    TIMESTAMPTZ DEFAULT now()
```

### Table: `teams`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          TEXT NOT NULL
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

### Table: `players`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id             UUID REFERENCES teams(id) ON DELETE CASCADE
user_id             UUID REFERENCES users(id) ON DELETE SET NULL  -- linked login account (nullable)
first_name          TEXT NOT NULL
last_name           TEXT NOT NULL
birthday            DATE
height_m            NUMERIC(3,2)
jersey              INTEGER
positions           TEXT[] NOT NULL  -- Setter | Outside | Opposite | Middle | Libero | DS
is_libero           BOOLEAN DEFAULT false
has_referee_license BOOLEAN DEFAULT false
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

### Table: `seasons`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id       UUID REFERENCES teams(id) ON DELETE CASCADE
name          TEXT NOT NULL
start_date    DATE NOT NULL
end_date      DATE
is_active     BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()
```

Constraints:
- `CREATE UNIQUE INDEX one_active_season_per_team ON seasons(team_id) WHERE is_active = true`

### Table: `matches`
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id           UUID REFERENCES teams(id) ON DELETE CASCADE
season_id         UUID REFERENCES seasons(id) ON DELETE SET NULL
match_type        TEXT NOT NULL DEFAULT 'playing'  -- playing | officiating
opponent          TEXT
opponent_initials TEXT
home_team         TEXT
guest_team        TEXT
date              TIMESTAMPTZ NOT NULL
location          TEXT
first_serve       TEXT DEFAULT 'us'
sets_played       INTEGER DEFAULT 0
score_us          INTEGER[] DEFAULT '{0,0,0,0,0}'
score_them        INTEGER[] DEFAULT '{0,0,0,0,0}'
sets_won_us       INTEGER DEFAULT 0
sets_won_them     INTEGER DEFAULT 0
status            TEXT DEFAULT 'upcoming'  -- upcoming | in_progress | completed
ref1_id           UUID REFERENCES players(id) ON DELETE SET NULL
ref2_id           UUID REFERENCES players(id) ON DELETE SET NULL
scorer1_id        UUID REFERENCES players(id) ON DELETE SET NULL
scorer2_id        UUID REFERENCES players(id) ON DELETE SET NULL
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

### Table: `match_players`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id    UUID REFERENCES matches(id) ON DELETE CASCADE
player_id   UUID REFERENCES players(id) ON DELETE CASCADE
UNIQUE(match_id, player_id)
```

### Table: `sets`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id        UUID REFERENCES matches(id) ON DELETE CASCADE
set_number      INTEGER NOT NULL
starting_lineup JSONB NOT NULL
serving_first   TEXT NOT NULL DEFAULT 'us'
status          TEXT DEFAULT 'in_progress'  -- in_progress | completed
score_us        INTEGER DEFAULT 0
score_them      INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT now()
```

### Table: `rallies`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
set_id          UUID REFERENCES sets(id) ON DELETE CASCADE
rally_index     INTEGER NOT NULL
scorer          TEXT NOT NULL           -- us | them
point_type      TEXT NOT NULL           -- us_positive | us_error | them_positive | them_error
score_us        INTEGER NOT NULL
score_them      INTEGER NOT NULL
serving_team    TEXT NOT NULL
rotation_after  JSONB NOT NULL
rotated         BOOLEAN DEFAULT false
current_server  TEXT NOT NULL
logged_at       TIMESTAMPTZ DEFAULT now()
```

### Table: `substitutions`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
set_id          UUID REFERENCES sets(id) ON DELETE CASCADE
rally_index     INTEGER NOT NULL
player_out_id   UUID REFERENCES players(id) ON DELETE SET NULL
player_in_id    UUID REFERENCES players(id) ON DELETE SET NULL
is_libero_swap  BOOLEAN DEFAULT false
at_score_us     INTEGER NOT NULL
at_score_them   INTEGER NOT NULL
logged_at       TIMESTAMPTZ DEFAULT now()
```

### Table: `timeouts`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
set_id          UUID REFERENCES sets(id) ON DELETE CASCADE
rally_index     INTEGER NOT NULL
called_by       TEXT NOT NULL  -- us | them
at_score_us     INTEGER NOT NULL
at_score_them   INTEGER NOT NULL
logged_at       TIMESTAMPTZ DEFAULT now()
```

### Table: `training_sessions`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id         UUID REFERENCES teams(id) ON DELETE CASCADE
date            DATE NOT NULL
start_time      TIME NOT NULL
end_time        TIME
title           TEXT NOT NULL
notes           TEXT
location        TEXT
focus_tags      TEXT[]  -- e.g. ['serve', 'reception', 'block', 'rotation']
created_by      UUID REFERENCES users(id) ON DELETE SET NULL
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Table: `training_attendance`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
training_session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE
player_id           UUID REFERENCES players(id) ON DELETE CASCADE
status              TEXT NOT NULL DEFAULT 'pending'  -- pending | coming | not_coming
note                TEXT  -- optional player note (e.g. "late arrival")
responded_at        TIMESTAMPTZ
UNIQUE(training_session_id, player_id)
```

### Table: `match_analysis`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id        UUID REFERENCES matches(id) ON DELETE CASCADE
status          TEXT DEFAULT 'pending'
                -- pending | running | ready | insufficient_data | error
result          JSONB
insights        JSONB
error_message   TEXT
n_rallies       INTEGER
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### Table: `training_priorities`
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
team_id           UUID REFERENCES teams(id) ON DELETE CASCADE
source_match_id   UUID REFERENCES matches(id) ON DELETE SET NULL
insight_type      TEXT NOT NULL    -- improve | reinforce
priority_class    TEXT NOT NULL
metric            TEXT NOT NULL
baseline_value    NUMERIC NOT NULL
target_value      NUMERIC NOT NULL
direction         TEXT NOT NULL    -- up | down
label             TEXT NOT NULL
note              TEXT
status            TEXT DEFAULT 'active'
                  -- active | improving | resolved | regressed | dismissed
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

### Table: `priority_outcomes`
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
priority_id           UUID REFERENCES training_priorities(id) ON DELETE CASCADE
measured_match_id     UUID REFERENCES matches(id) ON DELETE CASCADE
measured_value        NUMERIC NOT NULL
delta                 NUMERIC NOT NULL
verdict               TEXT NOT NULL  -- improved | no_change | regressed
created_at            TIMESTAMPTZ DEFAULT now()
```

---

## 6. Routing & role guards

```
/                           → redirect to /dashboard
/dashboard                  → KPIs and upcoming games (all roles)
/games                      → games list (all roles: read; manager: create/edit)
/games/new                  → create game wizard (manager only)
/games/[id]/log             → live logging screen (manager only)
/games/[id]/stats           → post-match stats + analysis (all roles)
/trainings                  → training sessions list (all roles)
/trainings/new              → create training session (manager only)
/trainings/[id]             → training session detail + attendance (all roles)
/players                    → roster (manager: full CRUD; player: view own profile)
/players/new                → add player (manager only)
/players/[id]               → edit player (manager) / view profile (player, own only)
/settings                   → app settings (manager: full; player: password only)
/settings/seasons           → season management (manager only, hidden from nav)
/auth/login                 → login page
/auth/register              → register page (creates team + manager account)
```

**Role guard implementation:**
```typescript
// router/index.tsx
<Route path="/games/new" element={<ManagerOnly><CreateGameWizard /></ManagerOnly>} />
<Route path="/games/:id/log" element={<ManagerOnly><GameLogPage /></ManagerOnly>} />
<Route path="/trainings/new" element={<ManagerOnly><TrainingForm /></ManagerOnly>} />
```

```typescript
// hooks/useRole.ts
export function useRole() {
  const { user } = useAuthStore()
  return {
    isManager: user?.role === 'manager',
    isPlayer:  user?.role === 'player',
    canLog:    user?.role === 'manager',
    canCreate: user?.role === 'manager',
  }
}
```

---

## 7. Auth

JWT-based authentication (Express backend).

- **Register** — creates `users` row with `role = 'manager'`, creates `teams` row, links them
- **Player invite** — manager creates a `players` row first, then invites via email (generates
  a one-time token); player sets password and gains `role = 'player'` linked to that player record
- **Tokens** — access token (15 min), refresh token (30 days), both as HttpOnly cookies
- **Password** hashed with bcrypt (salt rounds = 12)
- All API routes require a valid access token; role-restricted routes additionally check `user.role`

---

## 8. Page specifications

---

### 8.1 Auth

**Login `/auth/login`:** Email + password → JWT → redirect to `/dashboard`

**Register `/auth/register`:** Email + password + team name → creates user (manager) + team → redirect to `/dashboard`

---

### 8.2 Dashboard `/dashboard`

Available to all roles. Content adapts based on role.

**Mobile layout:** Single scrollable column.
**Tablet layout:** 2-column grid for KPI cards, full-width charts.

**KPI cards (2×2 on mobile, 4 across on tablet):**
1. Win / Loss record (matches) — green if winning record, red if losing
2. Win / Loss record (sets)
3. Points — scored vs conceded
4. Total playing time — `Xh Ym`

All KPIs scoped to the active season.

**Upcoming section (horizontal scroll cards):**
- Upcoming playing games (date ≥ today) — opponent, date, location
- Upcoming officiating games — home vs guest, date, location
- Upcoming training sessions — title, date, location, player's own RSVP status

**Recent analysis (manager only):**
- Cards showing the latest completed match analysis results (top 1 strength, top 1 weakness, top action item)
- "View full analysis" link → `/games/[id]/stats`

**Charts section (Recharts, full-width on mobile):**
1. Win/Loss trend — bar chart, x = match, y = sets won/lost
2. Sideout % vs Break point % trend — dual line chart
3. Error ratio trend — line chart per match
4. Points scored vs conceded per match — grouped bar chart
5. Rotation heatmap — grid: rows = rotations 1–6, columns = matches; cell = win rate (green/red)

---

### 8.3 Games list `/games`

All roles can view. Managers see edit/log/delete actions; players see only the list and stats links.

**Filter bar (horizontal scroll on mobile):** All | Playing | Officiating | Sort options

**Game card/row:**
- Date, opponent (or "Home vs Guest"), location
- Win/Loss badge, score per set
- Action icons (manager only): ✏️ Edit · 📋 Log (today only) · 🗑 Delete

**Empty states:** as per original spec.

---

### 8.4 Trainings `/trainings`

**This tab replaces Seasons in the main navigation.**

All roles can view. Managers can create/edit/delete sessions.

**Mobile layout:** Scrollable list of training cards, grouped by upcoming / past.

**Training card displays:**
- Date + time (formatted: "Mon 22 May · 18:00–20:00")
- Title (e.g. "Serve & Reception Drill")
- Location
- Focus tags (pill badges): e.g. `serve` `reception`
- RSVP summary: "8 coming · 2 not coming · 3 pending"
- Player's own RSVP status badge (for player role): COMING / NOT COMING / PENDING

**Actions:**
- **Manager:** Edit · Delete (with confirmation) · View attendance roster
- **Player:** Toggle own RSVP status (COMING / NOT COMING)

**Create training button:** FAB at bottom right (manager only).

**Empty state:** "No training sessions scheduled yet."

---

### 8.5 Training session detail `/trainings/[id]`

**Header:**
- Title, date + time, location
- Focus tags
- Notes (coach's description of the session plan)
- Edit button (manager only)

**Attendance roster (manager view):**

Three sections: Coming · Not Coming · Pending

Each player row: jersey number · full name · position tag · optional note · RSVP timestamp

Aggregate counts shown at top: "8 / 14 confirmed coming"

**Player view:**
- Own RSVP card at top with large toggle: COMING / NOT COMING
- Optional note field ("I'll arrive 15 min late")
- List of confirmed attendees (names only, no status details of others visible to players)

---

### 8.6 Create / Edit training session

Form fields (manager only):
- Title (text, required)
- Date (date picker, required)
- Start time (time picker, required)
- End time (time picker, optional)
- Location (text, optional)
- Focus tags (multi-select chips): Serve · Reception · Attack · Block · Defence · Rotation · Fitness · Set piece
- Notes (textarea, optional)
- Notify players (toggle, default on) — sends in-app notification to all team members

Save / Cancel buttons.

---

### 8.7 Create game wizard `/games/new` (manager only)

**Step indicator:** Dots/numbered steps at top. Back button always visible.

#### If Playing:

**Step 1 — Match details**
- Season — dropdown pre-selected to active season (required)
- Opponent name (required)
- Opponent initials (max 6 chars, auto-suggested)
- Date & time (defaults to today)
- Location (optional)
- Who serves first? — "Us" | "Them" toggle

**Step 2 — Player selection**
- Full roster checklist: jersey · name · position tags · Libero badge
- Tap to toggle; minimum 6 players; "Select all" / "Clear all"
- Selected count shown

**Step 3 — Define starting lineup (Set 1)**

SVG court diagram — our half only, top-down:
- Six zones (FIVB numbering: zone 1 = back right, counter-clockwise)
- Mobile: tap zone → tap player to assign; Tablet+: drag-and-drop
- Multi-position players → position selector sheet on assignment
- `setPositions` map stored in `starting_lineup` JSONB
- Libero must be in back-row zone (1, 5, or 6) — validated on confirm

Buttons once all 6 zones filled:
- **Confirm** → saves match + set 1 → redirect to `/games`
- **Confirm & Log** → saves match + set 1 → redirect to `/games/[id]/log`

#### If Officiating:

Single form: Home team · Guest team · Date & time · Location · Ref 1 · Ref 2 · Scorer 1 · Scorer 2

Submit → `match_type = 'officiating'` → redirect to `/games`

---

### 8.8 Live logging screen `/games/[id]/log` (manager only)

#### Header (sticky)
```
← [back]    vs OPPONENT · SET 1    [score: 8 – 6]
```

#### Tab bar (sticky)
Log · Stats · Timeline

#### Log tab

**Court display (~45% viewport height):**

SVG top-down full court:
- Our side (bottom): player tokens in current rotation zones
  - Token: rounded rectangle, abbreviated name + jersey (e.g. "Sara K. #4")
  - Token colours: Setter=purple, Outside=blue, Opposite=lighter blue, Middle=teal, Libero=orange, DS=gray
  - Current server token: accent border + volleyball icon
  - Zone labels (1–6) dimmed in each corner
- Opponent side (top): empty court + opponent initials + score
- Net: horizontal center line
- Rotation animation: 400ms CSS transition on side-out + "↻ Rotation" toast

**Score controls:**

*Step 1 — Who scored?*
Two full-width pill buttons (56px min height):
```
[ OUR TEAM NAME ⊕ ]    [ OPPONENT INITIALS ⊕ ]
```

*Step 2 — How? (appears after step 1 tap, 200ms delay)*
```
[ ✓ Own point ]    [ ✗ Their error ]
```
(labels flip depending on scorer)
- 4-second auto-fallback to "Own point" with progress bar countdown
- 200ms delay before step 2 appears to prevent accidental double-tap

**Undo button:** below score controls — rolls back last committed rally (up to 3 deep)

**Icon row:**
- ✏️ Edit lineup (only before first rally)
- 🔄 Substitution modal
- ⏱ Timeout modal
- 🏁 End set (when score conditions met)

**Substitution modal:**
- Player off (on-court dropdown) · Player in (bench dropdown)
- Libero swaps: `is_libero_swap = true`, does not count against limit
- Counter: "2/6 substitutions used"

**Timeout modal:**
- "Called by Us" (primary) | "Called by Them" (secondary)
- Optional 30-second countdown timer

**End set flow:**
- Confirmation: "End Set N? Score: X – Y"
- Confirm → set completed → next set lineup setup (pre-filled from current rotation)
- After Set 5: "End Match" → `status = 'completed'` → API triggers analysis service

#### Stats tab (live, all roles who can view the match)

Live statistics computed client-side from rally data fetched via polling.

**Timeout Urgency Score (TUS) — computed client-side:**

All computation runs in `lib/tus.ts` in the browser using the rally sequence from the Zustand store + TanStack Query cache. No API call needed.

```
Signal 1 — Momentum (30%):
  momentum_raw = (our_points_last6 - their_points_last6) / 6
  momentum_signal = (1 - ((momentum_raw + 1) / 2))

Signal 2 — Error ratio (25%):
  rolling_errors = count(us_error OR them_positive in last 6 rallies)
  error_signal = 0.5 × (rolling_errors/6) + 0.5 × clustering_index

Signal 3 — Lead/deficit (25%):
  deficit = max(0, their_score - our_score) / 10
  deficit_trend_normalised = max(0, min(1, (deficit_trend + 1) / 2))
  lead_deficit_signal = 0.5 × deficit + 0.5 × deficit_trend_normalised

Signal 4 — Positive play trend (20%):
  positive_signal = max(0, min(1, trend_raw / 0.5 + 0.5))

TUS = 0.30×momentum + 0.25×error + 0.25×lead_deficit + 0.20×positive
```

Cold start: first 6 rallies → use available window, show "Building..." label.

Display: large bar at top of Stats tab.
| TUS | Label | Colour |
|---|---|---|
| 0.00–0.30 | Stable | Green |
| 0.31–0.55 | Watch | Amber |
| 0.56–0.75 | Consider timeout | Orange |
| 0.76–1.00 | Call timeout now | Red + pulse |

Expandable TUS breakdown (tap to expand).

**Error pressure (client-side):**
- Rolling 6 + cumulative error ratio with interpretation labels
- Error clustering (Wald-Wolfowitz) — computed in `lib/clustering.ts`

**Rotation statistics (client-side):** Table: Rotation · W · L · Serve% · Receive%

**Total points section:** Our/their total points + errors

#### Timeline tab

Reverse-chronological rally list. Each row:
```
[S2] [14–11]  ✓ Our point · Own play    ↺ Rotated
```
Substitution and timeout rows appear inline.
Tap rally → delete option (with confirmation; recomputes subsequent rotations).

---

### 8.9 Post-match stats `/games/[id]/stats`

Available to all roles.

**Set filter:** pill tabs — All · Set 1 · Set 2 · Set 3 · Set 4 · Set 5

**Match summary card:** Date · Opponent · Location · Final score · Set scores table · Total rallies · Duration

**Point quality breakdown:**
- Positive play % · Error-forced loss % · Break point quality · Sideout quality
- Benchmarks: ≥60% "Assertive" (green) · 40–59% "Balanced" (amber) · <40% "Error-dependent" (red)

**Rotation statistics table:** 6 rows, columns: Zone 1 player · Rallies · W · L · Break% · Sideout% · Net%

**Error pressure:** Cumulative error ratio · Error clustering index · Per-set error ratio trend

**TUS timeline chart:** Line chart, x=rally index, y=TUS; timeout lines; scoring run shading

**Score timeline chart:** Line chart, x=rally index, y=score difference; set boundary lines

**Analysis section (below stats):**

Displays the output of the analysis microservice. Shows a loading state while `match_analysis.status = 'pending' | 'running'`.

*Analysis loading state:*
```
⚙ Analysing match data...
Usually ready within 30 seconds.
```
React Query polls `GET /api/games/[id]/analysis` every 3 seconds until `status = ready`.

*Analysis ready:*

Three card groups:
1. **Strengths** (green cards) — what is working well, ranked by impact
2. **Weaknesses** (red cards) — areas to address, ranked by simulation impact + win rate delta
3. **Action items** (orange cards) — top 3 coaching priorities with specific training recommendations

Each card shows: title · detail text · current value · target value · impact ("+" or "−" win rate)

*Simulation summary (collapsible):*
- Baseline win probability
- Score distribution (3-0 / 3-1 / 3-2 / etc.)
- Top sensitivity scenario and its win rate delta

*Previous priority outcomes (if active priorities exist):*
- Per-priority: label · baseline · current · delta · verdict badge (Improved / No change / Regressed)

**Export:**
- Download CSV (rally data)
- Download PDF (full stats report including analysis cards)

---

### 8.10 Roster `/players`

**Manager view:** Full CRUD — list of all player cards with Edit / Delete actions + Add Player FAB.

**Player view:** List of team members (names, positions, jersey numbers only). Player can tap own card → `/players/[id]` to view own profile. Cannot view other players' private details (birthday, height).

**Player card displays:**
- Jersey number (large, accent coloured)
- Full name
- Position badges
- Height + birthday (manager only)
- Referee license icon if applicable

---

### 8.11 Add / Edit player `/players/new` and `/players/[id]` (manager only for edit)

Form fields:
- First name + last name (required)
- Birthday · Height · Jersey number (optional)
- Positions (multi-select chips): Setter · Outside · Opposite · Middle · Libero · DS
- Referee license toggle
- **Invite to app** (optional toggle) — on save, sends invite email with one-time link to create player login

---

### 8.12 Settings `/settings`

**Manager access:**
- Team name (editable)
- Account email (read-only)
- Change password
- TUS window size (default 6, range 4–10)
- TUS weights (collapsible advanced section): Momentum · Error ratio · Lead/deficit · Positive play — must sum to 100%
- Dark / Light mode toggle
- Export all data (JSON)
- **Season management** (hidden from main nav, accessible here only):
  - List seasons · Create season · Edit season · Set active season
  - Same UI as original seasons spec, just accessed from Settings
- Danger zone: Delete all match data · Delete account

**Player access:**
- Change password only

---

## 9. Rotation logic

### Zone numbering (FIVB standard)
```
        NET
─────────────────────
│  4  │  3  │  2  │   ← front row
│─────│─────│─────│
│  5  │  6  │  1  │   ← back row
─────────────────────
     OUR BASELINE
```
Zone 1 = back right = server. Rotation direction (clockwise from above): 1→2→3→4→5→6→1.

### Rotation function (shared: `api/src/lib/rotation.ts` + `web/src/lib/rotation.ts`)
```typescript
type Zone = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6'
type Lineup = Record<Zone, string>  // zone → player_id

function rotate(lineup: Lineup): Lineup {
  return {
    zone1: lineup.zone2,
    zone2: lineup.zone3,
    zone3: lineup.zone4,
    zone4: lineup.zone5,
    zone5: lineup.zone6,
    zone6: lineup.zone1,
  }
}
```

### Point scoring rules
```typescript
function addPoint({ scorer, currentServer, currentLineup }): {
  newLineup: Lineup, rotated: boolean, newServer: 'us' | 'them'
} {
  if (scorer === 'us' && currentServer === 'them')
    return { newLineup: rotate(currentLineup), rotated: true, newServer: 'us' }
  if (scorer === 'us' && currentServer === 'us')
    return { newLineup: currentLineup, rotated: false, newServer: 'us' }
  if (scorer === 'them' && currentServer === 'us')
    return { newLineup: currentLineup, rotated: false, newServer: 'them' }
  return { newLineup: currentLineup, rotated: false, newServer: 'them' }
}
```

### Rotation identification (setter-zone based)

Rotation number = zone the designated setter occupies. Setter identified from `startingLineup.setPositions`. This is authoritative — the setter is whoever has `"Setter"` in their confirmed `setPositions`.

Fallback (legacy sets without `setPositions`): pick the player with `'Setter'` in their `positions` array, preferring the most specialised (fewest total positions).

### Libero rule
Libero may replace any back-row player freely. Recorded with `is_libero_swap = true`. Does not count against 6-substitution limit.

---

## 10. Statistics computation

All match statistics that are shown **live during logging** are computed **client-side** in `web/src/lib/statistics.ts` from the in-memory rally list.

All **post-match statistics** are computed **server-side** in `api/src/lib/statistics.ts` via the `/api/games/[id]/stats` endpoint.

All **post-match AI analysis** (simulation, insights, training priorities) is produced by the **Python analysis microservice** and stored in `match_analysis`. The Express API relays results to the frontend.

### Live (client-side) computations

| Metric | Location |
|---|---|
| TUS | `web/src/lib/tus.ts` |
| Error ratio (rolling + cumulative) | `web/src/lib/statistics.ts` |
| Error clustering (Wald-Wolfowitz) | `web/src/lib/clustering.ts` |
| Rotation statistics (per-rotation W/L) | `web/src/lib/statistics.ts` |
| Sideout % + Break % (live) | `web/src/lib/statistics.ts` |

### Post-match (server-side, Express API)

Sideout %, Break %, Error ratio, Positive play %, Rotation stats — see original formulas below:

**Sideout %:** `rallies(scorer='us' AND serving_team='them') / rallies(serving_team='them') × 100`

**Break %:** `rallies(scorer='us' AND serving_team='us') / rallies(serving_team='us') × 100`

**Error ratio:** `count(point_type IN ('us_error','them_positive') AND scorer='them') / total rallies(scorer='them')`

**Positive play %:** `count(point_type='us_positive') / count(scorer='us') × 100`

---

## 11. API routes (Express)

All routes require a valid JWT. Role-restricted routes additionally require `role = 'manager'`.

### Auth
```
POST  /api/auth/register           create user (manager) + team
POST  /api/auth/login              returns access + refresh tokens
POST  /api/auth/refresh            refreshes access token
POST  /api/auth/invite/[playerId]  manager sends player invite (manager only)
POST  /api/auth/accept-invite      player sets password via one-time token
```

### Players
```
GET    /api/players                list all players for team (all roles)
POST   /api/players                create player (manager only)
GET    /api/players/[id]           get player (manager: full; player: own only)
PATCH  /api/players/[id]           update player (manager only)
DELETE /api/players/[id]           delete player (manager only)
```

### Seasons (manager only — hidden from nav, accessed via Settings)
```
GET    /api/seasons                list all seasons
POST   /api/seasons                create season
GET    /api/seasons/[id]           get season with computed stats
PATCH  /api/seasons/[id]           update season
DELETE /api/seasons/[id]           delete season
GET    /api/seasons/active         get active season
```

### Matches
```
GET    /api/games                  list matches (all roles; filterable)
POST   /api/games                  create match (manager only)
GET    /api/games/[id]             get match with sets summary (all roles)
PATCH  /api/games/[id]             update match (manager only)
DELETE /api/games/[id]             delete match (manager only)
GET    /api/games/[id]/stats       computed match stats (all roles)
GET    /api/games/[id]/analysis    relay analysis status + insights (all roles)
```

### Sets
```
POST   /api/games/[id]/sets               create new set (manager only)
GET    /api/games/[id]/sets/[setId]       get set with rallies (all roles)
PATCH  /api/games/[id]/sets/[setId]       update set status/score (manager only)
```

### Rallies
```
GET    /api/sets/[setId]/rallies          get all rallies (all roles)
POST   /api/sets/[setId]/rallies          add rally (manager only)
DELETE /api/sets/[setId]/rallies/last     undo last rally (manager only)
```

### Substitutions + Timeouts
```
POST   /api/sets/[setId]/substitutions   log substitution (manager only)
GET    /api/sets/[setId]/substitutions   get substitutions (all roles)
POST   /api/sets/[setId]/timeouts        log timeout (manager only)
GET    /api/sets/[setId]/timeouts        get timeouts (all roles)
```

### Training sessions
```
GET    /api/trainings                    list training sessions (all roles)
POST   /api/trainings                    create session (manager only)
GET    /api/trainings/[id]               get session with attendance (all roles)
PATCH  /api/trainings/[id]              update session (manager only)
DELETE /api/trainings/[id]              delete session (manager only)
```

### Attendance
```
GET    /api/trainings/[id]/attendance          get all attendance records (manager: all; player: own)
PATCH  /api/trainings/[id]/attendance/[playerId]  update own RSVP (player: own only; manager: any)
```
Request body: `{ status: 'coming' | 'not_coming', note?: string }`

### Statistics + Dashboard
```
GET    /api/dashboard                    dashboard KPIs + upcoming games + trainings
GET    /api/seasons/[id]/stats           season-level aggregated stats
```

### Analysis relay (proxies to FastAPI microservice)
```
GET    /api/games/[id]/analysis          get analysis status + insights (all roles)
GET    /api/training-priorities          get team's active priorities (manager only)
PATCH  /api/training-priorities/[id]    update priority note/status (manager only)
```

---

## 12. Analysis microservice (FastAPI, Python)

### Position in the stack
```
Express API
    │
    │  POST /analyse/{match_id}   (called when match status → completed)
    │  GET  /insights/{match_id}  (polled via Express relay)
    │  GET  /training/{team_id}   (polled via Express relay)
    ▼
FastAPI analysis service
    │
    ├── reads:   matches, sets, rallies, substitutions, timeouts,
    │            match_analysis, training_priorities, priority_outcomes
    │
    └── writes:  match_analysis, training_priorities, priority_outcomes
    │
    ▼
PostgreSQL (shared with Express API)
```

When a match is marked as completed, the Express API calls `POST /analyse/{match_id}` on the analysis service. The frontend polls `GET /api/games/[id]/analysis` (Express) every 3 seconds until `status = ready`.

### Endpoints

#### POST `/analyse/{match_id}`
Queues background analysis task. Sets `match_analysis.status = 'running'`.
```json
Response: { "status": "queued", "match_id": "uuid", "estimated_seconds": 30 }
```

#### GET `/insights/{match_id}`
```json
Response: {
  "status": "pending|running|ready|insufficient_data|error",
  "match_id": "uuid",
  "n_rallies": 125,
  "baseline_win_pct": 0.42,
  "insights": [...InsightCard],
  "simulation_summary": {...},
  "updated_at": "ISO8601"
}
```

#### GET `/training/{team_id}`
```json
Response: {
  "active_priorities": [...TrainingPriority],
  "resolved_priorities": [...TrainingPriority],
  "last_updated_match_id": "uuid"
}
```

#### PATCH `/training/priority/{priority_id}`
Coach note + status update.

#### POST `/training/session`
Log a training session (syncs with app's training_sessions table).

#### GET `/health`
```json
{ "status": "ok", "db": "connected" }
```

---

### Analysis modules

All modules receive a subset of `MatchData` and return typed dicts. No module writes to the DB — only `orchestrator.py` does.

#### `profiles.py` — flat probability profiles

Computes 4-component probability vector for serve and receive situations.

```python
INDEX = {
  'us_positive': 0,    # we score via positive play
  'them_positive': 1,  # they score via positive play
  'them_error': 2,     # we score via their error
  'us_error': 3,       # they score via our error
}
```

Output: `{ 'us': { 'on_serve': [...], 'on_receive': [...] }, 'opponent': {...}, 'serve_rallies': int, 'receive_rallies': int }`

Minimum: 10 serve + 10 receive rallies. Below threshold → `None` + `insufficient_data` flag.

#### `rotation_profiles.py` — per-rotation profiles

Separate probability profile for each rotation (1–6). Rotation identified from `rotation_after` JSONB.

Key metrics per rotation: win_rate · break_pct · sideout_pct · error_rate_serve · error_rate_receive · positive_play_serve · positive_play_receive

**Rotation Efficiency (RE):**
```python
RE = (normalised_win + quality_sideout + quality_break) / 3
# Benchmarks: ≥0.65 Strong | 0.50–0.64 Solid | 0.35–0.49 Weak | <0.35 Critical
```

**Team Rotation Efficiency (TRE):** Weighted average RE across all rotations by rally count.

**Rotation Balance Index (RBI):** `max(0, 1 - std(RE values) / 0.5)` — 1.0 = perfectly balanced.

#### `set_profiles.py` — per-set profile comparison

Detects whether performance deteriorates, improves, or stays stable across sets.

Trend classification via linear regression across sets. Slope >+0.03 = improving, <-0.03 = deteriorating.

Late match drop: if sets 4/5 win rate >8pp below average of sets 1–3 → `late_match_drop = True`.

#### `score_context.py` — pressure situation profiling

Segments rallies by score context:
- `comfortable_lead` (≥+5) · `leading` (+2 to +4) · `level` (-1 to +1) · `trailing` (-2 to -4) · `significant_deficit` (≤-5)

Output includes `pressure_sensitivity` (win rate delta: level vs comfortable_lead) and `clutch_score` (win rate when both scores ≥20).

#### `simulation.py` — Monte Carlo + sensitivity analysis

Runs 10,000 simulations using probability profiles + Bayesian season prior.

**Sensitivity scenarios (12 total):** 5pp/10pp improvements to own errors and positive play in serve/receive, plus combined scenarios.

Output: `baseline_win_pct · score_distribution · avg_sets_played · set_win_rates · sensitivity (per scenario: win_rate, delta, delta_pct) · top_intervention · ranking`

#### `substitution_impact.py` — substitution effectiveness

Window: 8 rallies before/after each substitution. Minimum 4 each side.

Verdict: `effective` (delta_win_rate >+0.08) · `neutral` · `ineffective` (<-0.08)

#### `timeout_impact.py` — timeout effectiveness

Window: 5 rallies before/after. Includes: run_before (opponent run length), tus_at_timeout.

Aggregate output: per-side effectiveness counts + **missed timeout moments** (TUS >0.75 with no timeout within next 3 rallies).

#### `tus_retrospective.py` — TUS replay and annotation

Replays TUS calculation for full match using stored rallies + configured weights.

Output: tus_timeline · peak_tus · time_above_75 · time_above_55 · missed_timeouts · timely_timeouts · late_timeouts

#### `season_prior.py` — Bayesian season prior

Aggregates previous match rallies from season into Dirichlet concentration parameters.

Cold start: 0 matches → uniform prior `[2.0, 2.0, 2.0, 2.0]`; 1–4 matches → weak prior; 5+ → data-driven.

#### `clustering.py` — Wald-Wolfowitz error clustering
```python
def wald_wolfowitz(sequence: list[int]) -> float:
    # sequence: binary, 1 = error rally, 0 = clean
    # returns clustering_index in [0,1], or -1 if insufficient (n1<5 or n0<5)
    Z = (runs - ER) / sqrt(VR)
    return min(1.0, max(0.0, -Z / 3))
```

#### `outcome_tracker.py` — training priority outcome measurement

Compares newly computed metrics against all active training priorities.

Verdicts: `improved` (delta ≥0.02 correct direction) · `regressed` (≥0.02 wrong) · `no_change`

Status upgrades: `improving` after 1 improved · `resolved` after 2 consecutive improved + crossed target · `regressed` after 2 consecutive regressed

---

### Insight card schema
```python
class InsightCard:
    id:              str        # unique slug, e.g. 'strength_rotation_2'
    category:        str        # 'strength' | 'weakness' | 'action_item'
    priority:        int        # 1 = most important
    title:           str
    detail:          str        # coached explanation
    metric:          str        # internal metric key
    current_value:   float
    target_value:    float | None
    direction:       str        # 'up' | 'down' | 'maintain'
    impact:          str | None # e.g. '+2.4% win rate if addressed'
    source:          str
    data:            dict       # raw numbers for chart rendering
```

### Strengths detection thresholds

| Metric | Threshold | Direction | Label |
|---|---|---|---|
| own_pos_serve | 0.30 | above | Strong serving pressure |
| own_pos_receive | 0.33 | above | Strong attack conversion on reception |
| opp_err_serve | 0.20 | above | Serving disrupts opponents effectively |
| own_err_serve | 0.28 | below | Disciplined in service rallies |
| own_err_receive | 0.25 | below | Disciplined in reception rallies |
| break_pct | 0.45 | above | Effective break point conversion |
| sideout_pct | 0.55 | above | Reliable sideout efficiency |
| timeout_effectiveness | 0.60 | above | Timeouts are working — call them early |
| clutch_score | 0.50 | above | Performs well under end-game pressure |
| rotation_N_re | 0.65 | above | Rotation N is a structural strength |
| rbi | 0.70 | above | Consistent across all rotations |

### Weakness detection thresholds

| Metric | Threshold | Direction | Label |
|---|---|---|---|
| own_err_serve | 0.30 | above | Service rally errors too high |
| own_err_receive | 0.25 | above | Reception rally errors too high |
| own_pos_receive | 0.25 | below | Sideouts rely on opponent errors |
| own_pos_serve | 0.25 | below | Limited positive play on service |
| sideout_pct | 0.45 | below | Sideout efficiency below minimum |
| break_pct | 0.38 | below | Struggling to break serve |
| clutch_score | 0.42 | below | Performance drops under end-game pressure |
| late_match_drop | 0.5 | above | Performance deteriorates in late sets |
| error_clustering | 0.50 | above | Errors come in bursts |
| rotation_N_re | 0.35 | below | Rotation N is critically weak |
| rbi | 0.50 | below | Large performance gap between rotations |
| pressure_sensitivity | -0.08 | below | Win rate drops significantly when trailing |

### Action item text templates

Action items are generated for the top 3 weaknesses by impact. Each references:
- Current measured value + target threshold
- Specific training drill recommendation
- Simulation-derived win rate improvement if addressed

### Minimum data requirements

| Module | Minimum | Fallback |
|---|---|---|
| profiles | 20 total (10+10) | Skip simulation |
| rotation_profiles | 6 per rotation | Flag low_sample |
| set_profiles | 2 sets ≥8 rallies each | Skip trend |
| score_context | 5 per segment | Skip segment |
| simulation | Requires profiles | Skip if missing |
| substitution_impact | 4 before + 4 after | Flag insufficient |
| timeout_impact | 3 before + 3 after | Flag insufficient |
| clustering | n1≥5 AND n0≥5 | Return -1 |
| season_prior | 0 matches | Use flat prior |

Total <20 rallies → `status = 'insufficient_data'`, no insight cards.

---

## 13. Zustand stores

### matchStore (live match state)
```typescript
interface MatchStore {
  matchId: string | null
  currentSetId: string | null
  currentSetNumber: number
  lineup: Lineup
  servingTeam: 'us' | 'them'
  scoreUs: number
  scoreThem: number
  rallyCount: number
  scoringStep: 'idle' | 'awaiting_type'
  pendingScorer: 'us' | 'them' | null
  autoFallbackTimer: ReturnType<typeof setTimeout> | null
  // actions
  initMatch: (matchId: string) => Promise<void>
  tapScore: (scorer: 'us' | 'them') => void
  tapPointType: (type: 'positive' | 'error') => void
  commitRally: (scorer: 'us' | 'them', pointType: string) => Promise<void>
  undoLastRally: () => Promise<void>
  refreshFromDB: () => Promise<void>
}
```

On `commitRally`: optimistic update → POST to API → sync from response → rollback on failure.

When `commitRally` results in `match.status = 'completed'`, the Express API automatically calls `POST /analyse/{match_id}` on the analysis microservice.

### authStore
```typescript
interface AuthStore {
  user: { id: string; email: string; role: 'manager' | 'player'; playerId?: string } | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}
```

### seasonStore
```typescript
interface SeasonStore {
  activeSeason: Season | null
  allSeasons: Season[]
  setActiveSeason: (season: Season) => void
  loadSeasons: () => Promise<void>
}
```
Active season persisted in `localStorage`. On app load, falls back to `is_active = true` season or most recently created.

---

## 14. Mobile UX considerations

- **Touch targets:** All interactive elements minimum 44×44px.
- **Bottom sheet modals:** Substitution, timeout, end-set — slide up from bottom.
- **Tap vs drag:** Mobile (<768px) uses tap-to-select then tap-to-assign for lineup. Drag-and-drop enabled on tablet+.
- **Landscape mode (phone):** Court compresses to 35% height, score controls move to sidebar column.
- **Prevent scroll on court:** Court SVG area uses `touch-action: none`.
- **Score controls spacing:** 16px gap between Step 1 buttons; Step 2 appears with 200ms delay.
- **Auto-fallback countdown:** 4-second progress bar; cancellable by tapping outside Step 2 buttons.
- **Player RSVP:** Training attendance toggle is large (56px) and prominently placed.

---

## 15. Real-time behaviour

- Rally state committed to DB on each tap (not batched).
- TanStack Query polls current set state with 2-second interval during live logging.
- TUS computed client-side from in-memory rally list.
- Two devices open on same match sync within ~2 seconds via polling.
- Optimistic UI: court + score update immediately; rollback if API fails.
- Analysis microservice: Express calls it on match completion; frontend polls every 3 seconds via React Query.

---

## 16. Analysis service Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### requirements.txt
```
fastapi>=0.111
uvicorn[standard]>=0.29
asyncpg>=0.29
sqlalchemy[asyncio]>=2.0
numpy>=1.26
scipy>=1.12
pandas>=2.2
python-dotenv>=1.0
pydantic>=2.7
httpx>=0.27
```

---

## 17. Testing

```
tests/
├── web/                              # React component + hook tests (Vitest)
│   ├── rotation.test.ts
│   ├── statistics.test.ts
│   ├── tus.test.ts
│   └── clustering.test.ts
│
├── api/                              # Express route integration tests (Jest)
│   ├── auth.test.ts                  # role guards, invite flow
│   ├── seasons.test.ts
│   ├── rallies.test.ts
│   ├── undo.test.ts
│   ├── substitution.test.ts
│   ├── trainings.test.ts             # CRUD + attendance RSVP
│   └── attendance.test.ts            # player can only update own RSVP
│
├── analysis-service/                 # Python pytest
│   ├── test_profiles.py
│   ├── test_simulation.py
│   ├── test_rotation_profiles.py
│   ├── test_substitution_impact.py
│   ├── test_timeout_impact.py
│   ├── test_clustering.py
│   ├── test_outcome_tracker.py
│   └── test_assembler.py
│
└── e2e/                              # Playwright
    ├── auth.spec.ts                  # manager vs player role access
    ├── scoring.spec.ts
    ├── rotation.spec.ts
    ├── endset.spec.ts
    ├── training_rsvp.spec.ts         # player RSVP flow
    └── analysis_polling.spec.ts      # match complete → analysis ready
```

**Critical test cases:**

*Role access:*
- Player cannot POST `/api/games` → 403
- Player cannot POST `/api/sets/:id/rallies` → 403
- Player can PATCH own attendance → 200; cannot PATCH other player's → 403
- Manager can access `/settings/seasons` → 200; player cannot → 403

*Training sessions:*
- Manager creates session → all team members get pending attendance rows
- Player sets RSVP to `coming` → count updates on training card
- Player cannot update another player's RSVP → 403

*Rotation logic:*
- `addPoint({scorer:'us', currentServer:'them'})` → rotated=true, newServer='us'
- `addPoint({scorer:'us', currentServer:'us'})` → rotated=false, newServer='us'
- `addPoint({scorer:'them', currentServer:'us'})` → rotated=false, newServer='them'
- `addPoint({scorer:'them', currentServer:'them'})` → rotated=false, newServer='them'
- Undo last rally → previous lineup and score restored

*Analysis pipeline:*
- Match completed → Express calls `/analyse/{match_id}` → `status = running`
- Poll `/api/games/[id]/analysis` → returns `status = ready` with insight cards
- Insufficient data (<20 rallies) → `status = insufficient_data`
- Priority tracker: 2 consecutive improved matches → priority `status = resolved`

*TUS:*
- Returns value in [0, 1] for all input combinations
- Cold start (<6 rallies) → valid value using available window
- All-losses window → TUS approaches 1.0
- All-wins window → TUS approaches 0.0

*Error clustering:*
- n1<5 OR n0<5 → returns -1
- All-errors then all-clean → clustering_index near 1.0
- Perfectly alternating → clustering_index near 0.0

---

## 18. Environment variables

### api/.env
```env
DATABASE_URL=postgresql://vbuser:${POSTGRES_PASSWORD}@db:5432/vbmanager
JWT_SECRET=<random 32+ char string>
ANALYSIS_SERVICE_URL=http://analysis:8001
PORT=3005
```

### analysis-service/.env
```env
DATABASE_URL=postgresql://vbuser:${POSTGRES_PASSWORD}@db:5432/vbmanager
N_SIMS=10000
N_SENSITIVITY=5000
MIN_RALLIES=20
TUS_WINDOW=6
```

### web/.env
```env
VITE_API_URL=http://localhost:3005
```

---

## 19. Out of scope for this version

- **Post-match annotation / skill logging** — rally-by-rally entry (serve receive grades, attack outcomes etc.) is a separate future feature.
- **CV pipeline JSON import** — automated video analysis import.
- **Multi-team accounts** — one manager account = one team.
- **Public share links** — read-only match sharing.
- **Opponent roster tracking** — no tracking of opponent players or lineups.
- **Push notifications** — app uses in-app notification cards only; no external push.
- **Real-time WebSocket** — polling (2s for live match, 3s for analysis) is sufficient for club-level load.
