import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, seasonsApi, TeamMembership, Season } from '../lib/api'

interface TeamSeasonState {
  activeTeamId:   string | null
  activeTeamRole: 'manager' | 'player' | null
  activeSeasonId: string | null
  allTeams:       TeamMembership[]
  allSeasons:     Season[]

  loadTeams:       () => Promise<void>
  loadSeasons:     (teamId: string) => Promise<void>
  setActiveSeason: (seasonId: string) => void
  setActiveTeam:   (teamId: string) => Promise<void>
  clear:           () => void
}

export const useTeamSeasonStore = create<TeamSeasonState>()(
  persist(
    (set, get) => ({
      activeTeamId:   null,
      activeTeamRole: null,
      activeSeasonId: null,
      allTeams:       [],
      allSeasons:     [],

      loadTeams: async () => {
        try {
          const teams = await authApi.myTeams()
          const current = get()
          let activeId = current.activeTeamId

          // Validate stored activeTeamId still exists
          if (activeId && !teams.find(t => t.teamId === activeId)) activeId = null
          if (!activeId) {
            const def = teams.find(t => t.isDefault) ?? teams[0]
            activeId = def?.teamId ?? null
          }

          const activeTeam = teams.find(t => t.teamId === activeId)

          set({
            allTeams: teams,
            activeTeamId: activeId,
            activeTeamRole: (activeTeam?.role ?? null) as 'manager' | 'player' | null,
          })

          if (activeId) get().loadSeasons(activeId)
        } catch {
          // Unauthenticated or other error — ignore
        }
      },

      loadSeasons: async (teamId) => {
        try {
          const seasons = await seasonsApi.list()
          const teamSeasons = seasons.filter(s => s.teamId === teamId)
          const current = get()
          let activeSeasonId = current.activeSeasonId

          if (activeSeasonId && !teamSeasons.find(s => s.id === activeSeasonId)) activeSeasonId = null
          if (!activeSeasonId) {
            const active = teamSeasons.find(s => s.isActive) ?? teamSeasons[0]
            activeSeasonId = active?.id ?? null
          }

          set({ allSeasons: teamSeasons, activeSeasonId })
        } catch {}
      },

      setActiveSeason: (seasonId) => set({ activeSeasonId: seasonId }),

      setActiveTeam: async (teamId) => {
        try {
          const res = await authApi.switchTeam(teamId)
          // Patch the persisted auth token
          try {
            const raw = localStorage.getItem('vbscout-auth')
            if (raw) {
              const parsed = JSON.parse(raw) as { state?: { token?: string; user?: { teamId?: string; role?: string } } }
              if (parsed.state) {
                parsed.state.token = res.accessToken
                if (parsed.state.user) {
                  parsed.state.user.teamId = res.teamId
                  parsed.state.user.role   = res.role
                }
                localStorage.setItem('vbscout-auth', JSON.stringify(parsed))
              }
            }
          } catch {}

          const teams = get().allTeams
          const team  = teams.find(t => t.teamId === teamId)
          set({
            activeTeamId:   teamId,
            activeTeamRole: (res.role as 'manager' | 'player') ?? null,
            activeSeasonId: team?.activeSeason?.id ?? null,
          })

          get().loadSeasons(teamId)
        } catch (err) {
          console.error('Failed to switch team', err)
        }
      },

      clear: () => set({
        activeTeamId: null, activeTeamRole: null, activeSeasonId: null,
        allTeams: [], allSeasons: [],
      }),
    }),
    {
      name: 'vbscout-team-season',
      partialize: state => ({
        activeTeamId:   state.activeTeamId,
        activeTeamRole: state.activeTeamRole,
        activeSeasonId: state.activeSeasonId,
      }),
    }
  )
)
