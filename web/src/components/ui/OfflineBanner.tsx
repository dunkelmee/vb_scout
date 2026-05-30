import React from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from './cn'

interface Props {
  pendingCount: number
  isOnline: boolean
}

export function OfflineBanner({ pendingCount, isOnline }: Props) {
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
            Syncing {pendingCount} pending {pendingCount === 1 ? 'action' : 'actions'}…
          </span>
        </>
      ) : (
        <>
          <WifiOff size={11} className="shrink-0" />
          <span>
            Offline
            {pendingCount > 0
              ? ` — ${pendingCount} ${pendingCount === 1 ? 'action' : 'actions'} queued`
              : ''}
          </span>
        </>
      )}
    </div>
  )
}
