import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gamesApi, playersApi, seasonsApi, Player, Season } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Select } from '../ui/Select'
import { Badge, PositionBadge } from '../ui/Badge'
import { CourtLineupSetup } from '../court/CourtLineupSetup'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { cn } from '../ui/cn'
import { Lineup, Zone, ALL_ZONES } from '../../lib/rotation'

type MatchType = 'playing' | 'officiating'

interface WizardState {
  step: number
  matchType: MatchType
  // Step 1 — Playing
  opponent: string
  opponentInitials: string
  date: string
  location: string
  firstServe: 'us' | 'them'
  seasonId: string
  // Step 1 — Officiating
  homeTeam: string
  guestTeam: string
  ref1Id: string
  ref2Id: string
  scorer1Id: string
  scorer2Id: string
  // Step 2 — Players
  selectedPlayerIds: string[]
  // Step 3 — Lineup
  lineup: Partial<Lineup>
  setPositions: Record<Zone, string[]>
}

const TOTAL_STEPS_PLAYING = 3
const TOTAL_STEPS_OFFICIATING = 1

export function CreateGameWizard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const today = new Date().toISOString().slice(0, 16)

  const [state, setState] = useState<WizardState>({
    step: 0,
    matchType: 'playing',
    opponent: '', opponentInitials: '', date: today, location: '', firstServe: 'us', seasonId: '',
    homeTeam: '', guestTeam: '',
    ref1Id: '', ref2Id: '', scorer1Id: '', scorer2Id: '',
    selectedPlayerIds: [],
    lineup: {}, setPositions: {} as Record<Zone, string[]>,
  })

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
  })

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ['seasons'],
    queryFn: seasonsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof gamesApi.create>[0]) => gamesApi.create(data),
    onSuccess: (match, _vars, ctx) => {
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })

  const update = (patch: Partial<WizardState>) => setState(s => ({ ...s, ...patch }))
  const next = () => setState(s => ({ ...s, step: s.step + 1 }))
  const prev = () => {
    if (state.step === 0) navigate(-1)
    else setState(s => ({ ...s, step: s.step - 1 }))
  }

  const totalSteps = state.matchType === 'playing' ? TOTAL_STEPS_PLAYING : TOTAL_STEPS_OFFICIATING

  const handleConfirm = async (goLog = false) => {
    const startingLineup = Object.keys(state.lineup).length === 6
      ? { ...state.lineup, setPositions: state.setPositions }
      : undefined

    try {
      const match = await createMutation.mutateAsync({
        matchType: state.matchType,
        opponent: state.opponent || undefined,
        opponentInitials: state.opponentInitials || state.opponent?.slice(0, 3).toUpperCase() || undefined,
        homeTeam: state.homeTeam || undefined,
        guestTeam: state.guestTeam || undefined,
        date: state.date,
        location: state.location || undefined,
        firstServe: state.firstServe,
        seasonId: state.seasonId || undefined,
        playerIds: state.selectedPlayerIds,
        startingLineup,
        ref1Id: state.ref1Id || undefined,
        ref2Id: state.ref2Id || undefined,
        scorer1Id: state.scorer1Id || undefined,
        scorer2Id: state.scorer2Id || undefined,
      } as unknown as Parameters<typeof gamesApi.create>[0])

      if (goLog && match.id) {
        navigate(`/games/${match.id}/log`)
      } else {
        navigate('/games')
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-4 pb-4 flex items-center gap-3 border-b border-outline/10">
        <button onClick={prev} className="p-2 -ml-2 rounded-full hover:bg-surface-high transition-colors">
          <ArrowLeft size={20} className="text-on-surface" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base text-on-surface">
            {state.matchType === 'officiating' ? 'New Officiating Game' : 'New Game'}
          </h1>
          {state.matchType === 'playing' && (
            <p className="text-xs text-on-surface-variant">
              Step {state.step + 1} of {totalSteps}
            </p>
          )}
        </div>

        {/* Step indicator dots */}
        {state.matchType === 'playing' && (
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === state.step ? 'bg-orange w-4' : i < state.step ? 'bg-orange/60' : 'bg-surface-high'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Match type selector (only on step 0) */}
        {state.step === 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">Match Type</p>
            <div className="flex gap-2">
              {(['playing', 'officiating'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => update({ matchType: t })}
                  className={cn(
                    'flex-1 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition-all',
                    state.matchType === t
                      ? 'border-orange bg-orange/10 text-orange'
                      : 'border-outline/20 text-on-surface-variant hover:border-outline/40'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 0 — Match details */}
        {state.step === 0 && state.matchType === 'playing' && (
          <div className="space-y-4">
            {seasons.length > 0 && (
              <Select
                label="Season"
                value={state.seasonId}
                onChange={e => update({ seasonId: e.target.value })}
                options={[
                  { value: '', label: 'No season' },
                  ...seasons.map(s => ({ value: s.id, label: s.name + (s.isActive ? ' (Active)' : '') })),
                ]}
              />
            )}
            <Input
              label="Opponent"
              value={state.opponent}
              onChange={e => {
                const opp = e.target.value
                update({
                  opponent: opp,
                  opponentInitials: opp.slice(0, 3).toUpperCase(),
                })
              }}
              placeholder="Opponent team name"
              required
            />
            <Input
              label="Opponent initials (max 6)"
              value={state.opponentInitials}
              onChange={e => update({ opponentInitials: e.target.value.toUpperCase().slice(0, 6) })}
              placeholder="e.g. OPP"
              maxLength={6}
            />
            <Input
              label="Date & time"
              type="datetime-local"
              value={state.date}
              onChange={e => update({ date: e.target.value })}
              required
            />
            <Input
              label="Location"
              value={state.location}
              onChange={e => update({ location: e.target.value })}
              placeholder="Optional"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">Who serves first?</p>
              <div className="flex gap-2">
                {(['us', 'them'] as const).map(srv => (
                  <button
                    key={srv}
                    onClick={() => update({ firstServe: srv })}
                    className={cn(
                      'flex-1 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition-all',
                      state.firstServe === srv
                        ? 'border-orange bg-orange/10 text-orange'
                        : 'border-outline/20 text-on-surface-variant'
                    )}
                  >
                    {srv === 'us' ? 'Us' : 'Them'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Officiating form */}
        {state.step === 0 && state.matchType === 'officiating' && (
          <div className="space-y-4">
            <Input label="Home team" value={state.homeTeam} onChange={e => update({ homeTeam: e.target.value })} required />
            <Input label="Guest team" value={state.guestTeam} onChange={e => update({ guestTeam: e.target.value })} required />
            <Input label="Date & time" type="datetime-local" value={state.date} onChange={e => update({ date: e.target.value })} required />
            <Input label="Location" value={state.location} onChange={e => update({ location: e.target.value })} />

            {/* Officials from our roster — each player can only hold one role */}
            {players.length > 0 && (() => {
              // Build a "taken" set for each slot: every selected ID except its own slot
              const taken = (ownId: string) =>
                new Set([state.ref1Id, state.ref2Id, state.scorer1Id, state.scorer2Id]
                  .filter(id => id && id !== ownId))

              const opts = (ownId: string) => [
                { value: '', label: 'None' },
                ...players
                  .filter(p => !taken(ownId).has(p.id))
                  .map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` })),
              ]

              return (
                <div className="pt-1 border-t border-outline/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Officials from roster</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="1st Referee" value={state.ref1Id}   onChange={e => update({ ref1Id:    e.target.value })} options={opts(state.ref1Id)} />
                      <Select label="2nd Referee" value={state.ref2Id}   onChange={e => update({ ref2Id:    e.target.value })} options={opts(state.ref2Id)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="1st Scorer"  value={state.scorer1Id} onChange={e => update({ scorer1Id: e.target.value })} options={opts(state.scorer1Id)} />
                      <Select label="2nd Scorer"  value={state.scorer2Id} onChange={e => update({ scorer2Id: e.target.value })} options={opts(state.scorer2Id)} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Step 1 — Player selection */}
        {state.step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-on-surface">Select players ({state.selectedPlayerIds.length} selected)</p>
              <div className="flex gap-2">
                <button
                  onClick={() => update({ selectedPlayerIds: players.map(p => p.id) })}
                  className="text-xs text-orange font-bold"
                >
                  All
                </button>
                <button
                  onClick={() => update({ selectedPlayerIds: [] })}
                  className="text-xs text-on-surface-variant font-bold"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {players.map(p => {
                const isSelected = state.selectedPlayerIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (isSelected) {
                        update({ selectedPlayerIds: state.selectedPlayerIds.filter(id => id !== p.id) })
                      } else {
                        update({ selectedPlayerIds: [...state.selectedPlayerIds, p.id] })
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
                      isSelected ? 'border-orange/40 bg-orange/5' : 'border-outline/10 bg-surface-high'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0',
                      isSelected ? 'border-orange bg-orange' : 'border-outline/40'
                    )}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <span className="font-display font-bold text-sm text-orange w-7 shrink-0">
                      #{p.jersey || '–'}
                    </span>
                    <span className="font-bold text-sm text-on-surface flex-1 text-left">
                      {p.firstName} {p.lastName}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {p.positions.slice(0, 2).map(pos => (
                        <PositionBadge key={pos} position={pos} />
                      ))}
                      {p.isLibero && <Badge label="L" variant="orange" size="sm" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2 — Starting lineup */}
        {state.step === 2 && (
          <CourtLineupSetup
            players={players.filter(p => state.selectedPlayerIds.includes(p.id))}
            lineup={state.lineup}
            setPositions={state.setPositions}
            onLineupChange={(lineup, setPositions) => update({ lineup, setPositions })}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-outline/10 flex gap-3">
        {/* Officiating / step 0 playing */}
        {state.matchType === 'officiating' && state.step === 0 && (
          <Button
            fullWidth
            onClick={() => handleConfirm(false)}
            loading={createMutation.isPending}
            disabled={!state.homeTeam || !state.guestTeam}
          >
            Create game
          </Button>
        )}

        {state.matchType === 'playing' && state.step === 0 && (
          <Button
            fullWidth
            onClick={next}
            disabled={!state.opponent || !state.date}
          >
            Next: Select players <ChevronRight size={16} />
          </Button>
        )}

        {state.matchType === 'playing' && state.step === 1 && (
          <Button
            fullWidth
            onClick={next}
            disabled={state.selectedPlayerIds.length < 6}
          >
            Next: Set lineup <ChevronRight size={16} />
          </Button>
        )}

        {state.matchType === 'playing' && state.step === 2 && (
          <>
            <Button
              variant="outline"
              onClick={() => handleConfirm(false)}
              loading={createMutation.isPending}
              disabled={Object.keys(state.lineup).length < 6}
              className="flex-1"
            >
              Save
            </Button>
            <Button
              onClick={() => handleConfirm(true)}
              loading={createMutation.isPending}
              disabled={Object.keys(state.lineup).length < 6}
              className="flex-1"
            >
              Save & Log
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
