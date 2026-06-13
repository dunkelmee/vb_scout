import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gamesApi, rsvpApi, notificationsApi, Rsvp, Match, AttendanceEntry } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/ui/Toast'
import { PageHeader } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { format } from '../lib/dateUtils'
import { ArrowLeft, MapPin, Edit3, Send, Activity } from 'lucide-react'
import { cn } from '../components/ui/cn'

const STATUS_ICONS: Record<string, string> = { confirmed: '✅', declined: '❌', maybe: '🤔' }

export function GameDetailPage() {
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

  const { data: match } = useQuery<Match>({
    queryKey: ['game', id],
    queryFn: () => gamesApi.get(id!),
    enabled: !!id,
  })

  const { data: myRsvp } = useQuery<Rsvp | null>({
    queryKey: ['rsvp-me', 'game', id],
    queryFn: () => rsvpApi.getMine('game', id!),
    enabled: !!id && !isManager,
  })

  const { data: allRsvps = [] } = useQuery<Rsvp[]>({
    queryKey: ['rsvp-all', 'game', id],
    queryFn: () => rsvpApi.getForEntity('game', id!),
    enabled: !!id && isManager,
  })

  const rsvpMutation = useMutation({
    mutationFn: (data: { status: string; note?: string }) =>
      rsvpApi.submit({ entityType: 'game', entityId: id!, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rsvp-me', 'game', id] })
      showToast(t('trainingDetail.responseSaved'), 'success')
    },
    onError: () => showToast(t('trainingDetail.responseFailed'), 'error'),
  })

  const reminderMutation = useMutation({
    mutationFn: () =>
      notificationsApi.sendReminder({
        entityType:   'game',
        entityId:     id!,
        message:      reminderMessage || undefined,
        targetFilter: reminderTarget,
      }),
    onSuccess: (data) => {
      setShowReminderSheet(false)
      showToast(t('trainingDetail.reminderSent', { count: data.sent }), 'success')
    },
    onError: () => showToast(t('trainingDetail.reminderFailed'), 'error'),
  })

  if (!match) return null

  const isUpcoming = match.status === 'upcoming'

  // Manager: build attendance roster from RSVPs
  const confirmed = allRsvps.filter(r => r.status === 'confirmed')
  const declined  = allRsvps.filter(r => r.status === 'declined')
  const maybe     = allRsvps.filter(r => r.status === 'maybe')
  const noResponseCount = (match.matchPlayers?.length ?? 0) - allRsvps.filter(r => r.status !== 'pending').length

  const opponentLabel = match.opponent ?? t('gameWizard.opponent')

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base text-on-surface">vs {opponentLabel}</h1>
          <p className="text-xs text-on-surface-variant">
            {format(match.date)} · {t(`matchStatus.${match.status === 'in_progress' ? 'inProgress' : match.status}`)}
          </p>
        </div>
        {isManager && (
          <div className="flex gap-1">
            <button onClick={() => navigate(`/games/${id}/edit`)} className="p-2 rounded-full hover:bg-white/[0.06]">
              <Edit3 size={16} className="text-on-surface-variant" />
            </button>
            {match.status === 'completed' && (
              <button onClick={() => navigate(`/games/${id}/stats`)} className="p-2 rounded-full hover:bg-white/[0.06]">
                <Activity size={16} className="text-on-surface-variant" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Match details */}
        <div className="card p-4 space-y-2">
          {match.location && (
            <p className="text-sm text-on-surface flex items-center gap-2">
              <MapPin size={14} className="text-on-surface-variant" />
              {match.location}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {match.homeTeam && match.guestTeam && (
              <p className="text-sm text-on-surface-variant">
                {match.homeTeam} vs {match.guestTeam}
              </p>
            )}
          </div>
          {match.status === 'completed' && (
            <p className="text-sm font-bold text-on-surface">
              {match.setsWonUs} – {match.setsWonThem}
            </p>
          )}
        </div>

        {/* Player RSVP card (upcoming matches only) */}
        {!isManager && isUpcoming && (
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">{t('trainingDetail.areYouAvailable')}</p>
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
            {allRsvps.length > 0 && (
              <p className="text-xs text-on-surface-variant mt-2">
                {t('trainingDetail.playersConfirmed', { count: allRsvps.filter(r => r.status === 'confirmed').length })}
              </p>
            )}
          </div>
        )}

        {/* Manager RSVP summary (upcoming matches only) */}
        {isManager && isUpcoming && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t('trainingDetail.attendance')}</p>
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
              ].filter(g => g.items.length > 0).map(g => (
                <div key={g.label}>
                  <p className={cn('text-xs font-bold uppercase tracking-wide mb-1', g.color)}>
                    {g.label} ({g.items.length})
                  </p>
                  <div className="space-y-1">
                    {g.items.map(r => (
                      <p key={r.id} className="text-sm text-on-surface">
                        {r.player?.firstName} {r.player?.lastName}
                        {r.note && <span className="text-xs text-on-surface-variant italic ml-2">"{r.note}"</span>}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {noResponseCount > 0 && (
                <p className="text-xs text-on-surface-variant">⏳ {t('trainingDetail.noReplyN', { count: noResponseCount })}</p>
              )}
            </div>
          </div>
        )}

        {/* Log match button for managers (upcoming) */}
        {isManager && match.status === 'upcoming' && (
          <Button fullWidth onClick={() => navigate(`/games/${id}/log`)}>
            {t('trainingDetail.startMatch')}
          </Button>
        )}

        {/* View stats button */}
        {match.status === 'completed' && (
          <Button variant="outline" fullWidth onClick={() => navigate(`/games/${id}/stats`)}>
            {t('trainingDetail.viewMatchStats')}
          </Button>
        )}
      </div>

      {/* Send reminder bottom sheet */}
      {showReminderSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowReminderSheet(false)}>
          <div className="w-full bg-surface rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg text-on-surface">{t('trainingDetail.sendReminder')}</h2>
            <p className="text-sm text-on-surface-variant">vs {opponentLabel} · {format(match.date)}</p>

            <div className="space-y-2">
              {([
                { value: 'no_response_and_maybe', label: t('trainingDetail.targetNoReplyMaybe') },
                { value: 'no_response',            label: t('trainingDetail.targetNoReply') },
                { value: 'all',                    label: t('trainingDetail.targetAll') },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl border border-outline/20 cursor-pointer">
                  <input
                    type="radio"
                    name="reminderTarget"
                    value={opt.value}
                    checked={reminderTarget === opt.value}
                    onChange={() => setReminderTarget(opt.value)}
                    className="accent-orange"
                  />
                  <span className="text-sm text-on-surface">{opt.label}</span>
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
              <Button variant="outline" className="flex-1" onClick={() => setShowReminderSheet(false)}>{t('common.cancel')}</Button>
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
