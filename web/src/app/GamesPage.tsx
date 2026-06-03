import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { gamesApi, Match } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Tabs } from '../components/ui/Tabs'
import { Plus } from 'lucide-react'
import { MatchCard } from '../components/game/MatchCard'

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

      <div className="px-5 md:px-8 pb-3">
        <Tabs tabs={FILTER_TABS} activeTab={filter} onChange={setFilter} variant="pill" />
      </div>

      {isLoading && <GamesLoadingSkeleton />}

      <div className="px-5 md:px-8 space-y-5 pb-6">
        {upcoming.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-turq-500 mb-2.5 flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-sm bg-turq-500 inline-block flex-shrink-0" />
              Upcoming
            </h3>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
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
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
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

function GamesLoadingSkeleton() {
  return (
    <div className="px-5 md:px-8 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 animate-pulse">
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
