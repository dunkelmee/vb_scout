import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { gamesApi, Match } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Badge } from '../components/ui/Badge'
import { Tabs } from '../components/ui/Tabs'
import { format } from '../lib/dateUtils'
import { Plus, MapPin, Edit3, Trash2, BarChart2, Radio, Swords, Gavel } from 'lucide-react'
import { cn } from '../components/ui/cn'

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'playing', label: 'Playing' },
  { id: 'officiating', label: 'Officiating' },
]

export function GamesPage() {
  const { isManager } = useRole()
  const [filter, setFilter] = useState('all')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: ['games', filter],
    queryFn: () => gamesApi.list(filter !== 'all' ? { type: filter } : undefined),
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
            className="w-9 h-9 rounded-full bg-orange flex items-center justify-center shadow-[0_4px_16px_rgba(255,92,0,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] active:scale-95 transition-transform"
          >
            <Plus size={16} className="text-white" />
          </button>
        ) : undefined}
      />

      {/* Filter tabs */}
      <div className="px-5 pb-3">
        <Tabs tabs={FILTER_TABS} activeTab={filter} onChange={setFilter} variant="pill" />
      </div>

      {isLoading && <GamesLoadingSkeleton />}

      <div className="px-5 space-y-5 pb-6">
        {/* Upcoming / In progress */}
        {upcoming.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-orange inline-block" />
              Upcoming
            </h3>
            <div className="space-y-3">
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

        {/* Past results */}
        {past.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-surface-bright inline-block" />
              Past Results
            </h3>
            <div className="space-y-3">
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
            <div className="w-16 h-16 rounded-full bg-surface-high flex items-center justify-center">
              <CalendarDays size={28} className="text-on-surface-variant" />
            </div>
            <p className="text-on-surface-variant text-center">No games found.</p>
            {isManager && (
              <button
                onClick={() => navigate('/games/new')}
                className="text-orange font-bold text-sm border border-orange/30 rounded-full px-4 py-2"
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
  match, isManager, canLog, onDelete
}: {
  match: Match
  isManager: boolean
  canLog: boolean
  onDelete: () => void
}) {
  const isPlaying = match.matchType === 'playing'
  const isCompleted = match.status === 'completed'
  const isLive = match.status === 'in_progress'
  const won = match.setsWonUs > match.setsWonThem
  const navigate = useNavigate()

  return (
    <div className="card p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-on-surface-variant font-bold">
              {format(match.date)}
            </span>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-orange font-bold animate-pulse-slow">
                <Radio size={10} className="text-orange" /> LIVE
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-base text-on-surface truncate">
            {isPlaying
              ? match.opponent || 'TBD'
              : `${match.homeTeam || '?'} vs ${match.guestTeam || '?'}`}
          </h3>
          {match.location && (
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {match.location}
            </p>
          )}
        </div>
        {isCompleted && (
          <Badge
            label={won ? 'W' : 'L'}
            variant={won ? 'green' : 'red'}
            size="md"
          />
        )}
        {!isCompleted && !isLive && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shrink-0',
            isPlaying
              ? 'border-orange/30 text-orange/80 bg-orange/5'
              : 'border-secondary-container/30 text-secondary-container/80 bg-secondary-container/5'
          )}>
            {isPlaying ? <Swords size={11} /> : <Gavel size={11} />}
            {isPlaying ? 'Playing' : 'Offic.'}
          </div>
        )}
      </div>

      {/* Set scores for completed */}
      {isCompleted && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {match.sets?.map(set => (
            <span
              key={set.id}
              className={cn(
                'text-xs font-bold px-2 py-0.5 rounded',
                set.scoreUs > set.scoreThem
                  ? 'bg-orange/15 text-orange'
                  : 'bg-surface-highest text-on-surface-variant'
              )}
            >
              {set.scoreUs}–{set.scoreThem}
            </span>
          ))}
          <span className="text-xs text-on-surface-variant ml-1">
            ({match.setsWonUs}–{match.setsWonThem})
          </span>
        </div>
      )}

      {/* Actions */}
      {isManager && (
        <div className="flex items-center gap-2 pt-2 border-t border-outline/10">
          {canLog && (
            <button
              onClick={() => navigate(`/games/${match.id}/log`)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-orange hover:text-orange/80 transition-colors px-2 py-1.5"
            >
              <Radio size={12} /> Log
            </button>
          )}
          {/* Stats only relevant for matches we play, not ones we officiate */}
          {isPlaying && (
            <Link
              to={`/games/${match.id}/stats`}
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface-variant hover:text-on-surface transition-colors px-2 py-1.5"
            >
              <BarChart2 size={12} /> Stats
            </Link>
          )}
          <button
            onClick={() => navigate(`/games/${match.id}/edit`)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-on-surface-variant hover:text-on-surface transition-colors px-2 py-1.5"
          >
            <Edit3 size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-error/70 hover:text-error transition-colors px-2 py-1.5 ml-auto"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {!isManager && (
        <div className="pt-2 border-t border-outline/10">
          <Link
            to={`/games/${match.id}/stats`}
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-orange hover:text-orange/80 transition-colors"
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
    <div className="px-5 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card h-24" />
      ))}
    </div>
  )
}

// Need to import CalendarDays for empty state
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
