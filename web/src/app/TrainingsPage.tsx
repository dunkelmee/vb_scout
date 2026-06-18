import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { trainingsApi, rsvpApi, TrainingSession, AttendanceEntry } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { SendReminderSheet } from '../components/training/SendReminderSheet'
import { formatTime, dateChipParts, isUpcoming } from '../lib/dateUtils'
import { cn } from '../components/ui/cn'
import {
  Plus, MapPin, ChevronDown, ChevronUp, Trash2, Edit3, Dumbbell,
  CalendarClock, UserCheck, Tags, Users, Check, X, HelpCircle, Bell, FileText,
} from 'lucide-react'

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

// RSVP status presentation, shared by the buttons (players) and the count summary (managers).
type RsvpStatus = 'confirmed' | 'maybe' | 'declined'
const STATUS_META: Record<RsvpStatus, {
  Icon: typeof Check; labelKey: string; countKey: 'confirmed' | 'maybe' | 'declined'
  text: string; activeBtn: string
}> = {
  confirmed: {
    Icon: Check, labelKey: 'trainings.statusYes', countKey: 'confirmed', text: 'text-turq-400',
    activeBtn: 'border-turq-500 bg-turq-500/[0.14] text-turq-400',
  },
  maybe: {
    Icon: HelpCircle, labelKey: 'trainings.statusMaybe', countKey: 'maybe', text: 'text-bell-400',
    activeBtn: 'border-bell-500 bg-bell-500/[0.14] text-bell-400',
  },
  declined: {
    Icon: X, labelKey: 'trainings.statusNo', countKey: 'declined', text: 'text-bubb-400',
    activeBtn: 'border-bubb-500 bg-bubb-500/[0.16] text-bubb-400',
  },
}
const STATUS_ORDER: RsvpStatus[] = ['confirmed', 'maybe', 'declined']

type RsvpCounts = NonNullable<TrainingSession['rsvpCounts']>

// Optimistically fold a new RSVP into a session's counts + myRsvp for the list cache.
function applyOptimisticRsvp(s: TrainingSession, next: RsvpStatus): TrainingSession {
  const counts: RsvpCounts = { ...(s.rsvpCounts ?? { confirmed: 0, declined: 0, maybe: 0, pending: 0 }) }
  const prev = s.myRsvp?.status as RsvpStatus | 'pending' | undefined
  if (prev === next) return s
  const prevKey = (prev ?? 'pending') as keyof RsvpCounts
  counts[prevKey] = Math.max(0, counts[prevKey] - 1)
  counts[next] = counts[next] + 1
  return {
    ...s,
    rsvpCounts: counts,
    myRsvp: { ...(s.myRsvp ?? {}), status: next, respondedAt: new Date().toISOString() } as TrainingSession['myRsvp'],
  }
}

