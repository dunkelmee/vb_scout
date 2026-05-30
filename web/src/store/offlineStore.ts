import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QueuedOperation {
  id: string
  timestamp: number
  matchId: string
  setId: string
  type: 'rally' | 'substitution' | 'timeout'
  method: 'POST' | 'DELETE'
  url: string
  body?: Record<string, unknown>
}

interface OfflineState {
  queue: QueuedOperation[]
  enqueue: (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => QueuedOperation
  dequeue: (id: string) => void
  removeLastRallyForSet: (setId: string) => boolean
  clearQueue: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      queue: [],

      enqueue: (op) => {
        const entry: QueuedOperation = {
          ...op,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        }
        set(s => ({ queue: [...s.queue, entry] }))
        return entry
      },

      dequeue: (id: string) => {
        set(s => ({ queue: s.queue.filter(op => op.id !== id) }))
      },

      removeLastRallyForSet: (setId: string) => {
        const { queue } = get()
        let lastIdx = -1
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].setId === setId && queue[i].type === 'rally') {
            lastIdx = i
            break
          }
        }
        if (lastIdx === -1) return false
        set(s => ({ queue: s.queue.filter((_, i) => i !== lastIdx) }))
        return true
      },

      clearQueue: () => set({ queue: [] }),
    }),
    { name: 'vbscout-offline-queue' }
  )
)
