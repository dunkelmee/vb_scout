import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { gamesApi, Match } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Tabs } from '../components/ui/Tabs'
import { format } from '../lib/dateUtils'
import { Plus, MapPin, Edit3, Trash2, BarChart2, Radio, Gavel } from 'lucide-react'
import { cn } from '../components/ui/cn'

const FILTER_TABS = [
  { id: 'playing', label: 'Playing' },
  { id: 'officiating', label: 'Officiating' },
]

export function GamesPage() {
  const { isManager } = useRole()
  const [filter, setFilter] = useState('playing')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: ['games', filter],
    queryFn: () => gamesApi.list({ type: filter }),
    refetchInterval: 10_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gamesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
  })

  const upcoming = matches.filter(m => m.status === 'upcoming' || m.status === 'in_progress')
  const past = matches.filter(m => m.status === 'completed')

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="Games"
        subtitle="Match Schedule"
        right={isManager ? (
          <button
            onClick={() => navigate('/games/new')}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-turq-500 to-bell-500 flex items-center justify-center shadow-[0_4px_16px_rgba(35,181,211,0.35)] active:scale-95 transition-transform"
          >
            <Plus size={16} className="text-pitch-950" />
          </button>
        ) : undefined}
      />

      <div className="px-5 pb-3">
        <Tabs tabs={FILTER_TABS} activeTab={filter} onChange={setFilter} variant="pill" />
      </div>

      {isLoading && <GamesLoadingSkeleton />}

      <div className="px-5 space-y-5 pb-6">
        {upcoming.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-turq-500 mb-2.5 flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-sm bg-turq-500 inline-block flex-shrink-0" />
              Upcoming
            </h3>
            <div className="space-y-2.5">
              {upcoming.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isManager={isManager}
                  canLog={isManager && (isToday(match.date) || match.status === 'in_progress')}
                  onDelete={() => {
                    if (confirm('Delete this game?')) deleteMutation.mutate(match.id)
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-turq-500 mb-2.5 flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-sm bg-turq-500 inline-block flex-shrink-0" />
              Past Results
            </h3>
            <div className="space-y-2.5">
              {past.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isManager={isManager}
                  canLog={false}
                  onDelete={() => {
                    if (confirm('Delete this game?')) deleteMutation.mutate(match.id)
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {!isLoading && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-pitch-600 flex items-center justify-center">
              <CalendarDays size={28} className="text-ghost-400" />
            </div>
            <p className="text-ghost-300 text-center">No games found.</p>
            {isManager && (
              <button
                onClick={() => navigate('/games/new')}
                className="text-turq-500 font-bold text-sm border border-turq-500/30 rounded-full px-4 py-2"
              >
                Create first game
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({
  match, isManager, canLog, onDelete,
}: {
  match: Match
  isManager: boolean
  canLog: boolean
  onDelete: () => void
}) {
  const isPlaying = match.matchType === 'playing'
  const isCompleted = match.status === 'completed'
  const isLive = match.status === 'in_progress'
  const isUpcoming = match.status === 'upcoming'
  const won = match.setsWonUs > match.setsWonThem
  const navigate = useNavigate()

  const teamName = match.team?.name ?? 'Us'
  const currentSet = isLive ? (match.sets?.find(s => s.status === 'in_progress') ?? null) : null

  // Border colour
  const borderClass = isLive
    ? 'border-turq-500/45'
    : isCompleted
      ? won ? 'border-turq-500/25' : 'border-bubb-500/[0.22]'
      : isPlaying
        ? 'border-pitch-400/50'
        : 'border-bell-500/20'

  // Top accent stripe
  const stripeClass = isLive
    ? 'bg-gradient-to-r from-turq-500 via-turq-400 to-transparent animate-pulse-slow'
    : isCompleted
      ? won
        ? 'bg-gradient-to-r from-turq-500 via-bell-500 to-transparent'
        : 'bg-gradient-to-r from-bubb-500 to-transparent'
      : isPlaying
        ? 'bg-gradient-to-r from-ghost-400/50 to-transparent'
        : 'bg-gradient-to-r from-bell-500 to-transparent'

  return (
    <div className={cn('bg-pitch-700 border rounded-2xl overflow-hidden', borderClass)}>
      {/* Stripe */}
      <div className={cn('h-0.5 w-full', stripeClass)} />

      {/* Body */}
      <div className="px-3.5 pt-3.5 pb-0">

        {/* Meta row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-ghost-300">
            {format(match.date)}
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-turq-500 uppercase tracking-[0.06em]">
                <span className="w-1.5 h-1.5 rounded-full bg-turq-500 animate-pulse inline-block" />
                {currentSet ? `Live · Set ${currentSet.setNumber}` : 'Live'}
              </span>
            )}
            {isCompleted && match.location && (
              <span className="text-ghost-300"> · {match.location}</span>
            )}
          </div>
          <div className="flex items-center">
            {isLive && match.location && (
              <span className="text-[10px] text-ghost-400 italic">{match.location}</span>
            )}
            {!isPlaying && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.05em] px-2 py-0.5 rounded-full bg-bell-500/10 text-bell-500 border border-bell-500/25">
                <Gavel size={9} /> Officiating
              </span>
            )}
          </div>
        </div>

        {/* Score row — playing (live or completed) */}
        {isPlaying && !isUpcoming && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex flex-col">
              <div className={cn(
                'text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]',
                isCompleted && !won && 'text-ghost-300',
              )}>
                {teamName}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">
                {isLive ? 'Home' : 'Us'}
              </div>
            </div>

            <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  'text-[38px] font-extrabold leading-none tracking-tighter tabular-nums',
                  isCompleted && won ? 'text-turq-500' : 'text-ghost-400/40',
                )}>
                  {isLive && currentSet ? currentSet.scoreUs : match.setsWonUs}
                </span>
                <span className="text-xl font-light text-ghost-400/40 mb-0.5">–</span>
                <span className={cn(
                  'text-[38px] font-extrabold leading-none tracking-tighter tabular-nums',
                  isCompleted && !won ? 'text-bubb-500' : 'text-ghost-400/40',
                )}>
                  {isLive && currentSet ? currentSet.scoreThem : match.setsWonThem}
                </span>
              </div>
              <div className="text-[10px] text-ghost-400 uppercase tracking-[0.06em] mt-0.5">
                {isLive && currentSet ? `Set ${currentSet.setNumber}` : 'Sets'}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-end text-right">
              <div className={cn(
                'text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]',
                isCompleted && won ? 'text-ghost-300' : isCompleted && !won ? 'text-bubb-400' : '',
              )}>
                {match.opponent || 'TBD'}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">
                {isLive ? 'Away' : 'Them'}
              </div>
            </div>
          </div>
        )}

        {/* Score row — playing upcoming (shows "vs") */}
        {isPlaying && isUpcoming && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex flex-col">
              <div className="text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]">
                {teamName}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">Home</div>
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="text-lg font-semibold text-ghost-400 tracking-[0.05em]">vs</div>
            </div>
            <div className="flex-1 flex flex-col items-end text-right">
              <div className="text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]">
                {match.opponent || 'TBD'}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">Away</div>
            </div>
          </div>
        )}

        {/* Set pills — completed playing */}
        {isPlaying && isCompleted && match.sets && match.sets.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2.5 justify-center">
            {match.sets.map(set => (
              <span
                key={set.id}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums',
                  set.scoreUs > set.scoreThem
                    ? 'bg-turq-500/15 text-turq-500'
                    : 'bg-bubb-500/12 text-bubb-500',
                )}
              >
                {set.scoreUs}–{set.scoreThem}
              </span>
            ))}
          </div>
        )}

        {/* Officiating teams row */}
        {!isPlaying && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <div className="text-sm font-bold text-ghost-100">{match.homeTeam || '?'}</div>
            </div>
            <div className="text-[11px] font-bold text-ghost-400 uppercase px-2 py-1 bg-pitch-600 rounded">VS</div>
            <div className="flex-1 text-right">
              <div className="text-sm font-bold text-ghost-100">{match.guestTeam || '?'}</div>
            </div>
          </div>
        )}

        {/* Location row — upcoming playing or officiating */}
        {(isUpcoming || !isPlaying) && match.location && (
          <div className="flex items-center gap-1.5 mb-2.5 text-xs text-ghost-300">
            <MapPin size={12} className="text-ghost-400" />
            {match.location}
          </div>
        )}

      </div>

      {/* Footer */}
      {isManager && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-t border-pitch-500 mt-1">
          {canLog && (
            <button
              onClick={() => navigate(`/games/${match.id}/log`)}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-turq-500"
            >
              <Radio size={12} /> Log
            </button>
          )}
          {isPlaying && isCompleted && (
            <Link
              to={`/games/${match.id}/stats`}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ghost-300"
            >
              <BarChart2 size={12} /> Stats
            </Link>
          )}
          <button
            onClick={() => navigate(`/games/${match.id}/edit`)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ghost-300"
          >
            <Edit3 size={12} /> Edit
          </button>
          <div className="flex-1" />
          <button onClick={onDelete} className="text-ghost-400 hover:text-bubb-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {!isManager && isCompleted && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-t border-pitch-500 mt-1">
          <Link
            to={`/games/${match.id}/stats`}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-turq-500"
          >
            <BarChart2 size={12} /> View stats
          </Link>
        </div>
      )}
    </div>
  )
}

function GamesLoadingSkeleton() {
  return (
    <div className="px-5 space-y-2.5 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-pitch-700" />
      ))}
    </div>
  )
}

function CalendarDays({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  )
}
