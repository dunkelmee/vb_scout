import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, X } from 'lucide-react'
import { notificationsApi, AppNotification } from '../../lib/api'
import { formatRelative } from '../../lib/format'
import { cn } from './cn'

export function NotificationsBell() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })

  const items  = data?.items ?? []
  const unread = data?.unreadCount ?? 0

  const openPanel = async () => {
    setOpen(true)
    if (unread > 0) {
      try {
        await notificationsApi.markRead()
        qc.invalidateQueries({ queryKey: ['notifications'] })
      } catch {
        /* ignore — badge will refresh on next poll */
      }
    }
  }

  const go = (n: AppNotification) => {
    setOpen(false)
    if (n.entityType === 'training' && n.entityId) navigate(`/trainings/${n.entityId}`)
    else if (n.entityType === 'game' && n.entityId) navigate(`/games/${n.entityId}`)
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={openPanel}
        aria-label={t('notifications.title')}
        className="w-9 h-9 rounded-full flex items-center justify-center text-[#8A8A9A] hover:text-white transition-colors relative"
        style={{ background: 'rgba(247,247,255,0.06)', border: '1px solid rgba(247,247,255,0.08)' }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-bubb-500 text-white text-[9px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="absolute right-0 mt-2 w-[320px] max-w-[86vw] z-50 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(16,14,12,0.98)',
              border: '1px solid rgba(247,247,255,0.10)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-bold text-white">{t('notifications.title')}</p>
              <button onClick={() => setOpen(false)} className="p-1 rounded-full text-[#8A8A9A] hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-on-surface-variant">{t('notifications.empty')}</p>
              ) : (
                items.map(n => {
                  const clickable = !!n.entityType && !!n.entityId
                  return (
                    <button
                      key={n.id}
                      onClick={() => clickable && go(n)}
                      disabled={!clickable}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors',
                        clickable && 'hover:bg-white/[0.04]',
                        !n.readAt && 'bg-turq-500/[0.06]',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.readAt
                          ? <span className="mt-1.5 w-2 h-2 rounded-full bg-turq-500 shrink-0" />
                          : <span className="mt-1.5 w-2 h-2 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface leading-snug">{n.title}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{n.body}</p>
                          <p className="text-[10px] text-on-surface-variant/50 mt-1">{formatRelative(n.sentAt)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
