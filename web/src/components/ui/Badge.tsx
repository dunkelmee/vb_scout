import React from 'react'
import { cn } from './cn'

export type BadgeVariant = 'orange' | 'blue' | 'green' | 'red' | 'amber' | 'neutral' | 'purple' | 'teal'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ label, variant = 'neutral', size = 'sm', className }: BadgeProps) {
  const variants = {
    orange: 'bg-orange/15 text-orange border border-orange/20',
    blue: 'bg-secondary-container/15 text-secondary-container border border-secondary-container/20',
    green: 'bg-green-500/15 text-green-400 border border-green-500/20',
    red: 'bg-error-container/30 text-error border border-error/20',
    amber: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    neutral: 'bg-surface-high text-on-surface-variant border border-outline/20',
    purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
    teal: 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
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
  const variantMap: Record<string, BadgeProps['variant']> = {
    Setter: 'purple',
    Outside: 'blue',
    Opposite: 'blue',
    Middle: 'teal',
    Libero: 'orange',
    DS: 'neutral',
  }
  return <Badge label={position} variant={variantMap[position] || 'neutral'} />
}
