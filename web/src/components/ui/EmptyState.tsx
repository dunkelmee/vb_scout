import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

export interface EmptyStateFeature {
  icon: LucideIcon
  title: string
  desc: string
}

export interface EmptyStateAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  features?: EmptyStateFeature[]
  actions?: EmptyStateAction[]
  /** Optional supplementary notice rendered below the actions (e.g. "no season yet"). */
  notice?: React.ReactNode
  className?: string
}

/**
 * Shared first-run empty state for the population tabs (Games, Trainings,
 * Players). Renders a hero icon + headline + value prop, an optional feature
 * card explaining the payoff, and one or more CTAs.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  features,
  actions,
  notice,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('px-1 pb-6', className)}>
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-2.5 pt-7 pb-1">
        <div
          className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center border border-turq-500/25"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(35,181,211,0.18), rgba(35,181,211,0.04))' }}
        >
          <Icon size={32} className="text-turq-500" />
        </div>
        <h2 className="font-display font-bold text-xl text-on-surface">{title}</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed max-w-[300px]">{description}</p>
      </div>

      {/* Feature card */}
      {features && features.length > 0 && (
        <div className="card p-2 mt-3.5">
          {features.map(({ icon: FIcon, title: ftitle, desc }) => (
            <div key={ftitle} className="flex items-start gap-3 px-2 py-2.5">
              <FIcon size={17} className="text-turq-500 shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-on-surface-variant leading-snug">
                <span className="font-bold text-on-surface">{ftitle}</span> — {desc}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-4">
          {actions.map(({ label, icon: AIcon, onClick, variant = 'primary' }) => (
            <button
              key={label}
              onClick={onClick}
              className={cn(
                'w-full py-3.5 rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform',
                variant === 'primary'
                  ? 'text-pitch-950 bg-gradient-to-r from-turq-500 to-bell-500 shadow-[0_4px_22px_rgba(35,181,211,0.28)]'
                  : 'text-turq-500 border border-turq-500/30',
              )}
            >
              {AIcon && <AIcon size={16} className={variant === 'primary' ? 'text-pitch-950' : 'text-turq-500'} />}
              {label}
            </button>
          ))}
        </div>
      )}

      {notice}
    </div>
  )
}
