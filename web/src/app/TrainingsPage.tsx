import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { trainingsApi, TrainingSession } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { PageHeader } from '../components/ui/AppShell'
import { Badge } from '../components/ui/Badge'
import { format, formatDuration, isUpcoming } from '../lib/dateUtils'
import { Plus, MapPin, ChevronRight, Trash2, Edit3 } from 'lucide-react'

import type { BadgeVariant } from '../components/ui/Badge'
import type { TFunction } from 'i18next'

const FOCUS_VARIANTS: Record<string, BadgeVariant> = {
  Serve: 'orange', Reception: 'blue', Attack: 'loss', Block: 'teal',
  Defence: 'win', Rotation: 'amber', Fitness: 'neutral', 'Set piece': 'purple',
}

// Map stored (English) focus tags to translation keys for display.
const FOCUS_LABEL_KEYS: Record<string, string> = {
  Serve: 'trainings.focusServe', Reception: 'trainings.focusReception',
  Attack: 'trainings.focusAttack', Block: 'trainings.focusBlock',
  Defence: 'trainings.focusDefence', Rotation: 'trainings.focusRotation',
  Fitness: 'trainings.focusFitness',
}

function focusLabel(t: TFunction, tag: string): string {
  const key = FOCUS_LABEL_KEYS[tag]
  return key ? t(key) : tag
}

export function TrainingsPage() {
  const { t } = useTranslation()
  const { isManager } = useRole()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: sessions = [], isLoading } = useQuery<TrainingSession[]>({
    queryKey: ['trainings'],
    queryFn: trainingsApi.list,
    refetchInterval: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings'] }),
  })

  const upcoming = sessions.filter(s => isUpcoming(s.date))
  const past = sessions.filter(s => !isUpcoming(s.date))

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title={t('trainings.title')}
        subtitle={t('trainings.eyebrow')}
        right={isManager ? (
          <button
            onClick={() => navigate('/trainings/new')}
            className="w-9 h-9 rounded-full bg-turq-500 flex items-center justify-center shadow-[0_4px_16px_rgba(35,181,211,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] active:scale-95 transition-transform"
          >
            <Plus size={16} className="text-pitch-950" />
          </button>
        ) : undefined}
      />

      {isLoading && <div className="px-5 md:px-8 space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="card h-28" />)}</div>}

      <div className="px-5 md:px-8 space-y-5 pb-6">
        {upcoming.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-turq-500 inline-block" />
              {t('trainings.upcoming')}
            </h3>
            <div className="space-y-3">
              {upcoming.map(session => (
                <TrainingCard
                  key={session.id}
                  session={session}
                  isManager={isManager}
                  userId={user?.id}
                  onDelete={() => {
                    if (confirm(t('trainings.deleteConfirm'))) deleteMutation.mutate(session.id)
                  }}
                  onEdit={() => navigate(`/trainings/${session.id}/edit`)}
                />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-surface-bright inline-block" />
              {t('trainings.pastSessions')}
            </h3>
            <div className="space-y-3">
              {past.map(session => (
                <TrainingCard
                  key={session.id}
                  session={session}
                  isManager={isManager}
                  userId={user?.id}
                  onDelete={() => {
                    if (confirm(t('trainings.deleteConfirm'))) deleteMutation.mutate(session.id)
                  }}
                  onEdit={() => navigate(`/trainings/${session.id}/edit`)}
                />
              ))}
            </div>
          </section>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-on-surface-variant">{t('trainings.empty')}</p>
            {isManager && (
              <Link
                to="/trainings/new"
                className="text-turq-500 font-bold text-sm border border-turq-500/30 rounded-full px-4 py-2"
              >
                {t('trainings.scheduleFirst')}
              </Link>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function TrainingCard({
  session, isManager, userId, onDelete, onEdit,
}: {
  session: TrainingSession
  isManager: boolean
  userId?: string
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const counts = session.rsvpCounts || { confirmed: 0, declined: 0, maybe: 0, pending: 0 }

  return (
    <div className="card p-4">
      {/* Date/time */}
      <p className="text-xs text-on-surface-variant font-bold mb-1">
        {format(session.date)} · {formatDuration(session.startTime, session.endTime)}
      </p>

      <Link to={`/trainings/${session.id}`}>
        <h3 className="font-display font-bold text-base text-on-surface hover:text-turq-500 transition-colors">
          {session.title}
        </h3>
      </Link>

      {session.location && (
        <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
          <MapPin size={10} /> {session.location}
        </p>
      )}

      {/* Focus tags */}
      {session.focusTags && session.focusTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {session.focusTags.map(tag => (
            <Badge
              key={tag}
              label={focusLabel(t, tag)}
              variant={FOCUS_VARIANTS[tag] || 'neutral'}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Attendance */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline/10">
        <p className="text-xs text-on-surface-variant">
          {counts.confirmed > 0 && <span className="text-turq-400 font-bold">{t('trainings.coming', { count: counts.confirmed })}</span>}
          {counts.confirmed > 0 && counts.declined > 0 && ' · '}
          {counts.declined > 0 && <span className="text-bubb-500/70 font-bold">{t('trainings.notComing', { count: counts.declined })}</span>}
          {(counts.confirmed > 0 || counts.declined > 0) && counts.pending > 0 && ' · '}
          {counts.pending > 0 && <span>{t('trainings.pending', { count: counts.pending })}</span>}
        </p>

        <div className="flex items-center gap-2">
          {isManager && (
            <>
              <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/[0.06] text-on-surface-variant">
                <Edit3 size={14} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded hover:bg-white/[0.06] text-bubb-500/60">
                <Trash2 size={14} />
              </button>
            </>
          )}
          <Link to={`/trainings/${session.id}`} className="p-1.5 rounded hover:bg-white/[0.06] text-on-surface-variant">
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
