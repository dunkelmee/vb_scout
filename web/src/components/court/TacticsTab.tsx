import React, { useRef, useState } from 'react'
import { Player } from '../../lib/api'
import { Lineup, Zone, ZONE_POSITIONS } from '../../lib/rotation'
import { PlayerAvatar } from '../players/PlayerAvatar'
import { cn } from '../ui/cn'
import { RotateCcw } from 'lucide-react'

// ── Constants shared with PlayerToken ─────────────────────────────────────
const POSITION_ABBREV: Record<string, string> = {
  Setter: 'S', Outside: 'OH', Opposite: 'OPP', Middle: 'MB', Libero: 'L', DS: 'DS',
}
const TEXT_COLOR: Record<string, string> = {
  Setter:   'text-purple-300',
  Outside:  'text-sky-300',
  Opposite: 'text-blue-300',
  Middle:   'text-teal-300',
  Libero:   'text-orange',
  DS:       'text-on-surface-variant',
}
const SUB: Record<string, string> = {
  '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
}

// ── Types ──────────────────────────────────────────────────────────────────
type Pos = { x: number; y: number }

// ── Helpers ────────────────────────────────────────────────────────────────
function initPositions(lineup: Lineup | null): Record<string, Pos> {
  if (!lineup) return {}
  const out: Record<string, Pos> = {}
  for (const [zone, playerId] of Object.entries(lineup) as [Zone, string][]) {
    const zp = ZONE_POSITIONS[zone]
    if (zp) out[playerId] = { x: zp.x, y: zp.y }
  }
  return out
}

// ── Props ──────────────────────────────────────────────────────────────────
interface TacticsTabProps {
  lineup: Lineup | null
  players: Player[]
  playerSetRoles?: Record<string, string>
  servingTeam: 'us' | 'them'
  scoreThem: number
  opponentInitials: string
  rotationNumber?: number | null
}

// ── Main component ─────────────────────────────────────────────────────────
export function TacticsTab({
  lineup,
  players,
  playerSetRoles,
  servingTeam,
  scoreThem,
  opponentInitials,
  rotationNumber,
}: TacticsTabProps) {
  const [positions, setPositions] = useState<Record<string, Pos>>(
    () => initPositions(lineup)
  )
  const courtRef = useRef<HTMLDivElement>(null)

  const playerMap = new Map(players.map(p => [p.id, p]))
  const serverPlayerId = servingTeam === 'us' && lineup ? lineup.zone1 : null

  const onCourtPlayers = lineup
    ? (Object.values(lineup) as string[])
        .map(id => playerMap.get(id))
        .filter((p): p is Player => !!p)
    : []

  return (
    <div className="flex-1 min-h-0 flex flex-col px-3 pt-3">
      {/* Court card */}
      <div
        className="flex-1 min-h-0 rounded-xl overflow-hidden border border-outline/10 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #1a1f2e 0%, #1d2022 50%, #1a1f2e 100%)' }}
      >
        {/* Opponent side */}
        <div className="shrink-0 px-3 pt-3 pb-1">
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="font-display font-black text-3xl text-on-surface/60">{opponentInitials}</span>
            <span className="font-display font-black text-3xl text-on-surface-variant">{scoreThem}</span>
          </div>
          <div className="flex justify-between text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest px-1 mt-1">
            <span>Zone 4</span><span>Zone 3</span><span>Zone 2</span>
          </div>
        </div>

        {/* Net */}
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

        {/* Our side — free-positioning drag area */}
        <div ref={courtRef} className="flex-1 min-h-0 relative">
          {/* Faint rotation indicator */}
          {rotationNumber != null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="font-display font-black select-none"
                style={{ fontSize: '1.6rem', lineHeight: 1, color: 'rgba(255,120,30,0.22)' }}
              >
                Z{SUB[String(rotationNumber)] ?? rotationNumber}
              </span>
            </div>
          )}

          {/* Zone labels — bottom */}
          <div className="absolute bottom-2 inset-x-0 flex justify-around text-[9px] text-on-surface-variant/30 font-bold uppercase tracking-widest pointer-events-none px-4">
            <span>Zone 5</span><span>Zone 6</span><span>Zone 1</span>
          </div>

          {/* Draggable player tokens */}
          {onCourtPlayers.map(player => (
            <DraggableToken
              key={player.id}
              player={player}
              role={playerSetRoles?.[player.id] ?? player.positions[0]}
              pos={positions[player.id] ?? { x: 50, y: 50 }}
              isServer={player.id === serverPlayerId}
              courtRef={courtRef}
              onMove={newPos =>
                setPositions(prev => ({ ...prev, [player.id]: newPos }))
              }
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="shrink-0 py-3">
        <button
          onClick={() => setPositions(initPositions(lineup))}
          className="flex items-center justify-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors w-full py-1"
        >
          <RotateCcw size={12} /> Reset positions
        </button>
      </div>
    </div>
  )
}

// ── Draggable token ────────────────────────────────────────────────────────

function DraggableToken({
  player,
  role,
  pos,
  isServer,
  courtRef,
  onMove,
}: {
  player: Player
  role: string | undefined
  pos: Pos
  isServer: boolean
  courtRef: React.RefObject<HTMLDivElement>
  onMove: (pos: Pos) => void
}) {
  // isDragging is a ref (no re-render) to gate pointermove; active is state for cursor/z-index
  const isDragging = useRef(false)
  const [active, setActive] = useState(false)
  const offset = useRef({ x: 0, y: 0 })

  const abbrev = POSITION_ABBREV[role ?? ''] ?? role?.slice(0, 3).toUpperCase()
  const textColor = TEXT_COLOR[role ?? ''] ?? 'text-on-surface-variant'
  const firstName =
    player.firstName.length > 9 ? player.firstName.slice(0, 8) + '…' : player.firstName

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        cursor: active ? 'grabbing' : 'grab',
        zIndex: active ? 20 : 10,
      }}
      onPointerDown={e => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        const rect = courtRef.current?.getBoundingClientRect()
        if (!rect) return
        offset.current = {
          x: e.clientX - rect.left - (pos.x / 100) * rect.width,
          y: e.clientY - rect.top - (pos.y / 100) * rect.height,
        }
        isDragging.current = true
        setActive(true)
      }}
      onPointerMove={e => {
        if (!isDragging.current) return
        const rect = courtRef.current?.getBoundingClientRect()
        if (!rect) return
        onMove({
          x: Math.max(8, Math.min(92, ((e.clientX - rect.left - offset.current.x) / rect.width) * 100)),
          y: Math.max(8, Math.min(92, ((e.clientY - rect.top - offset.current.y) / rect.height) * 100)),
        })
      }}
      onPointerUp={() => {
        isDragging.current = false
        setActive(false)
      }}
    >
      <div className="flex flex-col items-center gap-0.5 select-none">
        {/* Avatar — orange ring when server */}
        <div className={cn(isServer && 'ring-2 ring-orange rounded-full p-0.5')}>
          <PlayerAvatar player={player} size="md" showJerseyBadge />
        </div>

        {/* Name */}
        <span
          className="text-white text-[10px] font-bold leading-tight text-center"
          style={{ maxWidth: 64 }}
        >
          {firstName}
        </span>

        {/* Position abbreviation */}
        {abbrev && (
          <span className={cn('text-[9px] font-bold uppercase tracking-wide', textColor)}>
            {abbrev}
          </span>
        )}
      </div>
    </div>
  )
}
