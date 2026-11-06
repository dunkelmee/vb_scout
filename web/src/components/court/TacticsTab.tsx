import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Player } from '../../lib/api'
import { Lineup, Zone, ZONE_POSITIONS } from '../../lib/rotation'
import { PlayerAvatar } from '../players/PlayerAvatar'
import { cn } from '../ui/cn'
import { RotateCcw, Move, Pencil, Undo2, Trash2 } from 'lucide-react'

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
type Stroke = { color: string; points: Pos[] }

// Pen colours for drawing on the board
const PEN_COLORS = ['#FFFFFF', '#FACC15', '#23B5D3', '#F472B6']

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

/**
 * SVG path through the points (in % of the court), smoothed with quadratic
 * curves through the midpoints so finger and stylus lines don't look jagged.
 */
function strokePath(points: Pos[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}` // a dot
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`
  }
  const last = points[points.length - 1]
  return d + ` L ${last.x} ${last.y}`
}

// ── Props ──────────────────────────────────────────────────────────────────
interface TacticsTabProps {
  lineup: Lineup | null
  players: Player[]
  playerSetRoles?: Record<string, string>
  servingTeam: 'us' | 'them'
  rotationNumber?: number | null
}

// ── Main component ─────────────────────────────────────────────────────────
export function TacticsTab({
  lineup,
  players,
  playerSetRoles,
  servingTeam,
  rotationNumber,
}: TacticsTabProps) {
  const [positions, setPositions] = useState<Record<string, Pos>>(
    () => initPositions(lineup)
  )
  const courtRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  // Drawing is temporary: strokes live only while the Tactics tab is open
  const [mode, setMode] = useState<'move' | 'draw'>('move')
  const [color, setColor] = useState(PEN_COLORS[0])
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [current, setCurrent] = useState<Stroke | null>(null)
  // Source of truth for the stroke being drawn (state above is just for rendering)
  const currentRef = useRef<Stroke | null>(null)
  // Only one pointer draws at a time (ignores a resting palm or a second finger)
  const drawingPointer = useRef<number | null>(null)

  const toCourtPos = (clientX: number, clientY: number): Pos | null => {
    const rect = courtRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const updateCurrent = (stroke: Stroke | null) => {
    currentRef.current = stroke
    setCurrent(stroke)
  }

  const finishStroke = () => {
    const stroke = currentRef.current
    if (stroke && stroke.points.length > 0) setStrokes(prev => [...prev, stroke])
    updateCurrent(null)
    drawingPointer.current = null
  }

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

          {/* Drawing layer — above the players; only catches touches in Draw mode */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              zIndex: 30,
              pointerEvents: mode === 'draw' ? 'auto' : 'none',
              touchAction: 'none',
              cursor: mode === 'draw' ? 'crosshair' : undefined,
            }}
            onPointerDown={e => {
              if (mode !== 'draw' || drawingPointer.current !== null) return
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              const p = toCourtPos(e.clientX, e.clientY)
              if (!p) return
              drawingPointer.current = e.pointerId
              updateCurrent({ color, points: [p] })
            }}
            onPointerMove={e => {
              if (e.pointerId !== drawingPointer.current) return
              // Coalesced events give smoother lines for fast pen/finger movement
              const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
              const pts = (events.length ? events : [e.nativeEvent])
                .map(ev => toCourtPos(ev.clientX, ev.clientY))
                .filter((p): p is Pos => !!p)
              const c = currentRef.current
              if (pts.length && c) updateCurrent({ ...c, points: [...c.points, ...pts] })
            }}
            onPointerUp={e => { if (e.pointerId === drawingPointer.current) finishStroke() }}
            onPointerCancel={e => { if (e.pointerId === drawingPointer.current) finishStroke() }}
          >
            {[...strokes, ...(current ? [current] : [])].map((stroke, i) => (
              <path
                key={i}
                d={strokePath(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

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

      {/* Toolbar: Move / Draw toggle + mode-specific tools */}
      <div className="shrink-0 py-3 flex items-center gap-2">
        <div className="flex rounded-full border border-outline/20 p-0.5" role="group">
          {(['move', 'draw'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                mode === m ? 'bg-turq-500/15 text-turq-500' : 'text-on-surface-variant'
              )}
            >
              {m === 'move' ? <Move size={13} /> : <Pencil size={13} />}
              {t(m === 'move' ? 'court.tacticsMove' : 'court.tacticsDraw')}
            </button>
          ))}
        </div>

        {mode === 'draw' ? (
          <div className="flex-1 flex items-center justify-end gap-2">
            {PEN_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={t('court.tacticsColor')}
                aria-pressed={color === c}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  color === c ? 'border-on-surface scale-110' : 'border-transparent'
                )}
                style={{ background: c }}
              />
            ))}
            <button
              onClick={() => setStrokes(prev => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              aria-label={t('court.tacticsUndo')}
              className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant disabled:opacity-30"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              aria-label={t('court.tacticsClear')}
              className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant disabled:opacity-30"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPositions(initPositions(lineup))}
            className="flex-1 flex items-center justify-end gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors py-1"
          >
            <RotateCcw size={12} /> {t('court.tacticsResetPositions')}
          </button>
        )}
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
