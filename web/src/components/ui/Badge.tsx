import React from 'react'
import { cn } from './cn'

export type BadgeVariant =
  | 'orange' | 'blue' | 'green' | 'red' | 'amber' | 'neutral' | 'purple' | 'teal'
  | 'win' | 'loss' | 'warn' | 'info' | 'live'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ label, variant = 'neutral', size = 'sm', className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    // semantic variants
    win:     'bg-turq-500/15  text-turq-500  border border-turq-500/30',
    loss:    'bg-bubb-500/15  text-bubb-400  border border-bubb-500/30',
    warn:    'bg-bell-500/12  text-bell-400  border border-bell-500/25',
    info:    'bg-pitch-500/60 text-ghost-200 border border-pitch-400',
    live:    'bg-turq-500/15  text-turq-500  border border-turq-500/35',
    // legacy names → remapped to new palette
    orange:  'bg-turq-500/15  text-turq-500  border border-turq-500/20',
    blue:    'bg-bell-500/15  text-bell-400  border border-bell-500/20',
    green:   'bg-turq-500/15  text-turq-400  border border-turq-500/20',
    red:     'bg-bubb-500/15  text-bubb-500  border border-bubb-500/20',
    amber:   'bg-bell-400/12  text-bell-400  border border-bell-400/20',
    neutral: 'bg-pitch-500/80 text-ghost-300 border border-pitch-400/60',
    purple:  'bg-bell-500/12  text-bell-500  border border-bell-500/20',
    teal:    'bg-turq-400/12  text-turq-400  border border-turq-400/20',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] font-bold',
    md: 'px-3 py-1 text-xs font-bold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full uppercase tracking-wide font-display',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {label}
    </span>
  )
}

export function PositionBadge({ position }: { position: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    Setter:   'blue',
    Outside:  'teal',
    Opposite: 'red',
    Middle:   'blue',
    Libero:   'loss',
    DS:       'neutral',
  }
  return <Badge label={position} variant={variantMap[position] || 'neutral'} />
}
