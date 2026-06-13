import React from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from './cn'

interface Props {
  pendingCount: number
  isOnline: boolean
}

export function OfflineBanner({ pendingCount, isOnline }: Props) {
  const { t } = useTranslation()
  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-semibold',
        isOnline
          ? 'bg-sky-900/80 text-sky-200'
          : 'bg-amber-900/80 text-amber-200'
      )}
    >
      {isOnline ? (
        <>
          <RefreshCw size={11} className="animate-spin shrink-0" />
          <span>
            {t('offline.syncing', { count: pendingCount })}
          </span>
        </>
      ) : (
        <>
          <WifiOff size={11} className="shrink-0" />
          <span>
            {t('offline.offline')}
            {pendingCount > 0 ? t('offline.queued', { count: pendingCount }) : ''}
          </span>
        </>
      )}
    </div>
  )
}
