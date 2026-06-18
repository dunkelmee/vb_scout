import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { gamesApi, Match } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useTeamSeasonStore } from '../store/teamSeasonStore'
import { PageHeader } from '../components/ui/AppShell'
import { Tabs } from '../components/ui/Tabs'
import { EmptyState } from '../components/ui/EmptyState'
import { Plus, CalendarDays, Flag, BarChart3, Sparkles, Activity, Bell } from 'lucide-react'
import { MatchCard } from '../components/game/MatchCard'

export function GamesPage() {
  const { t } = useTranslation()
  const { isManager } = useRole()
  const hasSeason = useTeamSeasonStore(s => s.allSeasons.length > 0)
  const [filter, setFilter] = useState('playing')
  const FILTER_TABS = [
    { id: 'playing', label: t('games.playing') },
    { id: 'officiating', label: t('games.officiating') },
  ]
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Reset the scroll position to the top whenever the filter tab changes
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [filter])

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
        title={t('games.title')}
        subtitle={t('games.eyebrow')}
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
              {t('games.upcoming')}
            </h3>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {upcoming.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isManager={isManager}
                  canLog={isManager && (isToday(match.date) || match.status === 'in_progress')}
                  onDelete={() => {
                    if (confirm(t('games.deleteConfirm'))) deleteMutation.mutate(match.id)
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
              {t('games.pastResults')}
            </h3>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
              {past.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isManager={isManager}
                  canLog={false}
                  onDelete={() => {
                    if (confirm(t('games.deleteConfirm'))) deleteMutation.mutate(match.id)
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {!isLoading && matches.length === 0 && (
          isManager ? (
            <EmptyState
              icon={CalendarDays}
              title={t('games.emptyTitle')}
              description={t('games.emptyDesc')}
              features={[
                { icon: Flag, title: t('games.emptyFeatLiveTitle'), desc: t('games.emptyFeatLiveDesc') },
                { icon: BarChart3, title: t('games.emptyFeatStatsTitle'), desc: t('games.emptyFeatStatsDesc') },
                { icon: Sparkles, title: t('games.emptyFeatAnalysisTitle'), desc: t('games.emptyFeatAnalysisDesc') },
              ]}
              actions={[
                { label: t('games.createFirst'), icon: Plus, onClick: () => navigate('/games/new') },
              ]}
              notice={!hasSeason && (
                <div className="flex items-start gap-2.5 mt-3.5 px-3.5 py-3 rounded-xl bg-bubb-500/[0.07] border border-bubb-500/20">
                  <CalendarDays size={16} className="text-bubb-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-snug">
                    <span className="font-bold text-bubb-400">{t('games.noSeasonTitle')}</span> {t('games.emptyNoSeason')}{' '}
                    <button onClick={() => navigate('/settings?manage=seasons')} className="text-turq-500 font-bold">
                      {t('games.noSeasonCta')}
                    </button>
                  </p>
                </div>
              )}
            />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={t('games.playerEmptyTitle')}
              description={t('games.playerEmptyDesc')}
              features={[
                { icon: CalendarDays, title: t('games.playerFeatScheduleTitle'), desc: t('games.playerFeatScheduleDesc') },
                { icon: Activity, title: t('games.playerFeatLiveTitle'), desc: t('games.playerFeatLiveDesc') },
                { icon: BarChart3, title: t('games.playerFeatStatsTitle'), desc: t('games.playerFeatStatsDesc') },
              ]}
              notice={
                <div className="flex items-start gap-2.5 mt-3.5 px-3.5 py-3 rounded-xl bg-bell-500/[0.06] border border-bell-500/20">
                  <Bell size={16} className="text-bell-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-on-surface-variant leading-snug">{t('games.playerNotifyHint')}</p>
                </div>
              }
            />
          )
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
