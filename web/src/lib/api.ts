// Typed fetch wrappers for the VB Scout API

export const BASE = import.meta.env.VITE_API_URL || ''

function getPersistedToken(): string | null {
  try {
    const raw = localStorage.getItem('vbscout-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { token?: string } }
    return parsed?.state?.token ?? null
  } catch {
    return null
  }
}

function clearPersistedAuth() {
  try { localStorage.removeItem('vbscout-auth') } catch {}
}

let _isRefreshing = false
let _refreshPromise: Promise<string | null> | null = null

async function tryRefresh(): Promise<string | null> {
  if (_isRefreshing) return _refreshPromise
  _isRefreshing = true
  _refreshPromise = fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(async res => {
      if (!res.ok) { clearPersistedAuth(); return null }
      const data = await res.json() as { accessToken: string }
      try {
        const raw = localStorage.getItem('vbscout-auth')
        if (raw) {
          const parsed = JSON.parse(raw) as { state?: { token?: string } }
          if (parsed.state) {
            parsed.state.token = data.accessToken
            localStorage.setItem('vbscout-auth', JSON.stringify(parsed))
          }
        }
      } catch {}
      return data.accessToken
    })
    .catch(() => { clearPersistedAuth(); return null })
    .finally(() => { _isRefreshing = false; _refreshPromise = null })
  return _refreshPromise
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  explicitToken?: string,
  _retry = true,
): Promise<T> {
  const token = explicitToken ?? getPersistedToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && _retry && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const newToken = await tryRefresh()
    if (newToken) return request<T>(method, path, body, newToken, false)
    if (typeof window !== 'undefined') window.location.href = '/auth/login'
    throw new Error('Session expired')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string, token?: string)              => request<T>('GET',    path, undefined, token),
  post:   <T>(path: string, body: unknown, token?: string) => request<T>('POST',   path, body, token),
  patch:  <T>(path: string, body: unknown, token?: string) => request<T>('PATCH',  path, body, token),
  delete: <T>(path: string, token?: string)              => request<T>('DELETE', path, undefined, token),
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login:    (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  register: (data: RegisterData) =>
    api.post<AuthResponse & { isFirstLogin: boolean }>('/api/auth/register', data),
  logout:   () => api.post('/api/auth/logout', {}),
  refresh:  () => api.post<{ accessToken: string }>('/api/auth/refresh', {}),
  me:       () => api.get<AppUser>('/api/auth/me'),
  patchMe:  (data: { onboardingDone?: boolean; firstName?: string; lastName?: string }) =>
    api.patch<AppUser>('/api/auth/me', data),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    const token = (JSON.parse(localStorage.getItem('vbscout-auth') || '{}') as { state?: { token?: string } })?.state?.token
    return fetch(`${BASE}/api/auth/me/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: form,
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error || 'Upload failed')
      return r.json() as Promise<{ avatarUrl: string }>
    })
  },
  deleteAvatar: () => api.delete<{ avatarUrl: null }>('/api/auth/me/photo'),
  myTeams:  () => api.get<TeamMembership[]>('/api/auth/me/teams'),
  switchTeam: (teamId: string) =>
    api.post<{ accessToken: string; teamId: string; role: string; playerId?: string }>('/api/auth/switch-team', { teamId }),
  joinTeam: (inviteCode: string) =>
    api.post<{ team: { id: string; name: string; initials: string | null }; role: string }>('/api/auth/teams/join', { inviteCode }),
}

// ── Invite codes ──────────────────────────────────────────────────────────────

export const invitesApi = {
  create: (data: { role: 'manager' | 'player'; teamId?: string; maxUses?: number; boundEmail?: string; playerId?: string }) =>
    api.post<InviteCreateResponse>('/api/invites', data),
  list: () => api.get<InviteCodeSummary[]>('/api/invites'),
  revoke: (id: string) => api.delete(`/api/invites/${id}`),
  resend: (id: string) => api.post<{ emailSent: boolean }>(`/api/invites/${id}/resend`, {}),
  validate: (code: string) =>
    fetch(`${BASE}/api/invites/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(async r => {
      const data = await r.json()
      return data as InviteValidateResponse
    }),
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  teams:       () => api.get<AdminTeam[]>('/api/admin/teams'),
  createTeam:  (name: string) => api.post<{ id: string; name: string }>('/api/admin/teams', { name }),
  deleteTeam:  (id: string) => api.delete(`/api/admin/teams/${id}`),
  users:       () => api.get<AdminUser[]>('/api/admin/users'),
  invites:     () => api.get<AdminInvite[]>('/api/admin/invites'),
}

// ── Players ───────────────────────────────────────────────────────────────────

export const playersApi = {
  list: () => api.get<Player[]>('/api/players'),
  get:  (id: string) => api.get<Player>(`/api/players/${id}`),
  create: (data: Partial<Player>) => api.post<Player>('/api/players', data),
  update: (id: string, data: Partial<Player>) => api.patch<Player>(`/api/players/${id}`, data),
  delete: (id: string) => api.delete(`/api/players/${id}`),
  uploadPhoto: async (id: string, file: File): Promise<Player> => {
    const token = getPersistedToken()
    const form = new FormData()
    form.append('photo', file)
    const res = await fetch(`${BASE}/api/players/${id}/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<Player>
  },
  deletePhoto: (id: string) => api.delete<Player>(`/api/players/${id}/photo`),
}

// ── Seasons ───────────────────────────────────────────────────────────────────

export const seasonsApi = {
  list:   () => api.get<Season[]>('/api/seasons'),
  active: () => api.get<Season | null>('/api/seasons/active'),
  get:    (id: string) => api.get<Season>(`/api/seasons/${id}`),
  create: (data: Partial<Season>) => api.post<Season>('/api/seasons', data),
  update: (id: string, data: Partial<Season>) => api.patch<Season>(`/api/seasons/${id}`, data),
  delete: (id: string) => api.delete(`/api/seasons/${id}`),
}

// ── Games ─────────────────────────────────────────────────────────────────────

export const gamesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<Match[]>(`/api/games${qs}`)
  },
  get:      (id: string) => api.get<Match>(`/api/games/${id}`),
  create:   (data: Partial<Match>) => api.post<Match>('/api/games', data),
  update:   (id: string, data: Partial<Match>) => api.patch<Match>(`/api/games/${id}`, data),
  delete:   (id: string) => api.delete(`/api/games/${id}`),
  stats:    (id: string, setId?: string) => {
    const qs = setId ? `?setId=${setId}` : ''
    return api.get<MatchStats>(`/api/games/${id}/stats${qs}`)
  },
  analysis: (id: string) => api.get<MatchAnalysis>(`/api/games/${id}/analysis`),
}

// ── Sets ──────────────────────────────────────────────────────────────────────

export const setsApi = {
  create: (matchId: string, data: { startingLineup: unknown; servingFirst?: string }) =>
    api.post<GameSet>(`/api/games/${matchId}/sets`, data),
  get:    (matchId: string, setId: string) => api.get<GameSet>(`/api/games/${matchId}/sets/${setId}`),
  update: (matchId: string, setId: string, data: Partial<GameSet>) =>
    api.patch<GameSet>(`/api/games/${matchId}/sets/${setId}`, data),
}

// ── Rallies ───────────────────────────────────────────────────────────────────

export const ralliesApi = {
  list:     (setId: string) => api.get<Rally[]>(`/api/sets/${setId}/rallies`),
  add:      (setId: string, data: { scorer: string; pointType: string }) =>
    api.post<Rally>(`/api/sets/${setId}/rallies`, data),
  undoLast: (setId: string) => api.delete<{ restoredRally: Rally | null }>(`/api/sets/${setId}/rallies/last`),
}

// ── Substitutions & Timeouts ──────────────────────────────────────────────────

export const subsApi = {
  list: (setId: string) => api.get<Substitution[]>(`/api/sets/${setId}/substitutions`),
  add:  (setId: string, data: { playerOutId?: string; playerInId?: string; isLiberoSwap?: boolean }) =>
    api.post<Substitution>(`/api/sets/${setId}/substitutions`, data),
}

export const timeoutsApi = {
  list: (setId: string) => api.get<Timeout[]>(`/api/sets/${setId}/timeouts`),
  add:  (setId: string, calledBy: 'us' | 'them') =>
    api.post<Timeout>(`/api/sets/${setId}/timeouts`, { calledBy }),
}

// ── Trainings ─────────────────────────────────────────────────────────────────

export const trainingsApi = {
  list:   () => api.get<TrainingSession[]>('/api/trainings'),
  get:    (id: string) => api.get<TrainingSession>(`/api/trainings/${id}`),
  create: (data: Partial<TrainingSession>) => api.post<TrainingSession>('/api/trainings', data),
  update: (id: string, data: Partial<TrainingSession>) =>
    api.patch<TrainingSession>(`/api/trainings/${id}`, data),
  delete: (id: string) => api.delete(`/api/trainings/${id}`),
  getAttendance:    (id: string) => api.get<TrainingAttendance[]>(`/api/trainings/${id}/attendance`),
  updateAttendance: (id: string, playerId: string, status: string, note?: string) =>
    api.patch(`/api/trainings/${id}/attendance/${playerId}`, { status, note }),
}

// ── Dashboard & stats ─────────────────────────────────────────────────────────

export const dashboardApi = { get: () => api.get<DashboardData>('/api/dashboard') }
export const seasonPerfApi = { get: () => api.get<SeasonPerformanceData>('/api/season-performance') }

// ── Team ──────────────────────────────────────────────────────────────────────

export const teamApi = {
  get:    () => api.get<{ id: string; name: string; initials: string | null }>('/api/team'),
  update: (data: { name?: string; initials?: string }) =>
    api.patch<{ id: string; name: string; initials: string | null }>('/api/team', data),
}

// ── Training priorities ───────────────────────────────────────────────────────

export const prioritiesApi = {
  list:   () => api.get<TrainingPriority[]>('/api/training-priorities'),
  update: (id: string, data: { note?: string; status?: string }) =>
    api.patch(`/api/training-priorities/${id}`, data),
}

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppUser {
  id: string
  email: string
  role: 'superadmin' | 'manager' | 'player'
  teamId: string | null
  playerId?: string
  firstName: string
  lastName: string
  onboardingDone: boolean
  avatarUrl?: string | null
}

export interface AuthResponse {
  user: AppUser
  accessToken: string
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  password: string
  inviteCode: string
  teamName?: string
}

export interface TeamMembership {
  teamId: string
  teamName: string
  teamInitials: string | null
  role: 'manager' | 'player'
  isDefault: boolean
  joinedAt: string
  activeSeason: { id: string; name: string } | null
}

export interface InviteCreateResponse {
  code: string
  expiresAt: string
  role: string
  teamId: string | null
  boundEmail: string | null
  emailSent: boolean
}

export interface InviteCodeSummary {
  id: string
  role: string
  teamId: string | null
  teamName: string | null
  boundEmail: string | null
  useCount: number
  maxUses: number
  expiresAt: string
  usedAt: string | null
  emailSentAt: string | null
  createdAt: string
  isExpired: boolean
  isFullyUsed: boolean
}

export interface InviteValidateResponse {
  valid: boolean
  role?: string
  teamName?: string | null
  teamId?: string | null
  invitedBy?: string
  reason?: string
}

export interface AdminTeam {
  id: string
  name: string
  initials: string | null
  createdAt: string
  memberCount: number
  playerCount: number
  matchCount: number
  activeSeason: { id: string; name: string } | null
}

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  onboardingDone: boolean
  createdAt: string
  teamMemberships: Array<{
    teamId: string
    role: string
    isDefault: boolean
    team: { name: string }
  }>
}

export interface AdminInvite {
  id: string
  code: string
  role: string
  teamId: string | null
  teamName: string | null
  boundEmail: string | null
  useCount: number
  maxUses: number
  expiresAt: string
  usedAt: string | null
  emailSentAt: string | null
  createdAt: string
  createdBy: string
  isExpired: boolean
  isFullyUsed: boolean
}

export interface Player {
  id: string
  teamId: string
  userId?: string | null
  firstName: string
  lastName: string
  birthday?: string | null
  heightM?: number | null
  jersey?: number | null
  positions: string[]
  avatarUrl?: string | null
  isLibero: boolean
  hasRefereeLicense: boolean
  createdAt: string
  updatedAt: string
}

export interface Season {
  id: string
  teamId: string
  name: string
  startDate: string
  endDate?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Match {
  id: string
  teamId: string
  seasonId?: string | null
  matchType: 'playing' | 'officiating'
  opponent?: string | null
  opponentInitials?: string | null
  homeTeam?: string | null
  guestTeam?: string | null
  date: string
  location?: string | null
  firstServe: 'us' | 'them'
  setsPlayed: number
  scoreUs: number[]
  scoreThem: number[]
  setsWonUs: number
  setsWonThem: number
  status: 'upcoming' | 'in_progress' | 'completed'
  ref1Id?: string | null
  ref2Id?: string | null
  scorer1Id?: string | null
  scorer2Id?: string | null
  ref1?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null } | null
  ref2?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null } | null
  scorer1?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null } | null
  scorer2?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null } | null
  team?: { name: string; initials?: string | null } | null
  sets?: GameSet[]
  matchPlayers?: { player: Player }[]
}

export interface GameSet {
  id: string
  matchId: string
  setNumber: number
  startingLineup: Record<string, string>
  servingFirst: 'us' | 'them'
  status: 'in_progress' | 'completed'
  scoreUs: number
  scoreThem: number
  rallies?: Rally[]
  substitutions?: Substitution[]
  timeouts?: Timeout[]
}

export interface Rally {
  id: string
  setId: string
  rallyIndex: number
  scorer: 'us' | 'them'
  pointType: string
  scoreUs: number
  scoreThem: number
  servingTeam: 'us' | 'them'
  rotationAfter: Record<string, string>
  rotated: boolean
  currentServer: 'us' | 'them'
  loggedAt: string
  isOffline?: boolean
}

export interface Substitution {
  id: string
  setId: string
  rallyIndex: number
  playerOutId?: string | null
  playerInId?: string | null
  isLiberoSwap: boolean
  atScoreUs: number
  atScoreThem: number
  playerOut?: Player | null
  playerIn?: Player | null
}

export interface Timeout {
  id: string
  setId: string
  rallyIndex: number
  calledBy: 'us' | 'them'
  atScoreUs: number
  atScoreThem: number
}

export interface TrainingSession {
  id: string
  teamId: string
  date: string
  startTime: string
  endTime?: string | null
  title: string
  notes?: string | null
  location?: string | null
  focusTags: string[]
  createdBy?: string | null
  trainingAttendance?: TrainingAttendance[]
  attendanceCounts?: { coming: number; not_coming: number; pending: number }
}

export interface TrainingAttendance {
  id: string
  trainingSessionId: string
  playerId: string
  status: 'pending' | 'coming' | 'not_coming'
  note?: string | null
  respondedAt?: string | null
  player?: Player
}

export interface MatchStats {
  matchId: string
  overall: {
    sideoutPct: number; breakPct: number; errorRatio: number
    positivePlayPct: number; totalRallies: number; pointsUs: number; pointsThem: number
  }
  pointQuality: {
    positivePlayPct: number; errorForcedLossPct: number
    breakQuality: number; sideoutQuality: number; benchmark: string
  }
  errorClustering: number
  rotationStats: Array<{
    rotation: number; wins: number; losses: number
    breakPct: number; sideoutPct: number; netPct: number; rallies: number
  }>
  perSetStats: Array<{
    setId: string; setNumber: number; scoreUs: number; scoreThem: number
    stats: { sideoutPct: number; breakPct: number; totalRallies: number }
  }>
  tusTimeline: Array<{ rallyIndex: number; scoreUs: number; scoreThem: number; scorer: string }>
  totalRallies: number
}

export interface MatchAnalysis {
  status: 'pending' | 'running' | 'ready' | 'insufficient_data' | 'error'
  matchId: string
  nRallies?: number | null
  insights?: {
    strengths: InsightCard[]; weaknesses: InsightCard[]
    action_items: InsightCard[]; simulation_summary?: SimulationSummary | null
  } | null
  errorMessage?: string | null
  updatedAt?: string | null
}

export interface InsightCard {
  id: string
  category: 'strength' | 'weakness' | 'action_item'
  priority: number
  title: string
  detail: string
  metric: string
  current_value: number
  target_value?: number | null
  direction: 'up' | 'down' | 'maintain'
  impact?: string | null
  source: string
  data: Record<string, unknown>
}

export interface SimulationSummary {
  baseline_win_pct: number
  score_distribution: Record<string, number>
  avg_sets_played: number
  top_intervention?: { label: string; win_rate_delta: number } | null
}

export interface TrainingPriority {
  id: string
  teamId: string
  sourceMatchId?: string | null
  insightType: string
  priorityClass: string
  metric: string
  baselineValue: number
  targetValue: number
  direction: string
  label: string
  note?: string | null
  status: string
}

export interface SeasonPerformanceData {
  seasonName: string | null
  matchCount: number
  record: { wins: number; losses: number }
  setsRecord: { wins: number; losses: number }
  pointsUs: number
  pointsThem: number
  matches: Array<{
    id: string
    opponent: string | null
    opponentInitials: string | null
    date: string
    result: 'W' | 'L'
    setsWon: number
    setsLost: number
    pointsUs: number
    pointsThem: number
    sideoutPct: number
    breakPct: number
    positivePlayPct: number
    errorRatio: number
    errorClustering: number | null
    rotations: Array<{ rotation: number; winPct: number | null }>
  }>
}

export interface DashboardData {
  activeSeason: Season | null
  kpis: {
    matchRecord: { wins: number; losses: number }
    setRecord: { wins: number; losses: number }
    points: { us: number; them: number }
    totalMatches: number
  }
  upcomingGames: Match[]
  upcomingTrainings: TrainingSession[]
  recentAnalysis: {
    matchId: string
    matchOpponent: string | null
    matchDate: string
    topStrength: InsightCard | null
    topWeakness: InsightCard | null
    topAction: InsightCard | null
  } | null
  winLossTrend: Array<{
    id: string
    date: string
    opponent: string | null
    opponentInitials: string | null
    setsWon: number
    setsLost: number
    result: 'W' | 'L'
    sideoutPct: number | null
    breakPct: number | null
    errorRatio: number | null
  }>
  seasonPerf: { sideoutPct: number; breakPct: number; errorRatio: number } | null
  weakestRotation: { rotation: number; winPct: number } | null
}
