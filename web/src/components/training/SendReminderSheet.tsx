import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../../lib/api'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { format } from '../../lib/dateUtils'

type Target = 'no_response' | 'no_response_and_maybe' | 'all'

interface SendReminderSheetProps {
  open: boolean
  onClose: () => void
  entityType: 'training' | 'game'
  entityId: string
  title: string
  date: string
  startTime: string
  /** Audience sizes for each targeting option. */
  counts: { noReply: number; noReplyAndMaybe: number; all: number }
  /** Query keys to invalidate after a reminder is sent (e.g. to refresh lastReminderSentAt). */
  invalidateKeys?: unknown[][]
}

/**
 * Bottom sheet for sending an RSVP reminder, shared by the trainings list cards
 * and the training detail page. Owns its own target/message state and mutation.
 */
export function SendReminderSheet({
  open, onClose, entityType, entityId, title, date, startTime, counts, invalidateKeys = [],
}: SendReminderSheetProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()

  const [target, setTarget] = useState<Target>('no_response_and_maybe')
  const [message, setMessage] = useState('')

  const reminderMutation = useMutation({
    mutationFn: () =>
      notificationsApi.sendReminder({
        entityType,
        entityId,
        message:      message || undefined,
        targetFilter: target,
      }),
    onSuccess: (data) => {
      invalidateKeys.forEach(key => qc.invalidateQueries({ queryKey: key }))
      onClose()
      setMessage('')
      showToast(t('trainingDetail.reminderSent', { count: data.sent }), 'success')
    },
    onError: () => showToast(t('trainingDetail.reminderFailed'), 'error'),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-surface rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display font-bold text-lg text-on-surface">{t('trainingDetail.sendReminder')}</h2>
        <p className="text-sm text-on-surface-variant">{title} · {format(date)} · {startTime}</p>

        <div className="space-y-2">
          {([
            { value: 'no_response_and_maybe', label: t('trainingDetail.targetNoReplyMaybe'), count: counts.noReplyAndMaybe },
            { value: 'no_response',            label: t('trainingDetail.targetNoReply'),     count: counts.noReply },
            { value: 'all',                    label: t('trainingDetail.targetAll'),         count: counts.all },
          ] as const).map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-3 rounded-xl border border-outline/20 cursor-pointer hover:bg-white/[0.03]"
            >
              <input
                type="radio"
                name="reminderTarget"
                value={opt.value}
                checked={target === opt.value}
                onChange={() => setTarget(opt.value)}
                className="accent-turq-500"
              />
              <span className="text-sm text-on-surface flex-1">{opt.label}</span>
              <span className="text-xs text-on-surface-variant">{t('trainingDetail.playersN', { count: opt.count })}</span>
            </label>
          ))}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={t('trainingDetail.customMessage')}
          className="w-full bg-surface-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-turq-500/40 resize-none"
          rows={3}
        />

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" loading={reminderMutation.isPending} onClick={() => reminderMutation.mutate()}>
            {t('trainingDetail.sendNow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
