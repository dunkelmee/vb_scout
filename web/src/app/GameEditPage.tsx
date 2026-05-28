import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gamesApi, playersApi, seasonsApi, Player, Season } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft } from 'lucide-react'

export function GameEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()

  // Form state
  const [opponent, setOpponent]             = useState('')
  const [opponentInitials, setOppInitials]  = useState('')
  const [homeTeam, setHomeTeam]             = useState('')
  const [guestTeam, setGuestTeam]           = useState('')
  const [date, setDate]                     = useState('')
  const [location, setLocation]             = useState('')
  const [firstServe, setFirstServe]         = useState<'us' | 'them'>('us')
  const [seasonId, setSeasonId]             = useState('')
  const [ref1Id, setRef1Id]                 = useState('')
  const [ref2Id, setRef2Id]                 = useState('')
  const [scorer1Id, setScorer1Id]           = useState('')
  const [scorer2Id, setScorer2Id]           = useState('')

  const { data: match, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: () => gamesApi.get(id!),
    enabled: !!id,
  })

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
  })

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ['seasons'],
    queryFn: seasonsApi.list,
  })

  // Populate form once match loads
  useEffect(() => {
    if (!match) return
    setOpponent(match.opponent ?? '')
    setOppInitials(match.opponentInitials ?? '')
    setHomeTeam(match.homeTeam ?? '')
    setGuestTeam(match.guestTeam ?? '')
    // Convert ISO datetime to datetime-local string (YYYY-MM-DDTHH:mm)
    setDate(match.date ? match.date.slice(0, 16) : '')
    setLocation(match.location ?? '')
    setFirstServe((match.firstServe as 'us' | 'them') ?? 'us')
    setSeasonId(match.seasonId ?? '')
    // Officiating officials — load existing values so the dropdowns reflect what's saved
    setRef1Id(match.ref1Id ?? '')
    setRef2Id(match.ref2Id ?? '')
    setScorer1Id(match.scorer1Id ?? '')
    setScorer2Id(match.scorer2Id ?? '')
  }, [match])

  const updateMutation = useMutation({
    mutationFn: () =>
      gamesApi.update(id!, {
        opponent:         match?.matchType === 'playing' ? opponent  : undefined,
        opponentInitials: match?.matchType === 'playing' ? opponentInitials : undefined,
        homeTeam:         match?.matchType === 'officiating' ? homeTeam  : undefined,
        guestTeam:        match?.matchType === 'officiating' ? guestTeam : undefined,
        date,
        location: location || undefined,
        firstServe: match?.matchType === 'playing' ? firstServe : undefined,
        seasonId:  seasonId || undefined,
        // For officiating games always send the current values (empty string → null to clear)
        ref1Id:    match?.matchType === 'officiating' ? (ref1Id    || null) : undefined,
        ref2Id:    match?.matchType === 'officiating' ? (ref2Id    || null) : undefined,
        scorer1Id: match?.matchType === 'officiating' ? (scorer1Id || null) : undefined,
        scorer2Id: match?.matchType === 'officiating' ? (scorer2Id || null) : undefined,
      } as Parameters<typeof gamesApi.update>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game', id] })
      qc.invalidateQueries({ queryKey: ['games'] })
      showToast('Game updated', 'success')
      navigate('/games')
    },
    onError: () => showToast('Failed to update game', 'error'),
  })

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-on-surface-variant text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-error text-sm">Game not found.</p>
      </div>
    )
  }

  const isPlaying = match.matchType === 'playing'

  // Build per-slot option list excluding players already chosen in other slots
  const officialOpts = (ownId: string) => {
    const taken = new Set([ref1Id, ref2Id, scorer1Id, scorer2Id].filter(id => id && id !== ownId))
    return [
      { value: '', label: 'None' },
      ...players
        .filter((p: Player) => !taken.has(p.id))
        .map((p: Player) => ({ value: p.id, label: `${p.firstName} ${p.lastName}${p.jersey ? ` #${p.jersey}` : ''}` })),
    ]
  }

  const canSave = isPlaying ? !!opponent && !!date : !!homeTeam && !!guestTeam && !!date

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-4 pb-4 flex items-center gap-3 border-b border-outline/10 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate('/games')}
          className="p-2 -ml-2 rounded-full hover:bg-surface-high transition-colors"
        >
          <ArrowLeft size={20} className="text-on-surface" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base text-on-surface">Edit game</h1>
          <p className="text-xs text-on-surface-variant">
            {isPlaying ? `vs ${match.opponent || 'TBD'}` : `${match.homeTeam || '?'} vs ${match.guestTeam || '?'}`}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {isPlaying ? (
          <>
            <Input
              label="Opponent"
              value={opponent}
              onChange={e => {
                setOpponent(e.target.value)
                if (!opponentInitials || opponentInitials === opponent.slice(0, 3).toUpperCase()) {
                  setOppInitials(e.target.value.slice(0, 3).toUpperCase())
                }
              }}
              required
            />
            <Input
              label="Opponent initials (max 6)"
              value={opponentInitials}
              onChange={e => setOppInitials(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="e.g. OPP"
            />
          </>
        ) : (
          <>
            <Input label="Home team"  value={homeTeam}  onChange={e => setHomeTeam(e.target.value)}  required />
            <Input label="Guest team" value={guestTeam} onChange={e => setGuestTeam(e.target.value)} required />
          </>
        )}

        <Input
          label="Date & time"
          type="datetime-local"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
        <Input
          label="Location"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Optional"
        />

        {isPlaying && (
          <>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">Who serves first?</p>
              <div className="flex gap-2">
                {(['us', 'them'] as const).map(srv => (
                  <button
                    key={srv}
                    onClick={() => setFirstServe(srv)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold uppercase tracking-wide transition-all ${
                      firstServe === srv
                        ? 'border-orange bg-orange/10 text-orange'
                        : 'border-outline/20 text-on-surface-variant'
                    }`}
                  >
                    {srv === 'us' ? 'Us' : 'Them'}
                  </button>
                ))}
              </div>
            </div>

            {seasons.length > 0 && (
              <Select
                label="Season"
                value={seasonId}
                onChange={e => setSeasonId(e.target.value)}
                options={[
                  { value: '', label: 'No season' },
                  ...seasons.map(s => ({ value: s.id, label: s.name + (s.isActive ? ' (Active)' : '') })),
                ]}
              />
            )}
          </>
        )}

        {!isPlaying && players.length > 0 && (
          <div className="pt-2 border-t border-outline/10 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Officials from roster</p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="1st Referee" value={ref1Id}    onChange={e => setRef1Id(e.target.value)}    options={officialOpts(ref1Id)} />
              <Select label="2nd Referee" value={ref2Id}    onChange={e => setRef2Id(e.target.value)}    options={officialOpts(ref2Id)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="1st Scorer"  value={scorer1Id} onChange={e => setScorer1Id(e.target.value)} options={officialOpts(scorer1Id)} />
              <Select label="2nd Scorer"  value={scorer2Id} onChange={e => setScorer2Id(e.target.value)} options={officialOpts(scorer2Id)} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-outline/10 flex gap-3">
        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          loading={updateMutation.isPending}
          disabled={!canSave}
          className="flex-1"
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}
