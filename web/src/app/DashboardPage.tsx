import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dashboardApi, DashboardData, BASE } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Badge } from '../components/ui/Badge'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Trophy, Target, Zap, Calendar, ChevronRight, MapPin, CalendarDays, Users, Dumbbell } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { useNavigate } from 'react-router-dom'

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

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/vb-icon.svg" alt="courtside" className="w-8 h-8" />
          <span className="font-harabara text-2xl tracking-wide text-on-surface">courtside</span>
        </div>
      </div>

      <div className="px-5 space-y-5 pb-6">
        {/* Season name + quick actions */}
        <div>
          {data?.activeSeason && (
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-orange mb-3">
              {data.activeSeason.name}
            </h3>
          )}
          {isManager && (
            <div className="flex justify-between gap-2">
              <button
                onClick={() => navigate('/games/new')}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 card !rounded-full text-xs font-bold text-white active:scale-95 transition-transform"
              >
                <CalendarDays size={12} className="text-orange" /> Game
              </button>
              <button
                onClick={() => navigate('/players/new')}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 card !rounded-full text-xs font-bold text-white active:scale-95 transition-transform"
              >
                <Users size={12} className="text-orange" /> Player
              </button>
              <button
                onClick={() => navigate('/trainings/new')}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 card !rounded-full text-xs font-bold text-white active:scale-95 transition-transform"
              >
                <Dumbbell size={12} className="text-orange" /> Training
              </button>
            </div>
          )}
        </div>

        {/* KPI cards */}
        {kpis && (
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              icon={<Trophy size={18} />}
              label="Win / Loss"
              value={`${kpis.matchRecord.wins}–${kpis.matchRecord.losses}`}
              sub={`${kpis.setRecord.wins}–${kpis.setRecord.losses} sets`}
              accent={kpis.matchRecord.wins >= kpis.matchRecord.losses ? 'green' : 'red'}
            />
            <KPICard
              icon={<Target size={18} />}
              label="Points"
              value={`${kpis.points.us}`}
              sub={`vs ${kpis.points.them} conceded`}
              accent="blue"
            />
            <KPICard
              icon={<Zap size={18} />}
              label="Matches"
              value={String(kpis.totalMatches)}
              sub="total this season"
              accent="orange"
            />
            <KPICard
              icon={<Calendar size={18} />}
              label="Sets Won"
              value={`${kpis.setRecord.wins}`}
              sub={`of ${kpis.setRecord.wins + kpis.setRecord.losses}`}
              accent="blue"
            />
          </div>
        )}

        {/* Win/Loss Trend Chart */}
        {winLossTrend.length > 0 && (
          <div className="card p-4">
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant mb-3">
              Win / Loss Trend
            </h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={winLossTrend} barSize={18} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="opponent"
                  tick={{ fill: '#e0e3e5', fontSize: 10 }}
                  tickFormatter={v => v?.slice(0, 3) || '–'}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1d2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#e0e3e5', fontSize: 12 }}
                  itemStyle={{ color: '#e0e3e5', fontSize: 11 }}
                />
                <Bar dataKey="setsWon" name="Sets won" fill="#ff5c00" radius={[3, 3, 0, 0]} />
                <Bar dataKey="setsLost" name="Sets lost" fill="rgba(255,255,255,0.15)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Upcoming section */}
        {(data?.upcomingGames?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm uppercase tracking-wide text-on-surface-variant">Upcoming</h3>
              <Link to="/games" className="text-xs text-orange font-bold uppercase tracking-wide flex items-center gap-1">
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
                  <p className="text-xs text-orange font-bold uppercase tracking-wide mb-1">
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
              <Link to="/trainings" className="text-xs text-orange font-bold uppercase tracking-wide flex items-center gap-1">
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
                  <Badge label="Strength" variant="green" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topStrength.title}</p>
                </div>
              )}
              {data.recentAnalysis.topWeakness && (
                <div className="flex items-start gap-2">
                  <Badge label="Weakness" variant="red" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topWeakness.title}</p>
                </div>
              )}
              {data.recentAnalysis.topAction && (
                <div className="flex items-start gap-2">
                  <Badge label="Action" variant="orange" />
                  <p className="text-sm text-on-surface">{data.recentAnalysis.topAction.title}</p>
                </div>
              )}
              <Link
                to={`/games/${data.recentAnalysis.matchId}/stats`}
                className="text-xs text-orange font-bold uppercase tracking-wide flex items-center gap-1"
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

type OfficialPlayer = { id: string; firstName: string; lastName: string; avatarUrl?: string | null }

function PlayerAvatar({ player }: { player: OfficialPlayer }) {
  const initials = `${player.firstName[0]}${player.lastName[0]}`.toUpperCase()
  const palette = ['bg-orange/80', 'bg-blue-500/80', 'bg-green-500/80', 'bg-purple-500/80']
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
      className={`w-6 h-6 ${color} rounded-full flex items-center justify-center text-white font-bold text-[9px] ring-1 ring-surface`}>
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

function KPICard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: 'green' | 'red' | 'blue' | 'orange'
}) {
  const accentColors = {
    green: 'text-green-400',
    red: 'text-error',
    blue: 'text-secondary-container',
    orange: 'text-orange',
  }
  return (
    <div className="card p-4">
      <div className={cn('mb-1', accentColors[accent])}>{icon}</div>
      <p className="text-xs text-on-surface-variant uppercase tracking-wide font-bold">{label}</p>
      <p className={cn('font-display font-black text-2xl mt-0.5', accentColors[accent])}>{value}</p>
      <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="h-8 bg-surface-high rounded-lg w-32" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 h-24" />
        ))}
      </div>
      <div className="card h-40" />
    </div>
  )
}
