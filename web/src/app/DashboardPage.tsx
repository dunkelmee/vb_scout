import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, playersApi, DashboardData, Player } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useTeamSeasonStore } from '../store/teamSeasonStore'
import { useAuthStore } from '../store/authStore'
import { DashboardHeader } from '../components/ui/DashboardHeader'
import { Badge } from '../components/ui/Badge'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { ChevronRight, CalendarDays, Users, Dumbbell, Check, Camera, Cake, Shirt, Volleyball, Bell } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { chartTheme } from '../lib/chartTheme'
import { MatchCard } from '../components/game/MatchCard'

export function DashboardPage() {
  const { t } = useTranslation()
  const { isManager } = useRole()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const teamName = useTeamSeasonStore(s => s.allTeams.find(team => team.teamId === s.activeTeamId)?.teamName)
  const hasSeason = useTeamSeasonStore(s => s.allSeasons.length > 0)
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    refetchInterval: 30_000,
  })
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
    enabled: isManager,
  })
  const { data: myPlayer } = useQuery<Player>({
    queryKey: ['player', user?.playerId],
    queryFn: () => playersApi.get(user!.playerId!),
    enabled: !isManager && !!user?.playerId,
  })

  if (isLoading) return <DashboardSkeleton />

  const kpis = data?.kpis
  const winLossTrend = data?.winLossTrend || []
  const seasonPerf = data?.seasonPerf ?? null
  const weakestRotation = data?.weakestRotation ?? null

  // First-run setup state (manager only)
  const hasPlayers = players.length > 0
  const hasSchedule = (data?.upcomingGames?.length ?? 0) > 0
    || (data?.upcomingTrainings?.length ?? 0) > 0
    || (kpis?.totalMatches ?? 0) > 0
  const hasMatches = (kpis?.totalMatches ?? 0) > 0
  const setupComplete = hasSeason && hasPlayers && hasSchedule

  // First-run profile state (player only)
  const profile = {
    photo: !!(user?.avatarUrl || myPlayer?.avatarUrl),
    positions: (myPlayer?.positions?.length ?? 0) > 0,
    jersey: myPlayer?.jersey != null,
    bio: !!(myPlayer?.heightM && myPlayer?.birthday),
  }
  const profileComplete = profile.photo && profile.positions && profile.jersey && profile.bio
  const showProfileChecklist = !isManager && !!user?.playerId && !!myPlayer && !profileComplete

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader />

      <div className="px-5 md:px-8 space-y-6 pb-6">
        {/* Season name + quick actions */}
        <div>
          {data?.activeSeason && (
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-turq-500 mb-3">
              {data.activeSeason.name}
            </h3>
          )}
          {isManager && (
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">{t('dashboard.quickAdd')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/games/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <CalendarDays size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">{t('dashboard.quickGame')}</span>
                </button>
                <button
                  onClick={() => navigate('/players/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <Users size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">{t('dashboard.quickPlayer')}</span>
                </button>
                <button
                  onClick={() => navigate('/trainings/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <Dumbbell size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">{t('dashboard.quickTraining')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* First-run setup checklist (manager) */}
        {isManager && !setupComplete && (
          <SetupChecklist
            teamName={teamName}
            hasSeason={hasSeason}
            hasPlayers={hasPlayers}
            hasSchedule={hasSchedule}
            onNavigate={navigate}
          />
        )}

        {/* First-run profile checklist (player) */}
        {showProfileChecklist && (
          <ProfileChecklist
            player={myPlayer!}
            hasPhoto={profile.photo}
            hasPositions={profile.positions}
            hasJersey={profile.jersey}
            hasBio={profile.bio}
            onNavigate={navigate}
          />
        )}

        {/* Season Snapshot */}
        {kpis && hasMatches && <SeasonSnapshot kpis={kpis} seasonPerf={seasonPerf} />}
        {isManager && !hasMatches && <GhostSnapshot />}
        {!isManager && !hasMatches && <PlayerGhostSnapshot />}

        {/* Player expectation note — nothing scheduled yet */}
        {!isManager && !hasSchedule && (
          <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-bell-500/[0.06] border border-bell-500/20">
            <Bell size={16} className="text-bell-400 shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-snug">
              {t('dashboard.playerWaitingHint')}
            </p>
          </div>
        )}

        {/* Season Results */}
        {winLossTrend.length > 0 && <SeasonResults matches={winLossTrend} />}

        {/* Season Performance */}
        {seasonPerf && winLossTrend.length > 0 && (
          <SeasonPerformance
            trend={winLossTrend}
            seasonPerf={seasonPerf}
            weakestRotation={weakestRotation}
          />
        )}

        {/* Upcoming games */}
        {(data?.upcomingGames?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant">{t('dashboard.upcoming')}</h3>
              <Link to="/games" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1">
                {t('common.all')} <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {data!.upcomingGames.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onCardClick={match.matchType === 'playing'
                    ? () => navigate(`/games/${match.id}/stats`)
                    : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming trainings */}
        {(data?.upcomingTrainings?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant">
                {t('nav.trainings')}
              </h3>
              <Link to="/trainings" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1">
                {t('common.all')} <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {data!.upcomingTrainings.slice(0, 3).map(session => {
                const counts = session.rsvpCounts || { confirmed: 0, declined: 0, maybe: 0, pending: 0 }
                return (
                  <Link
                    key={session.id}
                    to={`/trainings#training-${session.id}`}
                    className="card p-4 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm text-on-surface truncate">{session.title}</p>
                      <p className="text-xs text-on-surface-variant">
                        {format(session.date)} · {session.startTime}
                      </p>
                    </div>
                    <div className="text-xs text-on-surface-variant shrink-0">
                      {t('trainings.coming', { count: counts.confirmed })}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent analysis — manager only */}
        {isManager && data?.recentAnalysis && (
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant mb-3">
              {t('dashboard.latestAnalysis')}
            </h3>
            <div className="card p-4 space-y-3">
              <p className="text-xs text-on-surface-variant">
                {data.recentAnalysis.matchOpponent || t('dashboard.matchFallback')} · {format(data.recentAnalysis.matchDate)}
              </p>
              {data.recentAnalysis.topStrength && (
                <div className="flex items-start gap-2">
                  <Badge label={t('dashboard.strength')} variant="win" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topStrength.title}</p>
                </div>
              )}
              {data.recentAnalysis.topWeakness && (
                <div className="flex items-start gap-2">
                  <Badge label={t('dashboard.weakness')} variant="loss" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topWeakness.title}</p>
                </div>
              )}
              {data.recentAnalysis.topAction && (
                <div className="flex items-start gap-2">
                  <Badge label={t('dashboard.action')} variant="info" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topAction.title}</p>
                </div>
              )}
              <Link
                to={`/games/${data.recentAnalysis.matchId}/stats`}
                className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1"
              >
                {t('dashboard.viewFullAnalysis')} <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Setup checklist (first-run) ----

function SetupChecklist({
  teamName,
  hasSeason,
  hasPlayers,
  hasSchedule,
  onNavigate,
}: {
  teamName?: string
  hasSeason: boolean
  hasPlayers: boolean
  hasSchedule: boolean
  onNavigate: (to: string) => void
}) {
  const { t } = useTranslation()

  const steps = [
    {
      done: true,
      title: t('dashboard.setupTeamDone'),
      sub: teamName ? t('dashboard.setupTeamSub', { team: teamName }) : t('dashboard.setupTeamSubNoName'),
      to: '/settings',
    },
    {
      done: hasSeason,
      title: t('dashboard.setupSeason'),
      sub: t('dashboard.setupSeasonSub'),
      to: '/settings?manage=seasons',
    },
    {
      done: hasPlayers,
      title: t('dashboard.setupPlayers'),
      sub: t('dashboard.setupPlayersSub'),
      to: '/players/new',
    },
    {
      done: hasSchedule,
      title: t('dashboard.setupSchedule'),
      sub: t('dashboard.setupScheduleSub'),
      to: '/games/new',
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-turq-500 mb-3 flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded-sm bg-turq-500 inline-block" />
        {t('dashboard.setupTitle')}
      </h3>
      <div className="card p-4">
        {/* Progress */}
        <div className="mb-3.5">
          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-1.5">
            <span>{t('dashboard.setupProgress', { done: doneCount, total: steps.length })}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-turq-500 to-bell-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {steps.map((step, i) => {
          const interactive = !step.done
          return (
            <button
              key={step.title}
              onClick={interactive ? () => onNavigate(step.to) : undefined}
              disabled={!interactive}
              className={cn(
                'flex items-center gap-3 w-full text-left py-3 border-b border-white/[0.06] last:border-b-0',
                interactive && 'active:opacity-70 transition-opacity',
              )}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-black shrink-0',
                step.done ? 'bg-turq-500 text-pitch-950' : 'bg-white/[0.06] border border-outline/40 text-on-surface-variant',
              )}>
                {step.done ? <Check size={13} strokeWidth={3} /> : i}
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn('block text-sm font-bold leading-tight', step.done ? 'text-on-surface-variant' : 'text-on-surface')}>
                  {step.title}
                </span>
                <span className="block text-[11px] text-on-surface-variant">{step.sub}</span>
              </span>
              {interactive && <ChevronRight size={16} className="text-on-surface-variant/60 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- Ghosted snapshot (no matches yet) ----

function GhostSnapshot() {
  const { t } = useTranslation()
  const boxes = [
    { label: t('dashboard.record'), value: '0–0' },
    { label: t('seasonOverview.kpiPoints'), value: '—' },
    { label: t('dashboard.sideoutPct'), value: '—' },
    { label: t('dashboard.breakPct'), value: '—' },
  ]
  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('dashboard.seasonSnapshot')}
      </h3>
      <div className="card p-4 relative overflow-hidden">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 opacity-40 grayscale">
          {boxes.map(b => (
            <div key={b.label} className="rounded-xl bg-surface-high/40 border border-outline/20 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{b.label}</p>
              <p className="font-display font-black text-2xl text-on-surface-variant mt-1">{b.value}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center px-7 text-center">
          <span className="text-xs text-on-surface bg-background/70 border border-outline/30 rounded-[10px] px-3 py-2.5 backdrop-blur-[2px]">
            {t('dashboard.snapshotEmptyHint')}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---- Profile checklist (player first-run) ----

function ProfileChecklist({
  player,
  hasPhoto,
  hasPositions,
  hasJersey,
  hasBio,
  onNavigate,
}: {
  player: Player
  hasPhoto: boolean
  hasPositions: boolean
  hasJersey: boolean
  hasBio: boolean
  onNavigate: (to: string) => void
}) {
  const { t } = useTranslation()

  const birthYear = player.birthday ? new Date(player.birthday).getFullYear().toString() : null
  const bioValue = [player.heightM ? `${player.heightM}m` : null, birthYear].filter(Boolean).join(' · ')

  const steps = [
    {
      done: hasPositions,
      icon: Volleyball,
      title: t('dashboard.profilePositions'),
      sub: hasPositions ? player.positions.join(' · ') : t('dashboard.profilePositionsSub'),
    },
    {
      done: hasJersey,
      icon: Shirt,
      title: t('dashboard.profileJersey'),
      sub: hasJersey ? `#${player.jersey}` : t('dashboard.profileJerseySub'),
    },
    {
      done: hasPhoto,
      icon: Camera,
      title: t('dashboard.profilePhoto'),
      sub: hasPhoto ? t('dashboard.profileAdded') : t('dashboard.profilePhotoSub'),
    },
    {
      done: hasBio,
      icon: Cake,
      title: t('dashboard.profileBio'),
      sub: hasBio ? bioValue : t('dashboard.profileBioSub'),
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-turq-500 mb-3 flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded-sm bg-turq-500 inline-block" />
        {t('dashboard.profileTitle')}
      </h3>
      <div className="card p-4">
        <div className="mb-3.5">
          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-1.5">
            <span>{t('dashboard.setupProgress', { done: doneCount, total: steps.length })}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-turq-500 to-bell-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {steps.map(step => {
          const interactive = !step.done
          const StepIcon = step.icon
          return (
            <button
              key={step.title}
              onClick={interactive ? () => onNavigate('/settings') : undefined}
              disabled={!interactive}
              className={cn(
                'flex items-center gap-3 w-full text-left py-3 border-b border-white/[0.06] last:border-b-0',
                interactive && 'active:opacity-70 transition-opacity',
              )}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                step.done ? 'bg-turq-500 text-pitch-950' : 'bg-white/[0.06] border border-outline/40 text-on-surface-variant',
              )}>
                {step.done ? <Check size={13} strokeWidth={3} /> : <StepIcon size={12} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn('block text-sm font-bold leading-tight', step.done ? 'text-on-surface-variant' : 'text-on-surface')}>
                  {step.title}
                </span>
                <span className="block text-[11px] text-on-surface-variant truncate">{step.sub}</span>
              </span>
              {interactive && <ChevronRight size={16} className="text-on-surface-variant/60 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- Ghosted personal snapshot (player, no matches yet) ----

function PlayerGhostSnapshot() {
  const { t } = useTranslation()
  const boxes = [
    { label: t('dashboard.statMatches'), value: '0' },
    { label: t('dashboard.statPoints'), value: '—' },
    { label: t('dashboard.statAces'), value: '—' },
    { label: t('dashboard.statReception'), value: '—' },
  ]
  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('dashboard.yourSeason')}
      </h3>
      <div className="card p-4 relative overflow-hidden">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 opacity-40 grayscale">
          {boxes.map(b => (
            <div key={b.label} className="rounded-xl bg-surface-high/40 border border-outline/20 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{b.label}</p>
              <p className="font-display font-black text-2xl text-on-surface-variant mt-1">{b.value}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center px-7 text-center">
          <span className="text-xs text-on-surface bg-background/70 border border-outline/30 rounded-[10px] px-3 py-2.5 backdrop-blur-[2px]">
            {t('dashboard.playerSnapshotHint')}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---- Season Snapshot ----

function SeasonSnapshot({
  kpis,
  seasonPerf,
}: {
  kpis: NonNullable<DashboardData['kpis']>
  seasonPerf: DashboardData['seasonPerf']
}) {
  const { t } = useTranslation()
  const { matchRecord, setRecord, points } = kpis
  const pointsRatio = points.them > 0 ? (points.us / points.them).toFixed(2) : '—'
  const trendLabel = matchRecord.wins >= matchRecord.losses ? t('dashboard.winning') : t('dashboard.losing')

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('dashboard.seasonSnapshot')}
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('dashboard.record')}</p>
          <p className="font-display font-black text-2xl text-on-surface">
            {matchRecord.wins}–{matchRecord.losses}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {setRecord.wins}–{setRecord.losses} {t('dashboard.setsLabel')} · {trendLabel}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('seasonOverview.kpiPoints')}</p>
          <p className="font-display font-black text-2xl text-secondary-container">{pointsRatio}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {points.us} {t('dashboard.scored')} · {points.them} {t('dashboard.conceded')}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('dashboard.sideoutPct')}</p>
          <p className="font-display font-black text-2xl text-turq-500">
            {seasonPerf ? `${seasonPerf.sideoutPct}%` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('dashboard.breakPct')}</p>
          <p className="font-display font-black text-2xl text-secondary-container">
            {seasonPerf ? `${seasonPerf.breakPct}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---- Season Results ----

function SeasonResults({ matches }: { matches: DashboardData['winLossTrend'] }) {
  const { t } = useTranslation()
  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('dashboard.seasonResults')}
      </h3>
      <div className="-mx-5 px-5 overflow-x-auto md:mx-0 md:px-0 md:overflow-visible">
        <div className="flex gap-2 pb-1 w-max md:w-auto md:flex-wrap md:pb-0">
          {matches.map(m => {
            const won = m.result === 'W'
            const initials = m.opponentInitials || getInitials(m.opponent)
            return (
              <Link
                key={m.id}
                to={`/games/${m.id}/stats`}
                className={cn(
                  'flex-none flex flex-col items-center gap-0.5 rounded-sm px-2.5 py-2 min-w-[52px] active:scale-95 transition-transform',
                  won
                    ? 'bg-turq-500/15 border border-turq-500/30'
                    : 'bg-bubb-500/15 border border-bubb-500/30',
                )}
              >
                <span className={cn(
                  'font-display font-black text-sm leading-tight',
                  won ? 'text-turq-400' : 'text-bubb-500',
                )}>
                  {m.setsWon}–{m.setsLost}
                </span>
                <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wide">
                  {initials}
                </span>
              </Link>
            )
          })}
          <div className="w-5 flex-none" />
        </div>
      </div>
    </div>
  )
}

// ---- Season Performance ----

function SeasonPerformance({
  trend,
  seasonPerf,
  weakestRotation,
}: {
  trend: DashboardData['winLossTrend']
  seasonPerf: NonNullable<DashboardData['seasonPerf']>
  weakestRotation: DashboardData['weakestRotation']
}) {
  const { t } = useTranslation()
  const withData = trend.filter(m => m.sideoutPct != null)
  const lastMatch = withData[withData.length - 1]

  const sideoutTrend = computeTrend(
    lastMatch?.sideoutPct != null ? Math.round(lastMatch.sideoutPct * 100) : null,
    seasonPerf.sideoutPct,
    true,
  )
  const breakTrend = computeTrend(
    lastMatch?.breakPct != null ? Math.round(lastMatch.breakPct * 100) : null,
    seasonPerf.breakPct,
    true,
  )
  const errorTrend = computeTrend(
    lastMatch?.errorRatio != null ? Math.round(lastMatch.errorRatio * 100) : null,
    Math.round(seasonPerf.errorRatio * 100),
    false,
  )

  const chartData = trend.map(m => ({
    label: m.opponentInitials || getInitials(m.opponent),
    sideout: m.sideoutPct != null ? Math.round(m.sideoutPct * 100) : undefined,
    break: m.breakPct != null ? Math.round(m.breakPct * 100) : undefined,
    error: m.errorRatio != null ? Math.round(m.errorRatio * 100) : undefined,
  }))

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('dashboard.seasonPerformance')}
      </h3>
      <div className="card p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="font-display font-bold text-xs uppercase tracking-widest text-on-surface">
            {t('seasonOverview.trends', { count: trend.length })}
          </span>
          <Link to="/season-performance" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-0.5">
            {t('dashboard.trendFullView')} <ChevronRight size={11} />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatColumn
            label={t('stats.errorRatio')}
            value={seasonPerf.errorRatio.toFixed(2)}
            trend={errorTrend}
            valueColor="text-bubb-500"
          />
          <StatColumn
            label={t('dashboard.sideout')}
            value={`${seasonPerf.sideoutPct}%`}
            trend={sideoutTrend}
            valueColor="text-turq-500"
          />
          <StatColumn
            label={t('dashboard.breakPct')}
            value={`${seasonPerf.breakPct}%`}
            trend={breakTrend}
            valueColor="text-secondary-container"
          />
        </div>

        {chartData.length > 1 && (
          <div>
            <SwimlaneLine data={chartData} dataKey="sideout" color={chartTheme.turq}  label={t('dashboard.sideoutPct')} valueLabel={t('dashboard.sideout')} />
            <SwimlaneLine data={chartData} dataKey="error"   color={chartTheme.pink}  label={t('stats.errorRatio')} valueLabel={t('stats.errorRatio')} />
            <SwimlaneLine data={chartData} dataKey="break"   color={chartTheme.bell}  label={t('dashboard.breakPct')} valueLabel={t('dashboard.breakPoint')} showXAxis />
          </div>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.07]">
          <p className="text-xs text-on-surface-variant">
            {weakestRotation
              ? (
                <span className="text-bubb-500 font-bold">
                  {t('dashboard.weakestRotation', { rotation: `R${weakestRotation.rotation}`, pct: weakestRotation.winPct })}
                </span>
              )
              : t('dashboard.weakestRotation', { rotation: '—', pct: '—' })}
          </p>
          <button className="text-xs text-on-surface-variant/60 font-medium flex items-center gap-0.5">
            {t('dashboard.viewDetails')} <ChevronRight size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatColumn({
  label,
  value,
  trend,
  valueColor,
}: {
  label: string
  value: string
  trend: { label: string; direction: 'up' | 'down' | 'flat'; isGood: boolean }
  valueColor: string
}) {
  const { t } = useTranslation()
  const trendColor = trend.direction === 'flat'
    ? 'text-on-surface-variant'
    : trend.isGood ? 'text-turq-400' : 'text-bubb-500'
  const arrow = { up: '↑', down: '↓', flat: '→' }[trend.direction]
  const trendLabel = trend.label === 'flat' ? t('dashboard.trendFlat')
    : trend.label === 'worsening' ? t('dashboard.trendWorsening')
      : trend.label === 'improving' ? t('dashboard.trendImproving')
        : trend.label

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant truncate">{label}</p>
      <p className={cn('font-display font-black text-lg leading-tight mt-0.5', valueColor)}>{value}</p>
      <p className={cn('text-[10px] font-bold mt-0.5 leading-none', trendColor)}>
        {arrow} {trendLabel}
      </p>
    </div>
  )
}

// ---- Swimlane chart ----

type SwimlanePoint = { label: string; [key: string]: number | string | undefined }

function SwimlaneLine({
  data,
  dataKey,
  color,
  label,
  valueLabel,
  showXAxis = false,
}: {
  data: SwimlanePoint[]
  dataKey: string
  color: string
  label: string
  valueLabel: string
  showXAxis?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[9px] font-bold uppercase tracking-widest shrink-0 w-[60px] text-right leading-tight"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={showXAxis ? 64 : 52}>
          <LineChart data={data} margin={{ top: 6, right: 18, left: 18, bottom: showXAxis ? 2 : 6 }}>
            <YAxis domain={['auto', 'auto']} hide />
            <XAxis
              dataKey="label"
              hide={!showXAxis}
              tick={{ fill: 'rgba(228,190,177,0.5)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            {data.map(d => (
              <ReferenceLine
                key={String(d.label)}
                x={String(d.label)}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="2 5"
                strokeWidth={1}
              />
            ))}
            <Tooltip
              contentStyle={{ background: '#1d2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              labelStyle={{ color: '#e0e3e5', fontSize: 11 }}
              itemStyle={{ fontSize: 10, color }}
              formatter={(value: number) => [`${value}%`, valueLabel]}
            />
            <Line
              dataKey={dataKey}
              stroke={color}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: 'rgba(255,255,255,0.3)' }}
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---- Utility functions ----

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

function computeTrend(
  lastValue: number | null,
  seasonAvg: number,
  higherIsBetter: boolean,
): { label: string; direction: 'up' | 'down' | 'flat'; isGood: boolean } {
  if (lastValue === null) return { label: '—', direction: 'flat', isGood: true }
  const diff = lastValue - seasonAvg
  if (Math.abs(diff) < 1.5) return { label: 'flat', direction: 'flat', isGood: true }
  if (diff > 0) {
    return {
      label: higherIsBetter ? `+${Math.round(diff)}pp` : 'worsening',
      direction: 'up',
      isGood: higherIsBetter,
    }
  }
  return {
    label: higherIsBetter ? `${Math.round(diff)}pp` : 'improving',
    direction: 'down',
    isGood: !higherIsBetter,
  }
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function DashboardSkeleton() {
  return (
    <div className="px-5 md:px-8 py-5 space-y-6 animate-pulse">
      <div className="h-8 bg-surface-high rounded-lg w-32" />
      <div>
        <div className="h-3 bg-surface-high rounded w-28 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 h-20" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-3 bg-surface-high rounded w-28 mb-3" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-14 w-14 rounded-xl flex-none" />
          ))}
        </div>
      </div>
      <div className="card h-52" />
    </div>
  )
}
