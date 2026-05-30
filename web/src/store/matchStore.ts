import { create } from 'zustand'
import { Lineup } from '../lib/rotation'
import { Rally, ralliesApi, setsApi, gamesApi } from '../lib/api'
import { addPoint } from '../lib/rotation'
import { useOfflineStore } from './offlineStore'

function deriveInitials(name?: string | null): string {
  if (!name) return 'US'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

type ScoringStep = 'idle' | 'awaiting_type'

interface MatchState {
  matchId: string | null
  currentSetId: string | null
  currentSetNumber: number
  lineup: Lineup | null
  servingTeam: 'us' | 'them'
  scoreUs: number
  scoreThem: number
  rallyCount: number
  scoringStep: ScoringStep
  pendingScorer: 'us' | 'them' | null
  autoFallbackTimer: ReturnType<typeof setTimeout> | null
  rallies: Rally[]
  isCommitting: boolean
  opponentInitials: string
  teamName: string
  teamInitials: string
  /** Initial lineup for the current set — used to restore state when all offline rallies are undone. */
  setStartLineup: Lineup | null
  /** Who served first in this set — used alongside setStartLineup for restoration. */
  setStartServingTeam: 'us' | 'them'

  // Actions
  initMatch: (matchId: string) => Promise<void>
  tapScore: (scorer: 'us' | 'them') => void
  tapPointType: (type: 'positive' | 'error') => void
  commitRally: (scorer: 'us' | 'them', pointType: string) => Promise<void>
  undoLastRally: () => Promise<void>
  cancelScoring: () => void
  refreshFromDB: () => Promise<void>
  applySubstitution: (playerOutId: string, playerInId: string) => void
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matchId: null,
  currentSetId: null,
  currentSetNumber: 1,
  lineup: null,
  servingTeam: 'us',
  scoreUs: 0,
  scoreThem: 0,
  rallyCount: 0,
  scoringStep: 'idle',
  pendingScorer: null,
  autoFallbackTimer: null,
  rallies: [],
  isCommitting: false,
  opponentInitials: 'OPP',
  teamName: 'US',
  teamInitials: 'US',
  setStartLineup: null,
  setStartServingTeam: 'us',

  initMatch: async (matchId: string) => {
    try {
      const match = await gamesApi.get(matchId)
      const currentSet = match.sets?.find(s => s.status === 'in_progress')

      if (!currentSet) return

      const setData = await setsApi.get(matchId, currentSet.id)
      const rallies = setData.rallies || []
      const lastRally = rallies[rallies.length - 1]

      const startLineup = currentSet.startingLineup as unknown as Lineup
      const startServer = currentSet.servingFirst as 'us' | 'them'

      const lineup = lastRally
        ? (lastRally.rotationAfter as unknown as Lineup)
        : startLineup

      const servingTeam = lastRally
        ? (lastRally.currentServer as 'us' | 'them')
        : startServer

      set({
        matchId,
        currentSetId: currentSet.id,
        currentSetNumber: currentSet.setNumber,
        lineup,
        servingTeam,
        scoreUs: currentSet.scoreUs,
        scoreThem: currentSet.scoreThem,
        rallyCount: rallies.length,
        rallies: rallies as Rally[],
        scoringStep: 'idle',
        pendingScorer: null,
        setStartLineup: startLineup,
        setStartServingTeam: startServer,
        opponentInitials: match.opponentInitials || match.opponent?.slice(0, 3).toUpperCase() || 'OPP',
        teamName: match.team?.name || 'US',
        teamInitials: match.team?.initials || deriveInitials(match.team?.name),
      })
    } catch (err) {
      console.error('Failed to init match:', err)
    }
  },

  tapScore: (scorer: 'us' | 'them') => {
    const state = get()
    if (state.scoringStep !== 'idle') return

    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)

    const timer = setTimeout(() => {
      const s = get()
      if (s.scoringStep === 'awaiting_type' && s.pendingScorer === scorer) {
        get().commitRally(scorer, scorer === 'us' ? 'us_positive' : 'them_positive')
      }
    }, 4000)

    set({ scoringStep: 'awaiting_type', pendingScorer: scorer, autoFallbackTimer: timer })
  },

  tapPointType: (type: 'positive' | 'error') => {
    const state = get()
    if (state.scoringStep !== 'awaiting_type' || !state.pendingScorer) return

    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)

    const scorer = state.pendingScorer
    let pointType: string

    if (scorer === 'us') {
      pointType = type === 'positive' ? 'us_positive' : 'them_error'
    } else {
      pointType = type === 'positive' ? 'them_positive' : 'us_error'
    }

    get().commitRally(scorer, pointType)
  },

  commitRally: async (scorer: 'us' | 'them', pointType: string) => {
    const state = get()
    if (!state.currentSetId || state.isCommitting) return

    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)
    set({ scoringStep: 'idle', pendingScorer: null, autoFallbackTimer: null, isCommitting: true })

    // Optimistic update
    const { newLineup, rotated, newServer } = addPoint({
      scorer,
      currentServer: state.servingTeam,
      currentLineup: state.lineup!,
    })
    const newScoreUs = state.scoreUs + (scorer === 'us' ? 1 : 0)
    const newScoreThem = state.scoreThem + (scorer === 'them' ? 1 : 0)

    set({
      lineup: newLineup,
      servingTeam: newServer,
      scoreUs: newScoreUs,
      scoreThem: newScoreThem,
      rallyCount: state.rallyCount + 1,
    })

    try {
      const rally = await ralliesApi.add(state.currentSetId, { scorer, pointType })
      set((s) => ({ rallies: [...s.rallies, rally], isCommitting: false }))
    } catch (err) {
      if (!navigator.onLine) {
        // Offline: keep the optimistic update and queue the operation for later sync.
        useOfflineStore.getState().enqueue({
          type: 'rally',
          matchId: state.matchId!,
          setId: state.currentSetId!,
          method: 'POST',
          url: `/api/sets/${state.currentSetId}/rallies`,
          body: { scorer, pointType },
        })
        // Build a local rally object so the timeline and undo logic stay consistent.
        const offlineRally: Rally = {
          id: crypto.randomUUID(),
          setId: state.currentSetId!,
          rallyIndex: state.rallyCount,
          scorer,
          pointType,
          scoreUs: newScoreUs,
          scoreThem: newScoreThem,
          servingTeam: state.servingTeam,
          rotationAfter: newLineup as unknown as Record<string, string>,
          rotated,
          currentServer: newServer,
          loggedAt: new Date().toISOString(),
          isOffline: true,
        }
        set((s) => ({ rallies: [...s.rallies, offlineRally], isCommitting: false }))
      } else {
        // Online but request failed — roll back the optimistic update.
        console.error('Failed to commit rally:', err)
        set({
          lineup: state.lineup,
          servingTeam: state.servingTeam,
          scoreUs: state.scoreUs,
          scoreThem: state.scoreThem,
          rallyCount: state.rallyCount,
          isCommitting: false,
        })
      }
    }
  },

  undoLastRally: async () => {
    const state = get()
    if (!state.currentSetId || state.rallies.length === 0) return

    const lastRally = state.rallies[state.rallies.length - 1]

    // Offline path: only undo rallies that were themselves added offline.
    if (!navigator.onLine) {
      if (!lastRally.isOffline) return // can't undo a synced rally while offline

      const removed = useOfflineStore.getState().removeLastRallyForSet(state.currentSetId)
      if (!removed) return

      const newRallies = state.rallies.slice(0, -1)

      if (newRallies.length === 0) {
        // All rallies in this set were offline — restore to the set's initial state.
        set({
          rallies: [],
          scoreUs: 0,
          scoreThem: 0,
          servingTeam: state.setStartServingTeam,
          lineup: state.setStartLineup,
          rallyCount: 0,
          scoringStep: 'idle',
          pendingScorer: null,
        })
      } else {
        const prev = newRallies[newRallies.length - 1]
        set({
          rallies: newRallies,
          scoreUs: prev.scoreUs,
          scoreThem: prev.scoreThem,
          servingTeam: prev.currentServer,
          lineup: prev.rotationAfter as unknown as Lineup,
          rallyCount: newRallies.length,
          scoringStep: 'idle',
          pendingScorer: null,
        })
      }
      return
    }

    // Online path
    try {
      const { restoredRally } = await ralliesApi.undoLast(state.currentSetId)

      const newRallies = state.rallies.slice(0, -1)
      const prev = restoredRally

      if (prev) {
        set({
          rallies: newRallies,
          scoreUs: prev.scoreUs,
          scoreThem: prev.scoreThem,
          servingTeam: prev.currentServer,
          lineup: prev.rotationAfter as unknown as Lineup,
          rallyCount: newRallies.length,
          scoringStep: 'idle',
          pendingScorer: null,
        })
      } else {
        // Back to initial state of set
        await get().refreshFromDB()
      }
    } catch (err) {
      console.error('Failed to undo rally:', err)
    }
  },

  cancelScoring: () => {
    const state = get()
    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)
    set({ scoringStep: 'idle', pendingScorer: null, autoFallbackTimer: null })
  },

  refreshFromDB: async () => {
    const state = get()
    if (!state.matchId) return
    await get().initMatch(state.matchId)
  },

  applySubstitution: (playerOutId: string, playerInId: string) => {
    const { lineup } = get()
    if (!lineup) return
    const updated: Record<string, string> = {}
    for (const [zone, id] of Object.entries(lineup)) {
      updated[zone] = id === playerOutId ? playerInId : id
    }
    set({ lineup: updated as Lineup })
  },
}))
