import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useOfflineStore } from '../store/offlineStore'
import { useMatchStore } from '../store/matchStore'
import { BASE } from '../lib/api'

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('vbscout-auth')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { token?: string } }
    return parsed?.state?.token ?? null
  } catch {
    return null
  }
}

export function useSyncQueue() {
  const isOnline = useOnlineStatus()
  const queue = useOfflineStore(s => s.queue)
  const isSyncing = useRef(false)

  useEffect(() => {
    if (!isOnline || isSyncing.current) return

    const pending = useOfflineStore.getState().queue
    if (pending.length === 0) return

    isSyncing.current = true

    const run = async () => {
      const sorted = [...pending].sort((a, b) => a.timestamp - b.timestamp)
      const token = getToken()
      const { dequeue } = useOfflineStore.getState()

      for (const op of sorted) {
        try {
          const res = await fetch(`${BASE}${op.url}`, {
            method: op.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: op.body ? JSON.stringify(op.body) : undefined,
          })

          // Remove from queue whether or not the server accepted it —
          // a 4xx means the operation is permanently invalid (e.g. set ended).
          if (!res.ok) {
            console.warn('[sync] server rejected queued op', op.type, res.status)
          }
          dequeue(op.id)
        } catch {
          // Network error mid-sync — stop and retry on the next online event.
          break
        }
      }

      // Reconcile UI with canonical server state after sync.
      try {
        await useMatchStore.getState().refreshFromDB()
      } catch {
        // refreshFromDB is a no-op if no match is loaded; ignore errors.
      }

      isSyncing.current = false
    }

    run().catch(() => { isSyncing.current = false })
  }, [isOnline]) // intentionally only re-runs when connectivity changes

  return { pendingCount: queue.length, isOnline }
}
