import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Player } from '../../lib/api'
import { Zone, ALL_ZONES, ZONE_POSITIONS, isBackRow, Lineup } from '../../lib/rotation'
import { cn } from '../ui/cn'
import { PlayerToken } from './PlayerToken'

interface CourtLineupSetupProps {
  players: Player[]
  lineup: Partial<Lineup>
  setPositions: Record<Zone, string[]>
  onLineupChange: (lineup: Partial<Lineup>, setPositions: Record<Zone, string[]>) => void
}

// Zone display names
const ZONE_LABELS: Record<Zone, string> = {
  zone4: 'Zone 4', zone3: 'Zone 3', zone2: 'Zone 2',
  zone5: 'Zone 5', zone6: 'Zone 6', zone1: 'Zone 1',
}

const ZONE_GRID: Zone[][] = [
  ['zone4', 'zone3', 'zone2'],  // front row
  ['zone5', 'zone6', 'zone1'],  // back row
]

export function CourtLineupSetup({
  players, lineup, setPositions, onLineupChange
}: CourtLineupSetupProps) {
  const { t } = useTranslation()
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [positionPickerPlayer, setPositionPickerPlayer] = useState<{ playerId: string; zone: Zone } | null>(null)

  const assignedIds = new Set(Object.values(lineup))

  const handleZoneTap = (zone: Zone) => {
    if (selectedZone === zone) {
      setSelectedZone(null)
    } else {
      setSelectedZone(zone)
    }
  }

  const handlePlayerTap = (playerId: string) => {
    if (!selectedZone) return

    // If player has multiple positions, show picker
    const player = players.find(p => p.id === playerId)
    if (player && player.positions.length > 1) {
      setPositionPickerPlayer({ playerId, zone: selectedZone })
      return
    }

    const pos = player?.positions[0] ? [player.positions[0]] : ['Unknown']
    const newLineup = { ...lineup, [selectedZone]: playerId } as Partial<Lineup>
    const newSetPos = { ...setPositions, [selectedZone]: pos }
    onLineupChange(newLineup, newSetPos)
    setSelectedZone(null)
  }

  const handleRemoveFromZone = (zone: Zone) => {
    const newLineup = { ...lineup }
    delete (newLineup as Record<string, unknown>)[zone]
    onLineupChange(newLineup, setPositions)
  }

  const confirmPosition = (position: string) => {
    if (!positionPickerPlayer) return
    const { playerId, zone } = positionPickerPlayer
    const newLineup = { ...lineup, [zone]: playerId } as Partial<Lineup>
    const newSetPos = { ...setPositions, [zone]: [position] }
    onLineupChange(newLineup, newSetPos)
    setSelectedZone(null)
    setPositionPickerPlayer(null)
  }

  const filledCount = ALL_ZONES.filter(z => lineup[z]).length
  const liberoPlayer = players.find(p => p.isLibero)
  const liberoId = liberoPlayer?.id
  const liberoZone = liberoId ? Object.entries(lineup).find(([, id]) => id === liberoId)?.[0] as Zone | undefined : undefined
  const liberoInFront = liberoZone && !isBackRow(liberoZone)

  return (
    <div>
      <p className="text-sm text-on-surface-variant mb-3">
        Tap a zone, then tap a player to assign. ({filledCount}/6 filled)
      </p>

      {liberoInFront && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-error-container/20 border border-error/20 text-xs text-error">
          Libero must be in a back-row zone (1, 5, or 6)
        </div>
      )}

      {/* Court grid */}
      <div className="w-full bg-surface-high rounded-xl p-3 mb-4 border border-outline/10">
        {/* Net */}
        <div className="text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">{t('court.net')}</div>
        <div className="w-full h-px bg-secondary-container/30 mb-3" />

        {ZONE_GRID.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-3 gap-2 mb-2">
            {row.map(zone => {
              const playerId = lineup[zone]
              const player = playerId ? players.find(p => p.id === playerId) : null
              const isSelected = selectedZone === zone

              return (
                <button
                  key={zone}
                  onClick={() => playerId ? handleRemoveFromZone(zone) : handleZoneTap(zone)}
                  className={cn(
                    'rounded-lg p-2 min-h-[60px] flex flex-col items-center justify-center border transition-all',
                    isSelected && !playerId && 'border-orange bg-orange/10',
                    !isSelected && !playerId && 'border-outline/20 border-dashed bg-surface-container',
                    playerId && 'border-outline/20 bg-surface-container',
                  )}
                >
                  <span className="text-[9px] text-on-surface-variant mb-1 font-bold">{zone.replace('zone', 'Z')}</span>
                  {player ? (
                    <PlayerToken player={player} position={(setPositions[zone]?.[0]) || player.positions[0]} compact />
                  ) : (
                    <span className="text-xs text-on-surface-variant/40">
                      {isSelected ? t('court.pickPlayer') : t('court.empty')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        <div className="text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-2">{t('court.ourBaseline')}</div>
      </div>

      {/* Player list for assignment */}
      {selectedZone && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange mb-2">
            Select player for {ZONE_LABELS[selectedZone]}:
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {players
              .filter(p => !assignedIds.has(p.id) || lineup[selectedZone] === p.id)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePlayerTap(p.id)}
                  disabled={assignedIds.has(p.id) && lineup[selectedZone] !== p.id}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all',
                    assignedIds.has(p.id) && lineup[selectedZone] !== p.id
                      ? 'opacity-30'
                      : 'bg-surface-high hover:bg-surface-highest'
                  )}
                >
                  <span className="font-display font-bold text-sm text-orange w-6 shrink-0">
                    #{p.jersey || '–'}
                  </span>
                  <span className="font-bold text-sm text-on-surface flex-1">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-xs text-on-surface-variant">{p.positions.join('/')}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Position picker modal */}
      {positionPickerPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-sm bg-surface-container rounded-t-2xl p-6">
            <h3 className="font-display font-bold text-base text-on-surface mb-3">
              {t('court.selectPosition')}
            </h3>
            <div className="flex flex-col gap-2">
              {players.find(p => p.id === positionPickerPlayer.playerId)?.positions.map(pos => (
                <button
                  key={pos}
                  onClick={() => confirmPosition(pos)}
                  className="py-3 px-4 rounded-xl bg-surface-high hover:bg-surface-highest text-on-surface font-bold text-sm transition-all"
                >
                  {t(`positions.${pos}`, { defaultValue: pos })}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPositionPickerPlayer(null)}
              className="mt-3 w-full py-2 text-sm text-on-surface-variant"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
