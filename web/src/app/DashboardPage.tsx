import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, DashboardData, BASE } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { Badge } from '../components/ui/Badge'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { ChevronRight, MapPin, CalendarDays, Users, Dumbbell } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { useNavigate } from 'react-router-dom'
import { chartTheme } from '../lib/chartTheme'

export function DashboardPage() {
  const { isManager } = useRole()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    refetchInterval: 30_000,
  })

  if (isLoading) return <DashboardSkeleton />

  const kpis = data?.kpis
  const winLossTrend = data?.winLossTrend || []
  const seasonPerf = data?.seasonPerf ?? null
  const weakestRotation = data?.weakestRotation ?? null

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/vb-icon.svg" alt="courtside" className="w-8 h-8" />
          <span className="font-harabara text-2xl tracking-wide text-on-surface">courtside</span>
        </div>
      </div>

      <div className="px-5 space-y-6 pb-6">
        {/* Season name + quick actions */}
        <div>
          {data?.activeSeason && (
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-turq-500 mb-3">
              {data.activeSeason.name}
            </h3>
          )}
          {isManager && (
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">Quick add</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/games/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <CalendarDays size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">Game</span>
                </button>
                <button
                  onClick={() => navigate('/players/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <Users size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">Player</span>
                </button>
                <button
                  onClick={() => navigate('/trainings/new')}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-4 card active:scale-95 transition-transform"
                >
                  <Dumbbell size={20} className="text-turq-500" />
                  <span className="text-xs font-bold text-white">Training</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Season Snapshot */}
        {kpis && <SeasonSnapshot kpis={kpis} seasonPerf={seasonPerf} />}

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
              <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant">Upcoming</h3>
              <Link to="/games" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1">
                All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {data!.upcomingGames.map(match => (
                <Link
                  key={match.id}
                  to={`/games/${match.id}/stats`}
                  className="card p-4 transition-colors"
                >
                  <p className="text-xs text-turq-500 font-bold uppercase tracking-wide mb-1">
                    {match.matchType === 'playing' ? 'Playing' : 'Officiating'}
                  </p>
                  <p className="font-display font-bold text-base text-on-surface truncate">
                    {match.matchType === 'playing'
                      ? match.opponent || 'TBD'
                      : `${match.homeTeam || '?'} vs ${match.guestTeam || '?'}`}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">{format(match.date)}</p>
                  {match.location && (
                    <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {match.location}
                    </p>
                  )}
                  {match.matchType === 'officiating' && (
                    <OfficiatingAvatars match={match} />
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming trainings */}
        {(data?.upcomingTrainings?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant">
                Trainings
              </h3>
              <Link to="/trainings" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1">
                All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {data!.upcomingTrainings.slice(0, 3).map(session => {
                const counts = session.attendanceCounts || { coming: 0, not_coming: 0, pending: 0 }
                return (
                  <Link
                    key={session.id}
                    to={`/trainings/${session.id}`}
                    className="card p-4 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm text-on-surface truncate">{session.title}</p>
                      <p className="text-xs text-on-surface-variant">
                        {format(session.date)} · {session.startTime}
                      </p>
                    </div>
                    <div className="text-xs text-on-surface-variant shrink-0">
                      {counts.coming} coming
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
              Latest Analysis
            </h3>
            <div className="card p-4 space-y-3">
              <p className="text-xs text-on-surface-variant">
                {data.recentAnalysis.matchOpponent || 'Match'} · {format(data.recentAnalysis.matchDate)}
              </p>
              {data.recentAnalysis.topStrength && (
                <div className="flex items-start gap-2">
                  <Badge label="Strength" variant="win" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topStrength.title}</p>
                </div>
              )}
              {data.recentAnalysis.topWeakness && (
                <div className="flex items-start gap-2">
                  <Badge label="Weakness" variant="loss" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topWeakness.title}</p>
                </div>
              )}
              {data.recentAnalysis.topAction && (
                <div className="flex items-start gap-2">
                  <Badge label="Action" variant="info" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topAction.title}</p>
                </div>
              )}
              <Link
                to={`/games/${data.recentAnalysis.matchId}/stats`}
                className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-1"
              >
                View full analysis <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        )}
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
  const { matchRecord, setRecord, points } = kpis
  const pointsRatio = points.them > 0 ? (points.us / points.them).toFixed(2) : '—'
  const trendLabel = matchRecord.wins >= matchRecord.losses ? 'winning' : 'losing'

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        Season Snapshot
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Matches</p>
          <p className="font-display font-black text-2xl text-on-surface">
            {matchRecord.wins}–{matchRecord.losses}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {setRecord.wins}–{setRecord.losses} sets · {trendLabel}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Points</p>
          <p className="font-display font-black text-2xl text-secondary-container">{pointsRatio}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {points.us} scored · {points.them} conceded
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Sideout %</p>
          <p className="font-display font-black text-2xl text-turq-500">
            {seasonPerf ? `${seasonPerf.sideoutPct}%` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Break %</p>
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
  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        Season Results
      </h3>
      <div className="-mx-5 px-5 overflow-x-auto">
        <div className="flex gap-2 pb-1 w-max">
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
        Season Performance
      </h3>
      <div className="card p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="font-display font-bold text-xs uppercase tracking-widest text-on-surface">
            Trends across {trend.length} {trend.length === 1 ? 'match' : 'matches'}
          </span>
          <Link to="/season-performance" className="text-xs text-turq-500 font-bold uppercase tracking-wide flex items-center gap-0.5">
            Full view <ChevronRight size={11} />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatColumn
            label="Error Ratio"
            value={seasonPerf.errorRatio.toFixed(2)}
            trend={errorTrend}
            valueColor="text-bubb-500"
          />
          <StatColumn
            label="Sideout"
            value={`${seasonPerf.sideoutPct}%`}
            trend={sideoutTrend}
            valueColor="text-turq-500"
          />
          <StatColumn
            label="Break %"
            value={`${seasonPerf.breakPct}%`}
            trend={breakTrend}
            valueColor="text-secondary-container"
          />
        </div>

        {chartData.length > 1 && (
          <div>
            <SwimlaneLine data={chartData} dataKey="sideout" color={chartTheme.turq}  label="Sideout %" valueLabel="Sideout" />
            <SwimlaneLine data={chartData} dataKey="error"   color={chartTheme.pink}  label="Error ratio" valueLabel="Error ratio" />
            <SwimlaneLine data={chartData} dataKey="break"   color={chartTheme.bell}  label="Break %" valueLabel="Break" showXAxis />
          </div>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.07]">
          <p className="text-xs text-on-surface-variant">
            Weakest rotation:{' '}
            {weakestRotation ? (
              <span className="text-bubb-500 font-bold">
                R{weakestRotation.rotation} ({weakestRotation.winPct}%)
              </span>
            ) : (
              <span className="opacity-50">not enough data</span>
            )}
          </p>
          <button className="text-xs text-on-surface-variant/60 font-medium flex items-center gap-0.5">
            View details <ChevronRight size={10} />
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
  const trendColor = trend.direction === 'flat'
    ? 'text-on-surface-variant'
    : trend.isGood ? 'text-turq-400' : 'text-bubb-500'
  const arrow = { up: '↑', down: '↓', flat: '→' }[trend.direction]

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant truncate">{label}</p>
      <p className={cn('font-display font-black text-lg leading-tight mt-0.5', valueColor)}>{value}</p>
      <p className={cn('text-[10px] font-bold mt-0.5 leading-none', trendColor)}>
        {arrow} {trend.label}
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

// ---- Officiating helpers ----

type OfficialPlayer = { id: string; firstName: string; lastName: string; avatarUrl?: string | null }

function PlayerAvatar({ player }: { player: OfficialPlayer }) {
  const initials = `${player.firstName[0]}${player.lastName[0]}`.toUpperCase()
  const palette = ['bg-turq-500/80', 'bg-bell-500/80', 'bg-bubb-400/80', 'bg-bell-400/80']
  const color = palette[(player.firstName.charCodeAt(0) + player.lastName.charCodeAt(0)) % palette.length]
  const title = `${player.firstName} ${player.lastName}`
  if (player.avatarUrl) {
    const src = player.avatarUrl.startsWith('http')
      ? player.avatarUrl
      : `${BASE}${player.avatarUrl}`
    return (
      <img
        src={src}
        alt={title}
        title={title}
        className="w-6 h-6 rounded-full object-cover ring-1 ring-surface"
      />
    )
  }
  return (
    <div title={title}
      className={`w-6 h-6 ${color} rounded-full flex items-center justify-center text-pitch-950 font-bold text-[9px] ring-1 ring-surface`}>
      {initials}
    </div>
  )
}

function OfficialGroup({ label, p1, p2 }: { label: string; p1?: OfficialPlayer | null; p2?: OfficialPlayer | null }) {
  if (!p1 && !p2) return null
  const names = [p1, p2].filter(Boolean).map(p => p!.firstName).join(' · ')
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-on-surface-variant/60 font-bold uppercase tracking-wide">{label}</span>
      <div className="flex -space-x-1.5">
        {p1 && <PlayerAvatar player={p1} />}
        {p2 && <PlayerAvatar player={p2} />}
      </div>
      <span className="text-[10px] text-on-surface-variant leading-tight">{names}</span>
    </div>
  )
}

function OfficiatingAvatars({ match }: { match: { ref1?: OfficialPlayer | null; ref2?: OfficialPlayer | null; scorer1?: OfficialPlayer | null; scorer2?: OfficialPlayer | null } }) {
  const hasRefs = !!(match.ref1 || match.ref2)
  const hasScorers = !!(match.scorer1 || match.scorer2)
  if (!hasRefs && !hasScorers) return null
  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      <OfficialGroup label="Refs" p1={match.ref1} p2={match.ref2} />
      <OfficialGroup label="Scorers" p1={match.scorer1} p2={match.scorer2} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-6 animate-pulse">
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
