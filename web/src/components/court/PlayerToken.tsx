import React from 'react'
import { Player } from '../../lib/api'
import { cn } from '../ui/cn'
import { PlayerAvatar } from '../players/PlayerAvatar'

const POSITION_ABBREV: Record<string, string> = {
  Setter:   'S',
  Outside:  'OH',
  Opposite: 'OPP',
  Middle:   'MB',
  Libero:   'L',
  DS:       'DS',
}

// §2.8 position colour system
const BORDER_BG: Record<string, string> = {
  Setter:   'border-bell-500/70  bg-bell-500/10',
  Outside:  'border-turq-500/70  bg-turq-500/10',
  Opposite: 'border-bubb-400/70  bg-bubb-500/10',
  Middle:   'border-bell-400/70  bg-bell-500/10',
  Libero:   'border-bubb-500     bg-bubb-500/10',
  DS:       'border-pitch-300    bg-pitch-600',
}

const TEXT_COLOR: Record<string, string> = {
  Setter:   'text-bell-500',
  Outside:  'text-turq-500',
  Opposite: 'text-bubb-400',
  Middle:   'text-bell-400',
  Libero:   'text-bubb-500',
  DS:       'text-ghost-300',
}

function resolveColors(position: string | undefined) {
  const key = position || ''
  return {
    border: BORDER_BG[key]  ?? 'border-pitch-300 bg-pitch-600',
    text:   TEXT_COLOR[key] ?? 'text-ghost-300',
    abbrev: POSITION_ABBREV[key] ?? (key ? key.slice(0, 3).toUpperCase() : undefined),
  }
}

function ServerDot() {
  return (
    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-turq-500 flex items-center justify-center">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="10" strokeWidth="2" stroke="white" fill="none" />
        <path d="M12 2c5.5 0 10 4.5 10 10S17.5 22 12 22" strokeWidth="2" stroke="white" fill="none" />
      </svg>
    </div>
  )
}

interface PlayerTokenProps {
  player: Player
  position?: string
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

  if (compact) {
    return (
      <div
        className={cn(
          'rounded-lg border flex flex-col items-center justify-center relative px-1 py-1 min-w-[52px] min-h-[44px]',
          border,
          isServer && 'ring-2 ring-turq-500',
          className,
        )}
      >
        {abbrev && (
          <span className={cn('text-[8px] font-bold uppercase tracking-wide', text)}>{abbrev}</span>
        )}
        <span className="text-ghost-100 text-[10px] font-bold text-center leading-tight">
          {player.firstName.slice(0, 7)}
        </span>
        <span className={cn('text-[8px] font-black', text)}>#{player.jersey ?? '–'}</span>
        {isServer && <ServerDot />}
      </div>
    )
  }

  const firstName =
    player.firstName.length > 9
      ? player.firstName.slice(0, 8) + '…'
      : player.firstName

  return (
    <div
      className={cn(
        'rounded-lg border flex flex-col items-center justify-center relative px-2 py-3 gap-1 min-h-[96px]',
        border,
        isServer && 'ring-2 ring-turq-500',
        className,
      )}
    >
      <PlayerAvatar player={player} size="md" showJerseyBadge />

      <span className="text-ghost-100 text-[10px] font-bold text-center leading-tight w-full truncate text-center">
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
