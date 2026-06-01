import React from 'react'
import { Player } from '../../lib/api'
import { cn } from '../ui/cn'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface PlayerAvatarProps {
  player: Pick<Player, 'firstName' | 'lastName' | 'jersey' | 'avatarUrl'>
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showJerseyBadge?: boolean
  className?: string
}

const SIZE: Record<string, { outer: string; text: string; badge: string; badgeText: string }> = {
  sm: { outer: 'w-8 h-8',   text: 'text-[10px]', badge: 'w-4 h-4 text-[8px] -bottom-0.5 -right-0.5', badgeText: '' },
  md: { outer: 'w-12 h-12', text: 'text-sm',     badge: 'w-5 h-5 text-[9px]  -bottom-1   -right-1',   badgeText: '' },
  lg: { outer: 'w-16 h-16', text: 'text-base',   badge: 'w-6 h-6 text-[10px] -bottom-1   -right-1',   badgeText: '' },
  xl: { outer: 'w-24 h-24', text: 'text-2xl',    badge: 'w-7 h-7 text-xs     -bottom-1   -right-1',   badgeText: '' },
}

export function PlayerAvatar({
  player,
  size = 'md',
  showJerseyBadge = false,
  className,
}: PlayerAvatarProps) {
  const s = SIZE[size]
  const initials = `${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`.toUpperCase()
  const hasPhoto = !!player.avatarUrl

  const imgSrc = hasPhoto
    ? player.avatarUrl!.startsWith('http')
      ? player.avatarUrl!
      : `${API_BASE}${player.avatarUrl}`
    : null

  return (
    <div className={cn('relative shrink-0 inline-block', className)}>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={`${player.firstName} ${player.lastName}`}
          className={cn('rounded-full object-cover object-center bg-pitch-600', s.outer)}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-pitch-500 flex items-center justify-center font-display font-black text-turq-500',
            s.outer,
            s.text,
          )}
        >
          {initials}
        </div>
      )}

      {/* Jersey number badge — bell-500 */}
      {showJerseyBadge && player.jersey != null && (
        <div
          className={cn(
            'absolute rounded-full bg-bell-500 text-pitch-950 flex items-center justify-center font-display font-black leading-none ring-2 ring-pitch-950',
            s.badge,
          )}
        >
          {player.jersey}
        </div>
      )}
    </div>
  )
}
