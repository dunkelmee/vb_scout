import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMatchStore } from '../store/matchStore'
import { useOfflineStore } from '../store/offlineStore'
import { gamesApi, setsApi, subsApi, timeoutsApi, playersApi, Player, GameSet, Substitution } from '../lib/api'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/Modal'
import { OfflineBanner } from '../components/ui/OfflineBanner'
import { CourtView } from '../components/court/CourtView'
import { LiveStatsTab } from '../components/stats/LiveStatsTab'
import { TimelineTab } from '../components/timeline/TimelineTab'
import { RotationToast } from '../components/court/RotationToast'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Select } from '../components/ui/Select'
import { ArrowLeft, RotateCcw, Clock, Flag, RefreshCw, ChevronDown } from 'lucide-react'
import { cn } from '../components/ui/cn'
import { Lineup, Zone } from '../lib/rotation'
import { CourtLineupSetup } from '../components/court/CourtLineupSetup'
import { TacticsTab } from '../components/court/TacticsTab'
import { SetSummaryOverlay } from '../components/SetSummaryOverlay'
import { useSyncQueue } from '../hooks/useSyncQueue'

const LOG_TABS = [
  { id: 'log', label: 'Log' },
  { id: 'stats', label: 'Stats' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tactics', label: 'Tactics' },
]

/** Returns true when the set has a valid winner by volleyball rules */
function isSetComplete(scoreUs: number, scoreThem: number, setNumber: number): boolean {
  const target = setNumber === 5 ? 15 : 25
  if (scoreUs >= target && scoreUs - scoreThem >= 2) return true
  if (scoreThem >= target && scoreThem - scoreUs >= 2) return true
  return false
}

export function GameLogPage() {
  const { id: matchId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('log')
  const [showSubModal, setShowSubModal] = useState(false)
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)
  const [showEndSetModal, setShowEndSetModal] = useState(false)
  const [showSetSummary, setShowSetSummary] = useState(false)
  const [showRotationToast, setShowRotationToast] = useState(false)

  // New-set lineup setup (shown after ending a non-final set)
  const [showNewSetSetup, setShowNewSetSetup] = useState(false)
  const [newSetLineup, setNewSetLineup] = useState<Partial<Lineup>>({})
  const [newSetPositions, setNewSetPositions] = useState<Record<Zone, string[]>>({} as Record<Zone, string[]>)
  const [newSetServingFirst, setNewSetServingFirst] = useState<'us' | 'them'>('us')
  // Timeout flow: 'pick' → choose who called it; 'timing' → 60 s countdown
  const [timeoutStep, setTimeoutStep] = useState<'pick' | 'timing'>('pick')
  const [timeoutSeconds, setTimeoutSeconds] = useState(60)
  const [timeoutCaller, setTimeoutCaller] = useState<'us' | 'them' | null>(null)
  const timeoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [autoFallbackProgress, setAutoFallbackProgress] = useState(0)

  const store = useMatchStore()
  const { pendingCount, isOnline } = useSyncQueue()

  useEffect(() => {
    if (matchId) {
      store.initMatch(matchId)
    }
  }, [matchId])

  // Track rotation toast
  useEffect(() => {
    if (store.rallies.length > 0) {
      const last = store.rallies[store.rallies.length - 1]
      if (last?.rotated) {
        setShowRotationToast(true)
        setTimeout(() => setShowRotationToast(false), 2000)
      }
    }
  }, [store.rallies.length])

  // Auto-fallback progress bar
  useEffect(() => {
    if (store.scoringStep !== 'awaiting_type') {
      setAutoFallbackProgress(0)
      return
    }
    const start = Date.now()
    const duration = 4000
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      setAutoFallbackProgress(Math.min(1, elapsed / duration))
      if (elapsed >= duration) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [store.scoringStep, store.pendingScorer])

  const { data: match } = useQuery({
    queryKey: ['game', matchId],
    queryFn: () => gamesApi.get(matchId!),
    enabled: !!matchId,
  })

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
  })

  const { data: setData } = useQuery({
    queryKey: ['set', store.currentSetId],
    queryFn: () => setsApi.get(matchId!, store.currentSetId!),
    enabled: !!matchId && !!store.currentSetId,
    refetchInterval: 2000,
  })

  // ── End-set: complete the set then decide what to do next ─────────────────
  const endSetMutation = useMutation({
    mutationFn: () => setsApi.update(matchId!, store.currentSetId!, {
      status: 'completed',
      scoreUs: store.scoreUs,
      scoreThem: store.scoreThem,
    } as unknown as Partial<GameSet>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game', matchId] })
      setShowEndSetModal(false)

      // Compute whether the match is now complete (best of 5, first to 3 sets)
      const setsWonUs   = (match?.setsWonUs   ?? 0) + (store.scoreUs   > store.scoreThem ? 1 : 0)
      const setsWonThem = (match?.setsWonThem ?? 0) + (store.scoreThem > store.scoreUs   ? 1 : 0)
      const matchDone   = setsWonUs === 3 || setsWonThem === 3

      if (matchDone) {
        navigate(`/games/${matchId}/stats`)
      } else {
        setShowSetSummary(true)
      }
    },
  })

  // ── Create the next set once the manager confirms the lineup ──────────────
  const createSetMutation = useMutation({
    mutationFn: () =>
      setsApi.create(matchId!, {
        startingLineup: { ...newSetLineup, setPositions: newSetPositions },
        servingFirst: newSetServingFirst,
      }),
    onSuccess: () => {
      setShowNewSetSetup(false)
      store.initMatch(matchId!)
    },
  })

  const closeTimeoutModal = () => {
    setShowTimeoutModal(false)
    setTimeoutStep('pick')
    setTimeoutSeconds(60)
    setTimeoutCaller(null)
    if (timeoutIntervalRef.current) {
      clearInterval(timeoutIntervalRef.current)
      timeoutIntervalRef.current = null
    }
  }

  const startTimeoutCountdown = (calledBy: 'us' | 'them') => {
    setTimeoutCaller(calledBy)
    setTimeoutStep('timing')
    setTimeoutSeconds(60)
    timeoutIntervalRef.current = setInterval(() => {
      setTimeoutSeconds((prev: number) => {
        if (prev <= 1) {
          clearInterval(timeoutIntervalRef.current!)
          timeoutIntervalRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const timeoutMutation = useMutation({
    mutationFn: (calledBy: 'us' | 'them') => timeoutsApi.add(store.currentSetId!, calledBy),
    onSuccess: (_data: unknown, calledBy: 'us' | 'them') => {
      qc.invalidateQueries({ queryKey: ['set', store.currentSetId] })
      startTimeoutCountdown(calledBy)
    },
    onError: (_err: unknown, calledBy: 'us' | 'them') => {
      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({
          type: 'timeout',
          matchId: matchId!,
          setId: store.currentSetId!,
          method: 'POST',
          url: `/api/sets/${store.currentSetId}/timeouts`,
          body: { calledBy },
        })
        startTimeoutCountdown(calledBy)
      }
    },
  })

  // Parse the static starting-lineup blob (zone→playerID + nested setPositions)
  const rawStarting = match?.sets?.[0]?.startingLineup as unknown as Record<string, unknown> | undefined
  const startingSetPositions = rawStarting?.setPositions as Record<string, string[]> | undefined
  const startingZones = rawStarting
    ? {
        zone1: rawStarting.zone1 as string | undefined,
        zone2: rawStarting.zone2 as string | undefined,
        zone3: rawStarting.zone3 as string | undefined,
        zone4: rawStarting.zone4 as string | undefined,
        zone5: rawStarting.zone5 as string | undefined,
        zone6: rawStarting.zone6 as string | undefined,
      }
    : null

  /**
   * setterPlayerId — the UUID of the setter for this set.
   * Derived once from the starting-lineup blob so it stays stable across rotations.
   * Fallback: scan players[] for anyone whose DB positions include 'Setter'.
   * Used for (a) the live rotation indicator, and (b) rotation stats attribution.
   */
  const setterPlayerId: string | null = (() => {
    if (startingSetPositions && startingZones) {
      const setterStartZone = Object.entries(startingSetPositions)
        .find(([, roles]) => Array.isArray(roles) && roles.includes('Setter'))?.[0]
      if (setterStartZone) {
        return startingZones[setterStartZone as keyof typeof startingZones] ?? null
      }
    }
    return players.find((p: Player) => p.positions.includes('Setter'))?.id ?? null
  })()

  /** Current rotation number — which zone is the setter in right now? */
  const rotationNumber: number | null = (() => {
    if (!store.lineup || !setterPlayerId) return null
    const current = Object.entries(store.lineup).find(([, id]) => id === setterPlayerId)
    return current ? parseInt(current[0].replace('zone', ''), 10) : null
  })()

  /**
   * playerSetRoles: playerId → the role explicitly chosen for this player in this set.
   * Built once from the static starting-lineup blob so it stays correct across rotations.
   * A player who plays in multiple positions but was assigned as 'Setter' for this game
   * will always show 'Setter' colouring, regardless of which zone they rotate into.
   */
  const playerSetRoles: Record<string, string> = (() => {
    const map: Record<string, string> = {}
    if (startingSetPositions && startingZones) {
      for (const [zone, roles] of Object.entries(startingSetPositions)) {
        const playerId = startingZones[zone as keyof typeof startingZones]
        if (playerId && Array.isArray(roles) && roles[0]) {
          map[playerId] = roles[0]
        }
      }
    }
    return map
  })()

  // Volleyball set-win logic
  const setWon = isSetComplete(store.scoreUs, store.scoreThem, store.currentSetNumber)

  // Auto-open the end-set modal when the winning point is confirmed
  useEffect(() => {
    if (setWon && !showEndSetModal && !showSetSummary && !showNewSetSetup) {
      setShowEndSetModal(true)
    }
  }, [setWon])

  // Non-libero substitutions used this set (max 6)
  const nonLiberoSubs = (setData?.substitutions ?? []).filter((s: Substitution) => !s.isLiberoSwap).length

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20">
        {/* Hero match header */}
        <div className="relative overflow-hidden">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/live_logging_header.png)', opacity: 1 }}
          />
          {/* Dark overlay for text contrast */}
          <div className="absolute inset-0 bg-black/35" />

          <div className="relative z-10 flex items-center gap-2 px-4 pt-safe-top pt-7 pb-9">
            <button
              onClick={() => navigate(`/games/${matchId}/stats`)}
              className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>

            {/* Teams + score row */}
            <div className="flex-1 flex items-center justify-between gap-2">
              {/* Home team */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <p className="font-display font-semibold text-lg leading-tight text-white text-center break-words px-1">
                  {store.teamName}
                </p>
                {store.servingTeam === 'us' && (
                  <span className="text-sm leading-none">🏐</span>
                )}
              </div>

              {/* Score + set */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="flex items-center gap-2.5 font-display font-black leading-none">
                  <span className="text-turq-500" style={{ fontSize: '2.75rem' }}>{store.scoreUs}</span>
                  <span className="text-white/50 text-2xl">–</span>
                  <span className="text-white" style={{ fontSize: '2.75rem' }}>{store.scoreThem}</span>
                </div>
                <span className="text-[11px] text-white/60 font-bold uppercase tracking-widest">
                  Set {store.currentSetNumber}
                </span>
              </div>

              {/* Opponent */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <p className="font-display font-semibold text-lg leading-tight text-white/80 text-center break-words px-1">
                  {match?.opponent ?? store.opponentInitials}
                </p>
                {store.servingTeam === 'them' && (
                  <span className="text-sm leading-none">🏐</span>
                )}
              </div>
            </div>

            {/* Spacer balances the back button */}
            <div className="shrink-0 w-9" />
          </div>
        </div>

        {/* Tab bar — solid background prevents court bleed-through on small devices */}
        <div className="bg-surface-container">
          <Tabs tabs={LOG_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>
        <OfflineBanner pendingCount={pendingCount} isOnline={isOnline} />
      </div>

      {/* Rotation toast */}
      {showRotationToast && <RotationToast />}

      {/* Content — log + tactics use full-height no-scroll layout; stats + timeline scroll */}
      {activeTab === 'log' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Court — grows to fill all available space */}
          <div className="flex-1 min-h-0 px-3 pt-3 flex flex-col">
            <CourtView
              lineup={store.lineup}
              players={players}
              servingTeam={store.servingTeam}
              rotationNumber={rotationNumber}
              playerSetRoles={playerSetRoles}
              className="flex-1 min-h-0"
            />
          </div>

          {/* Scoring controls
               The inner slot has a fixed min-height equal to the taller "awaiting_type" state
               so the court never shifts when the step changes. */}
          <div className="shrink-0 px-4 pt-3 pb-1 flex flex-col gap-2">
            {/* Fixed-height slot — both states rendered inside it */}
            <div className="min-h-[140px] flex flex-col justify-center">
              {store.scoringStep === 'idle' ? (
                /* Step 1: Who scored? */
                <div className="flex gap-3">
                  <button
                    onClick={() => store.tapScore('us')}
                    disabled={store.isCommitting || setWon}
                    className={cn(
                      'flex-1 h-14 rounded-full border-2 font-display font-bold text-base uppercase tracking-wide transition-all active:scale-95',
                      'border-turq-500 text-turq-500 backdrop-blur-[20px] backdrop-saturate-[180%] bg-turq-500/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-turq-500/10',
                      (store.isCommitting || setWon) && 'opacity-50'
                    )}
                  >
                    {store.teamInitials} ⊕
                  </button>
                  <button
                    onClick={() => store.tapScore('them')}
                    disabled={store.isCommitting || setWon}
                    className={cn(
                      'flex-1 h-14 rounded-full border-2 font-display font-bold text-base uppercase tracking-wide transition-all active:scale-95',
                      'border-white/20 text-on-surface backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.08]',
                      (store.isCommitting || setWon) && 'opacity-50'
                    )}
                  >
                    {store.opponentInitials} ⊕
                  </button>
                </div>
              ) : (
                /* Step 2: How was the point earned? */
                <div className="space-y-2">
                  <p className="text-xs text-center text-on-surface-variant font-bold uppercase tracking-wide">
                    {store.pendingScorer === 'us' ? 'Our point — how?' : 'Their point — how?'}
                  </p>
                  <ProgressBar value={autoFallbackProgress} color="orange" height="sm" className="mb-2" />
                  <div className="flex gap-3">
                    <button
                      onClick={() => store.tapPointType('positive')}
                      className={cn(
                        'flex-1 h-14 rounded-full border-2 font-display font-bold text-sm uppercase tracking-wide transition-all active:scale-95 backdrop-blur-[20px] backdrop-saturate-[180%] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]',
                        store.pendingScorer === 'us'
                          ? 'border-turq-500 text-turq-400 bg-turq-500/[0.12] hover:bg-turq-500/20'
                          : 'border-bubb-500 text-bubb-400 bg-bubb-500/[0.12] hover:bg-bubb-500/20'
                      )}
                    >
                      {store.pendingScorer === 'us' ? '✓ Own point' : '✓ Their play'}
                    </button>
                    <button
                      onClick={() => store.tapPointType('error')}
                      className={cn(
                        'flex-1 h-14 rounded-full border-2 font-display font-bold text-sm uppercase tracking-wide transition-all active:scale-95',
                        'border-white/20 text-on-surface-variant backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.08]'
                      )}
                    >
                      {store.pendingScorer === 'us' ? '✗ Their error' : '✗ Our error'}
                    </button>
                  </div>
                  <button
                    onClick={store.cancelScoring}
                    className="w-full text-xs text-on-surface-variant py-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Undo */}
            <button
              onClick={store.undoLastRally}
              disabled={store.rallies.length === 0}
              className="flex items-center justify-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors py-1 disabled:opacity-30"
            >
              <RotateCcw size={12} /> Undo last point
            </button>
          </div>

          {/* Bottom action icons — pinned to bottom */}
          <div className="shrink-0 flex justify-around items-center px-4 py-3 border-t border-outline/10">
            {[
              { icon: <RefreshCw size={18} />, label: 'Lineup', badge: null, disabled: store.rallies.length > 0, action: () => setShowNewSetSetup(true) },
              { icon: <ChevronDown size={18} />, label: 'Sub', badge: `${nonLiberoSubs}/6`, disabled: store.rallies.length === 0, action: () => setShowSubModal(true) },
              { icon: <Clock size={18} />, label: 'Timeout', badge: null, disabled: store.rallies.length === 0, action: () => setShowTimeoutModal(true) },
              { icon: <Flag size={18} />, label: 'End Set', badge: null, disabled: !setWon, action: () => setShowEndSetModal(true) },
            ].map(({ icon, label, badge, disabled, action }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                  disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/[0.06] hover:shadow-[0_2px_12px_rgba(0,0,0,0.25)]'
                )}
              >
                <span className={cn('text-on-surface-variant', label === 'End Set' && setWon && 'text-turq-500')}>{icon}</span>
                <span className={cn(
                  'text-[10px] font-bold uppercase',
                  label === 'End Set' && setWon ? 'text-turq-500' : 'text-on-surface-variant'
                )}>{label}</span>
                {badge !== null && (
                  <span className="text-[9px] text-on-surface-variant/50 font-bold -mt-0.5">{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : activeTab === 'tactics' ? (
        <TacticsTab
          lineup={store.lineup}
          players={players}
          playerSetRoles={playerSetRoles}
          servingTeam={store.servingTeam}
          rotationNumber={rotationNumber}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'stats' && (
            <LiveStatsTab
              rallies={store.rallies}
              scoreUs={store.scoreUs}
              scoreThem={store.scoreThem}
              setterPlayerId={setterPlayerId}
              teamName={match?.team?.name}
              opponentName={match?.opponent ?? undefined}
            />
          )}
          {activeTab === 'timeline' && setData && (
            <TimelineTab
              set={setData}
              matchId={matchId!}
            />
          )}
        </div>
      )}

      {/* Substitution Modal */}
      <BottomSheet
        open={showSubModal}
        onClose={() => setShowSubModal(false)}
        title={`Substitution — ${nonLiberoSubs}/6 used`}
      >
        <SubstitutionForm
          setId={store.currentSetId || ''}
          matchId={matchId || ''}
          players={players}
          lineup={store.lineup}
          onSuccess={(playerOutId, playerInId) => {
            store.applySubstitution(playerOutId, playerInId)
            setShowSubModal(false)
            qc.invalidateQueries({ queryKey: ['set', store.currentSetId] })
          }}
        />
      </BottomSheet>

      {/* Timeout Modal */}
      <BottomSheet
        open={showTimeoutModal}
        onClose={closeTimeoutModal}
        title="Timeout"
      >
        {timeoutStep === 'pick' ? (
          /* Step 1 — who called it? */
          <div className="space-y-3">
            <Button
              fullWidth
              onClick={() => timeoutMutation.mutate('us')}
              loading={timeoutMutation.isPending}
            >
              Called by Us
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={() => timeoutMutation.mutate('them')}
              loading={timeoutMutation.isPending}
            >
              Called by Them
            </Button>
          </div>
        ) : (
          /* Step 2 — 60 s countdown */
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Who called it */}
            <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
              {timeoutCaller === 'us' ? 'Our timeout' : 'Their timeout'}
            </p>

            {/* Timer or "Back to court" */}
            {timeoutSeconds > 0 ? (
              <p className="font-display font-black text-secondary-container"
                style={{ fontSize: '4.5rem', lineHeight: 1 }}>
                {Math.floor(timeoutSeconds / 60)}:{String(timeoutSeconds % 60).padStart(2, '0')}
              </p>
            ) : (
              <p className="font-display font-bold text-2xl text-secondary-container tracking-wide">
                Back to court!
              </p>
            )}

            {/* Dismiss / confirm button */}
            <Button
              fullWidth
              variant={timeoutSeconds === 0 ? 'secondary' : 'ghost'}
              onClick={closeTimeoutModal}
            >
              {timeoutSeconds > 0 ? 'Dismiss early' : 'Back to court'}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* End Set Modal */}
      <BottomSheet
        open={showEndSetModal}
        onClose={() => setShowEndSetModal(false)}
        title={`End Set ${store.currentSetNumber}?`}
      >
        <div className="space-y-4">
          <p className="text-center text-on-surface-variant">
            Current score: <span className="font-bold text-on-surface">{store.scoreUs} – {store.scoreThem}</span>
          </p>
          <Button
            fullWidth
            onClick={() => endSetMutation.mutate()}
            loading={endSetMutation.isPending}
          >
            Confirm — End Set {store.currentSetNumber}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setShowEndSetModal(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>

      {/* ── New-set lineup overlay ──────────────────────────────────────────
          Full-screen so CourtLineupSetup has room to work. Shown automatically
          after a non-final set ends, and also when the Lineup button is tapped
          (only enabled when 0 rallies have been logged in the current set).  */}
      {showNewSetSetup && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10 shrink-0">
            <button
              onClick={() => setShowNewSetSetup(false)}
              className="p-2 -ml-2 rounded-full hover:bg-white/[0.06]"
            >
              <ArrowLeft size={18} className="text-on-surface" />
            </button>
            <div className="flex-1">
              <h1 className="font-display font-bold text-base text-on-surface">
                Set {store.currentSetNumber + 1} — Starting lineup
              </h1>
              <p className="text-xs text-on-surface-variant">Assign all 6 zones, then confirm</p>
            </div>
          </div>

          {/* Serving-first toggle */}
          <div className="shrink-0 px-4 pt-3 pb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">Who serves first?</p>
            <div className="flex gap-2">
              {(['us', 'them'] as const).map(side => (
                <button
                  key={side}
                  onClick={() => setNewSetServingFirst(side)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border text-sm font-bold uppercase tracking-wide transition-all',
                    newSetServingFirst === side
                      ? 'border-turq-500 bg-turq-500/10 text-turq-500'
                      : 'border-outline/20 text-on-surface-variant'
                  )}
                >
                  {side === 'us' ? store.teamInitials : store.opponentInitials}
                </button>
              ))}
            </div>
          </div>

          {/* Lineup setup */}
          <div className="flex-1 overflow-y-auto">
            <CourtLineupSetup
              players={match?.matchPlayers?.map((mp: { player: Player }) => mp.player) ?? players}
              lineup={newSetLineup}
              setPositions={newSetPositions}
              onLineupChange={(lineup, setPositions) => {
                setNewSetLineup(lineup)
                setNewSetPositions(setPositions)
              }}
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-4 border-t border-outline/10">
            <Button
              fullWidth
              onClick={() => createSetMutation.mutate()}
              loading={createSetMutation.isPending}
              disabled={Object.keys(newSetLineup).length < 6}
            >
              Start Set {store.currentSetNumber + 1}
            </Button>
          </div>
        </div>
      )}

      {/* Set Summary Overlay */}
      {showSetSummary && (
        <SetSummaryOverlay
          matchId={matchId!}
          setNumber={store.currentSetNumber}
          scoreUs={store.scoreUs}
          scoreThem={store.scoreThem}
          rallies={store.rallies}
          setterPlayerId={setterPlayerId}
          teamName={store.teamName}
          teamInitials={store.teamInitials}
          opponentName={match?.opponent ?? store.opponentInitials}
          sets={match?.sets ?? []}
          onSetupNextSet={() => {
            setShowSetSummary(false)
            if (store.lineup) {
              const preFilledPositions = Object.fromEntries(
                Object.entries(store.lineup).map(([zone, pid]) => {
                  const playerId = pid as string
                  return [
                    zone,
                    [playerSetRoles[playerId] ?? players.find((p: Player) => p.id === playerId)?.positions[0] ?? 'Unknown'],
                  ]
                })
              ) as Record<Zone, string[]>
              setNewSetLineup(store.lineup as Partial<Lineup>)
              setNewSetPositions(preFilledPositions)
            }
            setNewSetServingFirst('us')
            setShowNewSetSetup(true)
          }}
          onViewStats={() => navigate(`/games/${matchId}/stats`)}
        />
      )}
    </div>
  )
}

function SubstitutionForm({
  setId, matchId, players, lineup, onSuccess,
}: {
  setId: string
  matchId: string
  players: Player[]
  lineup: Lineup | null
  onSuccess: (playerOutId: string, playerInId: string) => void
}) {
  const [playerOutId, setPlayerOutId] = useState('')
  const [playerInId, setPlayerInId] = useState('')
  const [isLiberoSwap, setIsLiberoSwap] = useState(false)

  const mutation = useMutation({
    mutationFn: () => subsApi.add(setId, { playerOutId, playerInId, isLiberoSwap }),
    onSuccess: () => onSuccess(playerOutId, playerInId),
    onError: () => {
      if (!navigator.onLine) {
        useOfflineStore.getState().enqueue({
          type: 'substitution',
          matchId,
          setId,
          method: 'POST',
          url: `/api/sets/${setId}/substitutions`,
          body: { playerOutId, playerInId, isLiberoSwap },
        })
        onSuccess(playerOutId, playerInId)
      }
    },
  })

  const onCourtIds = lineup ? Object.values(lineup) : []
  const onCourtPlayers = players.filter(p => onCourtIds.includes(p.id))
  const benchPlayers = players.filter(p => !onCourtIds.includes(p.id))

  const makeOpts = (pList: Player[]) =>
    pList.map(p => ({ value: p.id, label: `#${p.jersey || '?'} ${p.firstName} ${p.lastName}` }))

  return (
    <div className="space-y-4">
      <Select
        label="Player OUT (on court)"
        value={playerOutId}
        onChange={e => setPlayerOutId(e.target.value)}
        options={[{ value: '', label: 'Select...' }, ...makeOpts(onCourtPlayers)]}
      />
      <Select
        label="Player IN (bench)"
        value={playerInId}
        onChange={e => setPlayerInId(e.target.value)}
        options={[{ value: '', label: 'Select...' }, ...makeOpts(benchPlayers)]}
      />
      <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
        <input
          type="checkbox"
          checked={isLiberoSwap}
          onChange={e => setIsLiberoSwap(e.target.checked)}
          className="w-4 h-4 accent-turq-500"
        />
        Libero swap (doesn't count against limit)
      </label>
      <Button
        fullWidth
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!playerOutId || !playerInId}
      >
        Confirm substitution
      </Button>
    </div>
  )
}
