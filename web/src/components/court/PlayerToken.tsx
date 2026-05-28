import React from 'react'
import { Player } from '../../lib/api'
import { cn } from '../ui/cn'
import { PlayerAvatar } from '../players/PlayerAvatar'

// ── Position abbreviations ─────────────────────────────────────────────────
const POSITION_ABBREV: Record<string, string> = {
  Setter:   'S',
  Outside:  'OH',
  Opposite: 'OPP',
  Middle:   'MB',
  Libero:   'L',
  DS:       'DS',
}

// ── Per-position colour tokens ─────────────────────────────────────────────
const BORDER_BG: Record<string, string> = {
  Setter:   'border-purple-400/70 bg-purple-900/30',
  Outside:  'border-sky-400/70 bg-sky-900/30',
  Opposite: 'border-blue-400/70 bg-blue-900/30',
  Middle:   'border-teal-400/70 bg-teal-900/30',
  Libero:   'border-orange bg-orange/10',
  DS:       'border-surface-bright bg-surface-high',
}
const TEXT_COLOR: Record<string, string> = {
  Setter:   'text-purple-300',
  Outside:  'text-sky-300',
  Opposite: 'text-blue-300',
  Middle:   'text-teal-300',
  Libero:   'text-orange',
  DS:       'text-on-surface-variant',
}

function resolveColors(position: string | undefined) {
  const key = position || ''
  return {
    border: BORDER_BG[key]  ?? 'border-surface-bright bg-surface-high',
    text:   TEXT_COLOR[key] ?? 'text-on-surface-variant',
    abbrev: POSITION_ABBREV[key] ?? (key ? key.slice(0, 3).toUpperCase() : undefined),
  }
}

// ── Shared server dot ──────────────────────────────────────────────────────
function ServerDot() {
  return (
    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange flex items-center justify-center">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="10" strokeWidth="2" stroke="white" fill="none" />
        <path d="M12 2c5.5 0 10 4.5 10 10S17.5 22 12 22" strokeWidth="2" stroke="white" fill="none" />
      </svg>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
interface PlayerTokenProps {
  player: Player
  position?: string   // explicit override; falls back to player.positions[0]
  isServer?: boolean
  compact?: boolean
  className?: string
}

export function PlayerToken({
  player,
  position,
  isServer = false,
  compact = false,
  className,
}: PlayerTokenProps) {
  const pos = position || player.positions[0]
  const { border, text, abbrev } = resolveColors(pos)

  // ── Compact mode (CourtLineupSetup) ────────────────────────────────────
  if (compact) {
    return (
      <div
        className={cn(
          'rounded-lg border flex flex-col items-center justify-center relative px-1 py-1 min-w-[52px] min-h-[44px]',
          border,
          isServer && 'ring-2 ring-orange',
          className,
        )}
      >
        {abbrev && (
          <span className={cn('text-[8px] font-bold uppercase tracking-wide', text)}>{abbrev}</span>
        )}
        <span className="text-white text-[10px] font-bold text-center leading-tight">
          {player.firstName.slice(0, 7)}
        </span>
        <span className={cn('text-[8px] font-black', text)}>#{player.jersey ?? '–'}</span>
        {isServer && <ServerDot />}
      </div>
    )
  }

  // ── Full mode (live log CourtView) ─────────────────────────────────────
  const firstName =
    player.firstName.length > 9
      ? player.firstName.slice(0, 8) + '…'
      : player.firstName

  return (
    <div
      className={cn(
        'rounded-lg border flex flex-col items-center justify-center relative px-2 py-3 gap-1 min-h-[96px]',
        border,
        isServer && 'ring-2 ring-orange',
        className,
      )}
    >
      <PlayerAvatar player={player} size="md" showJerseyBadge />

      <span className="text-white text-[10px] font-bold text-center leading-tight w-full truncate text-center">
        {firstName}
      </span>

      {abbrev && (
        <span className={cn('text-[9px] font-bold uppercase tracking-wide', text)}>
          {abbrev}
        </span>
      )}

      {isServer && <ServerDot />}
    </div>
  )
}
