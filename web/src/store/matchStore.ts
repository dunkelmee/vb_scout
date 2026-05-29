import { create } from 'zustand'
import { Lineup } from '../lib/rotation'
import { Rally, ralliesApi, setsApi, gamesApi } from '../lib/api'
import { addPoint } from '../lib/rotation'

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

  initMatch: async (matchId: string) => {
    try {
      const match = await gamesApi.get(matchId)
      // Only allow logging to a set that is still in progress.
      // Never fall back to a completed set — the API would reject any new rallies.
      const currentSet = match.sets?.find(s => s.status === 'in_progress')

      if (!currentSet) return

      const setData = await setsApi.get(matchId, currentSet.id)
      const rallies = setData.rallies || []
      const lastRally = rallies[rallies.length - 1]

      const lineup = lastRally
        ? (lastRally.rotationAfter as unknown as Lineup)
        : (currentSet.startingLineup as unknown as Lineup)

      const servingTeam = lastRally
        ? (lastRally.currentServer as 'us' | 'them')
        : (currentSet.servingFirst as 'us' | 'them')

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
        opponentInitials: match.opponentInitials || match.opponent?.slice(0, 3).toUpperCase() || 'OPP',
        teamName: match.team?.name || 'US',
        // Prefer the stored initials override; fall back to auto-deriving from name.
        teamInitials: match.team?.initials || deriveInitials(match.team?.name),
      })
    } catch (err) {
      console.error('Failed to init match:', err)
    }
  },

  tapScore: (scorer: 'us' | 'them') => {
    const state = get()
    if (state.scoringStep !== 'idle') return

    // Clear any existing timer
    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)

    // Set up auto-fallback after 4 seconds
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
      pointType = type === 'positive' ? 'us_positive' : 'them_error' // us scored via own play OR their error
    } else {
      pointType = type === 'positive' ? 'them_positive' : 'us_error' // them scored via own play OR our error
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
      console.error('Failed to commit rally:', err)
      // Rollback
      set({
        lineup: state.lineup,
        servingTeam: state.servingTeam,
        scoreUs: state.scoreUs,
        scoreThem: state.scoreThem,
        rallyCount: state.rallyCount,
        isCommitting: false,
      })
    }
  },

  undoLastRally: async () => {
    const state = get()
    if (!state.currentSetId || state.rallies.length === 0) return

    try {
      const { restoredRally } = await ralliesApi.undoLast(state.currentSetId)

      // Rebuild state from restored rally
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
