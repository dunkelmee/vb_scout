import { create } from 'zustand'
import { Lineup } from '../lib/rotation'
import { Rally, ralliesApi, setsApi, gamesApi, playersApi } from '../lib/api'
import { addPoint } from '../lib/rotation'
import { NO_RALLY, SubEvent, applySub, currentLineup, isGameLibero, liberoForcedExit, zonesOnly } from '../lib/substitutionRules'
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
  /** Substitutions and libero replacements of the current set, in order. */
  substitutions: SubEvent[]
  /** Players on the roster for this game, and which of them are liberos. */
  rosterIds: string[]
  liberoIds: string[]

  // Actions
  initMatch: (matchId: string) => Promise<void>
  tapScore: (scorer: 'us' | 'them') => void
  /** Step 2: commit the rally with an explicit pointType + (required for our own actions) subtype. */
  tapOutcome: (pointType: string, subtype?: string | null) => void
  commitRally: (scorer: 'us' | 'them', pointType: string, subtype?: string | null) => Promise<void>
  undoLastRally: () => Promise<void>
  cancelScoring: () => void
  refreshFromDB: () => Promise<void>
  /** Record a substitution that the server accepted (or that was queued offline). */
  applySubstitution: (sub: SubEvent) => void
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
  substitutions: [],
  rosterIds: [],
  liberoIds: [],

  initMatch: async (matchId: string) => {
    try {
      const match = await gamesApi.get(matchId)
      const currentSet = match.sets?.find(s => s.status === 'in_progress')

      if (!currentSet) return

      const setData = await setsApi.get(matchId, currentSet.id)
      const rallies = setData.rallies || []
      const lastRally = rallies[rallies.length - 1]
      const substitutions: SubEvent[] = (setData.substitutions || []).map(s => ({
        rallyIndex: s.rallyIndex,
        playerOutId: s.playerOutId ?? null,
        playerInId: s.playerInId ?? null,
        isLiberoSwap: s.isLiberoSwap,
      }))

      // Roster for this game with its designated liberos
      // (older games without a roster fall back to the whole team)
      const roster = match.matchPlayers?.length
        ? match.matchPlayers.map(mp => ({ id: mp.player.id, libero: isGameLibero(mp.isLibero, mp.player.positions) }))
        : (await playersApi.list()).map(p => ({ id: p.id, libero: isGameLibero(null, p.positions) }))

      const startLineup = zonesOnly(currentSet.startingLineup)
      const startServer = currentSet.servingFirst as 'us' | 'them'

      // On court = last rally's rotation + substitutions made since then
      const lineup = currentLineup(
        lastRally ? zonesOnly(lastRally.rotationAfter) : startLineup,
        lastRally ? lastRally.rallyIndex : NO_RALLY,
        substitutions,
      )

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
        substitutions,
        rosterIds: roster.map(p => p.id),
        liberoIds: roster.filter(p => p.libero).map(p => p.id),
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
    // Classification is required — no auto-commit fallback. The coach must pick a
    // point/error subtype in step 2 (or cancel).
    set({ scoringStep: 'awaiting_type', pendingScorer: scorer, autoFallbackTimer: null })
  },

  tapOutcome: (pointType: string, subtype: string | null = null) => {
    const state = get()
    if (state.scoringStep !== 'awaiting_type' || !state.pendingScorer) return
    if (state.autoFallbackTimer) clearTimeout(state.autoFallbackTimer)
    get().commitRally(state.pendingScorer, pointType, subtype)
  },

  commitRally: async (scorer: 'us' | 'them', pointType: string, subtype: string | null = null) => {
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

    // A libero who rotated into the front row leaves; the player they replaced returns.
    // The server applies the same rule when it stores the rally.
    const forcedExit = rotated ? liberoForcedExit(newLineup, state.substitutions, state.liberoIds) : null
    const lineupAfter = forcedExit ? applySub(newLineup, forcedExit.playerOutId, forcedExit.playerInId) : newLineup
    const substitutionsAfter = forcedExit
      ? [...state.substitutions, { ...forcedExit, rallyIndex: state.rallyCount, isLiberoSwap: true }]
      : state.substitutions

    set({
      lineup: lineupAfter,
      substitutions: substitutionsAfter,
      servingTeam: newServer,
      scoreUs: newScoreUs,
      scoreThem: newScoreThem,
      rallyCount: state.rallyCount + 1,
    })

    try {
      const rally = await ralliesApi.add(state.currentSetId, { scorer, pointType, pointSubtype: subtype })
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
          body: { scorer, pointType, pointSubtype: subtype },
        })
        // Build a local rally object so the timeline and undo logic stay consistent.
        const offlineRally: Rally = {
          id: crypto.randomUUID(),
          setId: state.currentSetId!,
          rallyIndex: state.rallyCount,
          scorer,
          pointType,
          pointSubtype: subtype,
          scoreUs: newScoreUs,
          scoreThem: newScoreThem,
          servingTeam: state.servingTeam,
          rotationAfter: lineupAfter as unknown as Record<string, string>,
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
          substitutions: state.substitutions,
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
      // Substitutions made after the undone rally are undone with it
      const substitutions = state.substitutions.filter(s => s.rallyIndex < lastRally.rallyIndex)

      if (newRallies.length === 0) {
        // All rallies in this set were offline — restore to the set's initial state.
        set({
          rallies: [],
          substitutions,
          scoreUs: 0,
          scoreThem: 0,
          servingTeam: state.setStartServingTeam,
          lineup: currentLineup(state.setStartLineup!, NO_RALLY, substitutions),
          rallyCount: 0,
          scoringStep: 'idle',
          pendingScorer: null,
        })
      } else {
        const prev = newRallies[newRallies.length - 1]
        set({
          rallies: newRallies,
          substitutions,
          scoreUs: prev.scoreUs,
          scoreThem: prev.scoreThem,
          servingTeam: prev.currentServer,
          lineup: currentLineup(zonesOnly(prev.rotationAfter), prev.rallyIndex, substitutions),
          rallyCount: newRallies.length,
          scoringStep: 'idle',
          pendingScorer: null,
        })
      }
      return
    }

    // Online path — the server also removes substitutions made after the undone
    // rally, so reload the canonical state.
    try {
      await ralliesApi.undoLast(state.currentSetId)
      await get().refreshFromDB()
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

  applySubstitution: (sub: SubEvent) => {
    const { lineup, substitutions } = get()
    if (!lineup) return
    set({
      lineup: applySub(lineup, sub.playerOutId, sub.playerInId),
      substitutions: [...substitutions, sub],
    })
  },
}))
