import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Season, seasonsApi } from '../lib/api'

interface SeasonState {
  activeSeason: Season | null
  allSeasons: Season[]
  setActiveSeason: (season: Season) => void
  loadSeasons: () => Promise<void>
}

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set) => ({
      activeSeason: null,
      allSeasons: [],

      setActiveSeason: (season: Season) => set({ activeSeason: season }),

      loadSeasons: async () => {
        try {
          const [seasons, active] = await Promise.all([
            seasonsApi.list(),
            seasonsApi.active(),
          ])
          set({
            allSeasons: seasons,
            activeSeason: active || seasons.find(s => s.isActive) || seasons[0] || null,
          })
        } catch {
          // Ignore errors (unauthenticated, etc.)
        }
      },
    }),
    {
      name: 'vbscout-season',
      partialize: (state) => ({ activeSeason: state.activeSeason }),
    }
  )
)
