import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  trainingsApi, rsvpApi, notificationsApi,
  TrainingSession, AttendanceEntry, Rsvp,
} from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/ui/Toast'
import { PageHeader } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { format, formatDuration } from '../lib/dateUtils'
import { ArrowLeft, MapPin, Edit3, Send, ChevronDown } from 'lucide-react'
import { cn } from '../components/ui/cn'

const STATUS_ICONS: Record<string, string> = {
  confirmed: '✅',
  declined:  '❌',
  maybe:     '🤔',
}

export function TrainingDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { isManager } = useRole()
  const statusLabel = (s?: string) =>
    s === 'confirmed' ? t('trainingDetail.confirmed')
      : s === 'declined' ? t('trainingDetail.declined')
        : s === 'maybe' ? t('trainingDetail.maybe')
          : t('trainingDetail.noReply')
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()

  const [note, setNote] = useState('')
  const [showReminderSheet, setShowReminderSheet] = useState(false)
  const [reminderTarget, setReminderTarget] = useState<'no_response' | 'no_response_and_maybe' | 'all'>('no_response')
  const [reminderMessage, setReminderMessage] = useState('')

  const { data: session } = useQuery<TrainingSession>({
    queryKey: ['training', id],
    queryFn: () => trainingsApi.get(id!),
    enabled: !!id,
  })

  const { data: attendance = [] } = useQuery<AttendanceEntry[]>({
    queryKey: ['training-attendance', id],
    queryFn: () => trainingsApi.getAttendance(id!),
    enabled: !!id && isManager,
  })

  const rsvpMutation = useMutation({
    mutationFn: (data: { status: string; note?: string }) =>
      rsvpApi.submit({ entityType: 'training', entityId: id!, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', id] })
      showToast(t('trainingDetail.responseSaved'), 'success')
    },
    onError: () => showToast(t('trainingDetail.responseFailed'), 'error'),
  })

  const reminderMutation = useMutation({
    mutationFn: () =>
      notificationsApi.sendReminder({
        entityType:   'training',
        entityId:     id!,
        message:      reminderMessage || undefined,
        targetFilter: reminderTarget,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['training', id] })
      setShowReminderSheet(false)
      showToast(t('trainingDetail.reminderSent', { count: data.sent }), 'success')
    },
    onError: () => showToast(t('trainingDetail.reminderFailed'), 'error'),
  })

  if (!session) return null

  const myRsvp = session.myRsvp

  // Manager attendance breakdown
  const confirmed = attendance.filter(a => a.rsvp?.status === 'confirmed')
  const declined  = attendance.filter(a => a.rsvp?.status === 'declined')
  const maybe     = attendance.filter(a => a.rsvp?.status === 'maybe')
  const noReply   = attendance.filter(a => !a.rsvp || a.rsvp.status === 'pending')

  const noResponseCount = noReply.length + maybe.length
  const lastReminderAt  = session.lastReminderSentAt

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base text-on-surface">{session.title}</h1>
          <p className="text-xs text-on-surface-variant">
            {format(session.date)} · {formatDuration(session.startTime, session.endTime)}
          </p>
        </div>
        {isManager && (
          <button onClick={() => navigate(`/trainings/${id}/edit`)} className="p-2 rounded-full hover:bg-white/[0.06]">
            <Edit3 size={16} className="text-on-surface-variant" />
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Details */}
        <div className="card p-4 space-y-2">
          {session.location && (
            <p className="text-sm text-on-surface flex items-center gap-2">
              <MapPin size={14} className="text-on-surface-variant" />
              {session.location}
            </p>
          )}
          {session.focusTags && session.focusTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.focusTags.map(tag => (
                <Badge key={tag} label={t(`trainings.focus${tag}`, { defaultValue: tag })} variant="orange" size="sm" />
              ))}
            </div>
          )}
          {session.notes && (
            <p className="text-sm text-on-surface-variant mt-2">{session.notes}</p>
          )}
        </div>

        {/* Player RSVP card */}
        {!isManager && user && (
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">{t('trainingDetail.areYouComing')}</p>
            <div className="flex gap-3">
              {(['confirmed', 'maybe', 'declined'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => rsvpMutation.mutate({ status: s, note })}
                  disabled={rsvpMutation.isPending}
                  className={cn(
                    'flex-1 py-4 rounded-xl border-2 font-display font-bold text-xs uppercase tracking-wide transition-all flex flex-col items-center gap-1 disabled:opacity-50',
                    myRsvp?.status === s
                      ? s === 'confirmed'
                        ? 'border-turq-500 bg-turq-500/10 text-turq-400'
                        : s === 'declined'
                          ? 'border-error bg-error-container/20 text-error'
                          : 'border-orange bg-orange/10 text-orange'
                      : 'border-outline/20 text-on-surface-variant hover:border-outline/40'
                  )}
                >
                  <span className="text-lg">{STATUS_ICONS[s]}</span>
                  <span>{s === 'confirmed' ? t('common.yes') : s === 'declined' ? t('common.no') : t('trainingDetail.maybe')}</span>
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('trainingDetail.addNote')}
              className="mt-3 w-full bg-surface-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-orange/40 resize-none"
              rows={2}
            />
            {myRsvp && (
              <p className="text-xs text-on-surface-variant mt-2">
                {t('trainingDetail.yourResponse')}: <span className="font-bold text-on-surface">{statusLabel(myRsvp.status)}</span>
              </p>
            )}
            {typeof session.confirmedCount === 'number' && (
              <p className="text-xs text-on-surface-variant mt-2">
                {t('trainingDetail.playersConfirmed', { count: session.confirmedCount })}
              </p>
            )}
          </div>
        )}

        {/* Manager attendance card */}
        {isManager && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t('trainingDetail.attendance')}</p>
                {lastReminderAt && (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {t('trainingDetail.lastReminder')}: {format(lastReminderAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowReminderSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange/10 text-orange text-xs font-bold border border-orange/20 active:scale-95 transition-transform"
              >
                <Send size={12} />
                {t('trainingDetail.sendReminder')}
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: `✅ ${t('trainingDetail.confirmed')}`, items: confirmed, color: 'text-turq-400' },
                { label: `❌ ${t('trainingDetail.declined')}`,  items: declined,  color: 'text-error/70' },
                { label: `🤔 ${t('trainingDetail.maybe')}`,     items: maybe,     color: 'text-orange/80' },
                { label: `⏳ ${t('trainingDetail.noReply')}`,  items: noReply,   color: 'text-on-surface-variant' },
              ].filter(g => g.items.length > 0).map(g => (
                <div key={g.label}>
                  <p className={cn('text-xs font-bold uppercase tracking-wide mb-1.5', g.color)}>
                    {g.label} ({g.items.length})
                  </p>
                  <div className="space-y-1.5">
                    {g.items.map(entry => (
                      <div key={entry.playerId} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange w-6 text-right">
                          #{entry.jersey ?? '–'}
                        </span>
                        <span className="text-sm text-on-surface">
                          {entry.firstName} {entry.lastName}
                        </span>
                        {entry.rsvp?.note && (
                          <span className="text-xs text-on-surface-variant italic truncate">
                            "{entry.rsvp.note}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Send reminder bottom sheet */}
      {showReminderSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowReminderSheet(false)}>
          <div className="w-full bg-surface rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg text-on-surface">{t('trainingDetail.sendReminder')}</h2>
            <p className="text-sm text-on-surface-variant">{session.title} · {format(session.date)} · {session.startTime}</p>

            <div className="space-y-2">
              {([
                { value: 'no_response_and_maybe', label: t('trainingDetail.targetNoReplyMaybe'), count: noResponseCount },
                { value: 'no_response',            label: t('trainingDetail.targetNoReply'),     count: noReply.length },
                { value: 'all',                    label: t('trainingDetail.targetAll'),         count: attendance.length },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl border border-outline/20 cursor-pointer hover:bg-white/[0.03]">
                  <input
                    type="radio"
                    name="reminderTarget"
                    value={opt.value}
                    checked={reminderTarget === opt.value}
                    onChange={() => setReminderTarget(opt.value)}
                    className="accent-orange"
                  />
                  <span className="text-sm text-on-surface flex-1">{opt.label}</span>
                  <span className="text-xs text-on-surface-variant">{t('trainingDetail.playersN', { count: opt.count })}</span>
                </label>
              ))}
            </div>

            <textarea
              value={reminderMessage}
              onChange={e => setReminderMessage(e.target.value)}
              placeholder={t('trainingDetail.customMessage')}
              className="w-full bg-surface-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-orange/40 resize-none"
              rows={3}
            />

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowReminderSheet(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" loading={reminderMutation.isPending} onClick={() => reminderMutation.mutate()}>
                {t('trainingDetail.sendNow')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