export function TrainingsPage() {
  const { t } = useTranslation()
  const { isManager } = useRole()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [showPast, setShowPast] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const { data: sessions = [], isLoading } = useQuery<TrainingSession[]>({
    queryKey: ['trainings'],
    queryFn: trainingsApi.list,
    refetchInterval: 30_000,
  })

  // Scroll to (and briefly highlight) a specific card when linked via #training-<id> — e.g. from the dashboard.
  useEffect(() => {
    if (!location.hash || sessions.length === 0) return
    const elId = location.hash.slice(1)
    const el = document.getElementById(elId)
    if (!el) return
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    setHighlightId(elId.replace(/^training-/, ''))
    const timer = setTimeout(() => setHighlightId(null), 2200)
    return () => clearTimeout(timer)
  }, [location.hash, sessions])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainings'] }),
  })

  const byDate = (dir: 1 | -1) => (a: TrainingSession, b: TrainingSession) =>
    dir * (new Date(a.date).getTime() - new Date(b.date).getTime())

  const upcoming = sessions.filter(s => isUpcoming(s.date)).sort(byDate(1))   // soonest first
  const past     = sessions.filter(s => !isUpcoming(s.date)).sort(byDate(-1)) // most recent first

  const handleDelete = (session: TrainingSession) => {
    if (confirm(t('trainings.deleteConfirm'))) deleteMutation.mutate(session.id)
  }

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

      {isLoading && <div className="px-5 md:px-8 space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="card h-36" />)}</div>}

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
                  highlighted={highlightId === session.id}
                  onDelete={() => handleDelete(session)}
                  onEdit={() => navigate(`/trainings/${session.id}/edit`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past sessions live behind a dimmed reveal at the end of the upcoming list */}
        {past.length > 0 && (
          <section>
            {!showPast ? (
              <button
                onClick={() => setShowPast(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:bg-white/[0.03] active:scale-[0.99] transition-all"
              >
                <ChevronDown size={14} />
                {t('trainings.showPast', { count: past.length })}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowPast(false)}
                  className="w-full flex items-center justify-center gap-2 mb-3 text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors"
                >
                  <ChevronUp size={14} />
                  {t('trainings.hidePast')}
                </button>
                <div className="space-y-3">
                  {past.map(session => (
                    <TrainingCard
                      key={session.id}
                      session={session}
                      isManager={isManager}
                      isPast
                      highlighted={highlightId === session.id}
                      onDelete={() => handleDelete(session)}
                      onEdit={() => navigate(`/trainings/${session.id}/edit`)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {!isLoading && sessions.length === 0 && (
          isManager ? (
            <EmptyState
              icon={Dumbbell}
              title={t('trainings.emptyTitle')}
              description={t('trainings.emptyDesc')}
              features={[
                { icon: CalendarClock, title: t('trainings.emptyFeatWhenTitle'), desc: t('trainings.emptyFeatWhenDesc') },
                { icon: UserCheck, title: t('trainings.emptyFeatRsvpTitle'), desc: t('trainings.emptyFeatRsvpDesc') },
                { icon: Tags, title: t('trainings.emptyFeatFocusTitle'), desc: t('trainings.emptyFeatFocusDesc') },
              ]}
              actions={[
                { label: t('trainings.scheduleFirst'), icon: Plus, onClick: () => navigate('/trainings/new') },
              ]}
            />
          ) : (
            <div className="flex flex-col items-center py-16 gap-3">
              <p className="text-on-surface-variant">{t('trainings.empty')}</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function TrainingCard({
  session, isManager, isPast, highlighted, onDelete, onEdit,
}: {
  session: TrainingSession
  isManager: boolean
  isPast?: boolean
  highlighted?: boolean
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [rosterOpen, setRosterOpen] = useState(false)

  const counts = session.rsvpCounts || { confirmed: 0, declined: 0, maybe: 0, pending: 0 }
  const myStatus = session.myRsvp?.status as RsvpStatus | 'pending' | undefined
  const chip = dateChipParts(session.date)

  const rsvpMutation = useMutation({
    mutationFn: (status: RsvpStatus) =>
      rsvpApi.submit({ entityType: 'training', entityId: session.id, status }),
    onMutate: async (status: RsvpStatus) => {
      await qc.cancelQueries({ queryKey: ['trainings'] })
      const prev = qc.getQueryData<TrainingSession[]>(['trainings'])
      qc.setQueryData<TrainingSession[]>(['trainings'], list =>
        list?.map(s => (s.id === session.id ? applyOptimisticRsvp(s, status) : s)))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['trainings'], ctx.prev)
      showToast(t('trainingDetail.responseFailed'), 'error')
    },
    onSuccess: () => showToast(t('trainingDetail.responseSaved'), 'success'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['trainings'] })
      qc.invalidateQueries({ queryKey: ['training-attendance', session.id] })
    },
  })

  // Left rail mirrors the player's own RSVP at a glance.
  const railClass =
    myStatus === 'confirmed' ? 'bg-turq-500'
      : myStatus === 'maybe' ? 'bg-bell-500'
        : myStatus === 'declined' ? 'bg-bubb-500'
          : 'bg-outline-variant'

  return (
    <div
      id={`training-${session.id}`}
      className={cn(
        'card relative overflow-hidden p-4 pl-5 scroll-mt-24 transition-shadow',
        isPast && 'opacity-60',
        highlighted && 'ring-2 ring-turq-500/60',
      )}
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-1', railClass)} />

      {/* Header — time column on the left, metadata on the right. The card is self-contained (no detail view). */}
      <div className="flex gap-3 items-start">
        {/* Time column: weekday · date · begin/end, divided from the metadata */}
        <div className="flex gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-[15px] font-extrabold text-on-surface leading-none">{chip.dow}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-turq-400 mt-1">{chip.day} {chip.mon}</div>
            <div className="mt-2.5">
              <div className="text-sm font-bold text-on-surface leading-none">{formatTime(session.startTime)}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant mt-0.5">{t('trainings.begin')}</div>
            </div>
            {session.endTime && (
              <div className="mt-1.5">
                <div className="text-sm font-bold text-on-surface leading-none">{formatTime(session.endTime)}</div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant mt-0.5">{t('trainings.end')}</div>
              </div>
            )}
          </div>
          <div className="w-px self-stretch bg-outline" />
        </div>

        {/* Metadata: title · location · focus tags · coach-only notes */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-base text-on-surface truncate">
            {session.title}
          </h3>
          {session.location && (
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <MapPin size={11} /> {session.location}
            </p>
          )}
          {session.focusTags && session.focusTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.focusTags.map(tag => (
                <Badge key={tag} label={focusLabel(t, tag)} variant={FOCUS_VARIANTS[tag] || 'neutral'} size="sm" />
              ))}
            </div>
          )}
          {/* Internal session notes — coach-only for now (until the drill builder lands). */}
          {isManager && session.notes && (
            <div className="flex gap-2 mt-2.5 px-3 py-2 rounded-lg bg-surface-high border border-outline">
              <FileText size={13} className="text-on-surface-variant shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant leading-snug whitespace-pre-line">{session.notes}</p>
            </div>
          )}
        </div>

        {isManager && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={onEdit} className="w-8 h-8 rounded-lg border border-outline bg-surface-high flex items-center justify-center text-on-surface-variant hover:bg-white/[0.06] active:scale-95 transition-all">
              <Edit3 size={14} />
            </button>
            <button onClick={onDelete} className="w-8 h-8 rounded-lg border border-outline bg-surface-high flex items-center justify-center text-bubb-400 hover:bg-white/[0.06] active:scale-95 transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* RSVP pills (players) or read-only count pills (managers) */}
      <div className="flex gap-2 mt-3">
        {STATUS_ORDER.map(status => {
          const meta = STATUS_META[status]
          if (isManager) {
            return (
              <div key={status} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-outline bg-surface-high">
                <meta.Icon size={15} className={meta.text} />
                <span className={cn('text-sm font-bold', meta.text)}>{counts[meta.countKey]}</span>
              </div>
            )
          }
          const active = myStatus === status
          return (
            <button
              key={status}
              onClick={() => { if (myStatus !== status) rsvpMutation.mutate(status) }}
              disabled={rsvpMutation.isPending}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border-[1.5px] text-[13px] font-bold transition-all active:scale-95 disabled:opacity-60',
                active ? meta.activeBtn : 'border-outline bg-surface-high text-on-surface-variant hover:border-outline-variant',
              )}
            >
              <meta.Icon size={15} />
              {t(meta.labelKey)}
              <span className="opacity-80">{counts[meta.countKey]}</span>
            </button>
          )
        })}
      </div>

      {/* View attendees — expands the grouped roster inline */}
      <button
        onClick={() => setRosterOpen(o => !o)}
        aria-expanded={rosterOpen}
        className="w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant text-xs font-bold hover:bg-white/[0.03] active:scale-[0.99] transition-all"
      >
        <Users size={15} />
        {rosterOpen ? t('trainings.hideAttendees') : t('trainings.viewAttendees')}
      </button>

      {rosterOpen && (
        <TrainingRoster session={session} isManager={isManager} onCollapse={() => setRosterOpen(false)} />
      )}
    </div>
  )
}

const ROSTER_GROUPS: { status: RsvpStatus | 'pending'; labelKey: string; text: string }[] = [
  { status: 'confirmed', labelKey: 'trainings.statusYes',   text: 'text-turq-400' },
  { status: 'maybe',     labelKey: 'trainings.statusMaybe', text: 'text-bell-400' },
  { status: 'declined',  labelKey: 'trainings.statusNo',    text: 'text-bubb-400' },
  { status: 'pending',   labelKey: 'trainings.noReply',     text: 'text-on-surface-variant' },
]

function TrainingRoster({
  session, isManager, onCollapse,
}: {
  session: TrainingSession
  isManager: boolean
  onCollapse: () => void
}) {
  const { t } = useTranslation()
  const [showReminder, setShowReminder] = useState(false)

  const { data: roster = [], isLoading } = useQuery<AttendanceEntry[]>({
    queryKey: ['training-attendance', session.id],
    queryFn: () => trainingsApi.getAttendance(session.id),
  })

  const byStatus = (s: RsvpStatus | 'pending') =>
    roster.filter(a => (a.rsvp?.status ?? 'pending') === s)

  const noReply         = byStatus('pending').length
  const maybeCount      = byStatus('maybe').length
  const total           = roster.length

  return (
    <div className="mt-3 pt-3 border-t border-outline">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
          {t('trainings.attendanceN', { count: total })}
        </p>
        {isManager && (
          <button
            onClick={() => setShowReminder(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-bell-500/[0.12] text-bell-400 text-[11px] font-bold border border-bell-500/25 active:scale-95 transition-transform"
          >
            <Bell size={12} />
            {t('trainingDetail.sendReminder')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-5 rounded bg-surface-high" />)}</div>
      ) : total === 0 ? (
        <p className="text-xs text-on-surface-variant py-2">{t('trainings.noRoster')}</p>
      ) : (
        <div className="space-y-3">
          {ROSTER_GROUPS.map(group => {
            const items = byStatus(group.status)
            if (items.length === 0) return null
            return (
              <div key={group.status}>
                <p className={cn('text-[11px] font-bold uppercase tracking-wide mb-1.5', group.text)}>
                  {t(group.labelKey)} · {items.length}
                </p>
                <div className="space-y-1.5">
                  {items.map(entry => (
                    <div key={entry.playerId} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-turq-400 w-6 text-right">#{entry.jersey ?? '–'}</span>
                      <span className="text-sm text-on-surface">{entry.firstName} {entry.lastName}</span>
                      {isManager && entry.rsvp?.note && (
                        <span className="text-xs text-on-surface-variant italic truncate ml-auto max-w-[40%]">
                          "{entry.rsvp.note}"
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onCollapse}
        className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg border border-outline text-on-surface-variant text-[11px] font-bold uppercase tracking-wide hover:bg-white/[0.03] active:scale-[0.99] transition-all"
      >
        <ChevronUp size={14} />
        {t('trainings.collapse')}
      </button>

      {isManager && (
        <SendReminderSheet
          open={showReminder}
          onClose={() => setShowReminder(false)}
          entityType="training"
          entityId={session.id}
          title={session.title}
          date={session.date}
          startTime={session.startTime}
          counts={{ noReply, noReplyAndMaybe: noReply + maybeCount, all: total }}
          invalidateKeys={[['training-attendance', session.id]]}
        />
      )}
    </div>
  )
}
