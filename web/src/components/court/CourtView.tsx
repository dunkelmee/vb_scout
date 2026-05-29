import React from 'react'
import { Player } from '../../lib/api'
import { Lineup, Zone } from '../../lib/rotation'
import { PlayerToken } from './PlayerToken'
import { cn } from '../ui/cn'

interface CourtViewProps {
  lineup: Lineup | null
  players: Player[]
  servingTeam: 'us' | 'them'
  /** Current rotation number (1–6) derived in the parent from live lineup + starting data */
  rotationNumber?: number | null
  /** playerId → role explicitly chosen for this set (e.g. 'Setter', 'OH'). Follows the player across rotations. */
  playerSetRoles?: Record<string, string>
  className?: string
}

// Zone grid for our side
const OUR_ZONES: Zone[][] = [
  ['zone4', 'zone3', 'zone2'],  // front row (closer to net)
  ['zone5', 'zone6', 'zone1'],  // back row (serving side)
]

// Unicode subscript digits for Z notation
const SUB: Record<string, string> = {
  '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
}

export function CourtView({
  lineup,
  players,
  servingTeam,
  rotationNumber,
  playerSetRoles,
  className,
}: CourtViewProps) {
  const playerMap = new Map(players.map(p => [p.id, p]))
  const serverPlayerId = (servingTeam === 'us' && lineup) ? lineup.zone1 : null

  return (
    <div className={cn('w-full flex flex-col select-none', className)}>
      {/* Card fills the outer flex column */}
      <div
        className="flex-1 rounded-xl overflow-hidden border border-outline/10 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #1a1f2e 0%, #1d2022 50%, #1a1f2e 100%)' }}
      >
        {/* ── Net ── */}
        <div className="shrink-0 mx-3 my-1">
          <div className="h-1 rounded-full bg-on-surface-variant/20 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 9px)',
              }}
            />
          </div>
        </div>

        {/* ── Our side — fills remaining card height ── */}
        <div className="flex-1 min-h-0 px-3 pt-1 pb-3 flex flex-col gap-1">

          {/* Front row (zones 4, 3, 2) */}
          <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 items-center">
            {OUR_ZONES[0].map(zone => (
              <ZoneCell
                key={zone}
                zone={zone}
                lineup={lineup}
                playerMap={playerMap}
                serverPlayerId={serverPlayerId}
                playerSetRoles={playerSetRoles}
              />
            ))}
          </div>

          {/* ── Rotation indicator (between rows) ── */}
          <div className="shrink-0 flex items-center justify-center h-5 pointer-events-none">
            {rotationNumber != null && (
              <span
                className="font-display font-black select-none"
                style={{ fontSize: '1.1rem', lineHeight: 1, color: 'rgba(255,120,30,0.22)' }}
              >
                Z{SUB[String(rotationNumber)] ?? rotationNumber}
              </span>
            )}
          </div>

          {/* Back row (zones 5, 6, 1) */}
          <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 items-center">
            {OUR_ZONES[1].map(zone => (
              <ZoneCell
                key={zone}
                zone={zone}
                lineup={lineup}
                playerMap={playerMap}
                serverPlayerId={serverPlayerId}
                playerSetRoles={playerSetRoles}
              />
            ))}
          </div>

          {/* Zone labels */}
          <div className="shrink-0 flex justify-between text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest px-1 pt-1">
            <span>Zone 5</span><span>Zone 6</span><span>Zone 1</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Extracted cell so the render doesn't repeat twice ──────────────────────
function ZoneCell({
  zone, lineup, playerMap, serverPlayerId, playerSetRoles,
}: {
  zone: Zone
  lineup: Lineup | null
  playerMap: Map<string, Player>
  serverPlayerId: string | null
  playerSetRoles?: Record<string, string>
}) {
  const playerId = lineup?.[zone]
  const player   = playerId ? playerMap.get(playerId) : null
  const isServer = playerId === serverPlayerId
  // Use the role explicitly chosen for this player during lineup setup (follows
  // the player across rotations), falling back to their first DB position.
  const position = (playerId && playerSetRoles?.[playerId]) ?? player?.positions[0]

  return (
    <div className="flex justify-center">
      {player ? (
        <PlayerToken
          player={player}
          position={position}
          isServer={isServer}
          className="w-full"
        />
      ) : (
        <div className="w-full min-h-[96px] rounded-lg border border-dashed border-outline/20 flex items-center justify-center">
          <span className="text-[9px] text-on-surface-variant/30 font-bold">
            {zone.replace('zone', 'Z')}
          </span>
        </div>
      )}
    </div>
  )
}
