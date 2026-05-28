import React from 'react'
import { cn } from './cn'

interface ProgressBarProps {
  value: number // 0-1
  color?: 'orange' | 'blue' | 'green' | 'red' | 'amber'
  height?: 'sm' | 'md' | 'lg'
  className?: string
  animated?: boolean
}

export function ProgressBar({ value, color = 'orange', height = 'sm', className, animated = false }: ProgressBarProps) {
  const colors = {
    orange: 'bg-gradient-to-r from-[#ff5c00] to-[#ff8c00]',
    blue: 'bg-gradient-to-r from-[#00e0ff] to-[#0090ff]',
    green: 'bg-green-500',
    red: 'bg-error',
    amber: 'bg-amber-500',
  }

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  const pct = Math.min(100, Math.max(0, value * 100))

  return (
    <div className={cn('w-full rounded-full bg-surface-high overflow-hidden', heights[height], className)}>
      <div
        className={cn(colors[color], heights[height], 'rounded-full transition-all duration-300', animated && 'transition-none animate-pulse-slow')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
