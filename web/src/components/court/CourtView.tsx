import React from 'react'
import { Player } from '../../lib/api'
import { Lineup, Zone } from '../../lib/rotation'
import { PlayerToken } from './PlayerToken'
import { PlayerAvatar } from '../players/PlayerAvatar'
import { cn } from '../ui/cn'

interface CourtViewProps {
  lineup: Lineup | null
  players: Player[]
  servingTeam: 'us' | 'them'
  rotationNumber?: number | null
  playerSetRoles?: Record<string, string>
  className?: string
}

const OUR_ZONES: Zone[][] = [
  ['zone4', 'zone3', 'zone2'],
  ['zone5', 'zone6', 'zone1'],
]

const SUB: Record<string, string> = {
  '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
}

const POSITION_ABBREV: Record<string, string> = {
  Setter: 'S', Outside: 'OH', Opposite: 'OPP', Middle: 'MB', Libero: 'L', DS: 'DS',
}
const TEXT_COLOR: Record<string, string> = {
  Setter: 'text-bell-500', Outside: 'text-turq-500', Opposite: 'text-bubb-400',
  Middle: 'text-bell-400', Libero: 'text-bubb-500', DS: 'text-ghost-300',
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
      <div
        className="flex-1 rounded-xl overflow-hidden border border-pitch-400/30 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0F0E0C 0%, #161412 50%, #0F0E0C 100%)' }}
      >
        {/* Net */}
        <div className="shrink-0 mx-3 my-1">
          <div
            className="h-1 rounded-full relative overflow-hidden"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(35,181,211,0.50), transparent)' }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.2) 8px, rgba(255,255,255,0.2) 9px)',
              }}
            />
          </div>
        </div>

        {/* Our side */}
        <div className="flex-1 min-h-0 px-3 pt-1 pb-3 flex flex-col gap-1">
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

          {/* Rotation indicator */}
          <div className="shrink-0 flex items-center justify-center h-5 pointer-events-none">
            {rotationNumber != null && (
              <span
                className="font-display font-black select-none"
                style={{ fontSize: '1.1rem', lineHeight: 1, color: 'rgba(35,181,211,0.22)' }}
              >
                Z{SUB[String(rotationNumber)] ?? rotationNumber}
              </span>
            )}
          </div>

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

          <div className="shrink-0 flex justify-between text-[9px] text-ghost-400/50 font-bold uppercase tracking-widest px-1 pt-1">
            <span>Zone 5</span><span>Zone 6</span><span>Zone 1</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const isServer = !!playerId && playerId === serverPlayerId

  if (!player) {
    return <div />
  }

  const position = (playerSetRoles?.[player.id]) ?? player.positions[0]

  // The serving player keeps the bordered square (shown only while we serve).
  if (isServer) {
    return (
      <div className="flex justify-center">
        <PlayerToken player={player} position={position} isServer className="w-full" />
      </div>
    )
  }

  // Every other player: borderless token (tactic-board style — no container).
  const abbrev = POSITION_ABBREV[position ?? ''] ?? position?.slice(0, 3).toUpperCase()
  const textColor = TEXT_COLOR[position ?? ''] ?? 'text-ghost-300'
  const firstName = player.firstName.length > 9 ? player.firstName.slice(0, 8) + '…' : player.firstName

  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center gap-0.5 select-none">
        <PlayerAvatar player={player} size="md" showJerseyBadge />
        <span className="text-ghost-100 text-[10px] font-bold leading-tight text-center" style={{ maxWidth: 64 }}>
          {firstName}
        </span>
        {abbrev && (
          <span className={cn('text-[9px] font-bold uppercase tracking-wide', textColor)}>{abbrev}</span>
        )}
      </div>
    </div>
  )
}
