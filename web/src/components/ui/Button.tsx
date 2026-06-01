import React from 'react'
import { cn } from './cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-display font-bold uppercase tracking-wide rounded-full transition-all duration-150 active:scale-95 select-none focus:outline-none focus:ring-2 focus:ring-turq-500/50'

  const variants = {
    primary:   'bg-gradient-to-r from-turq-500 to-bell-500 text-pitch-950 shadow-[0_4px_20px_rgba(35,181,211,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_6px_28px_rgba(35,181,211,0.50),inset_0_1px_0_rgba(255,255,255,0.18)] disabled:opacity-50',
    secondary: 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-pitch-700/60 border border-pitch-400/90 text-ghost-300 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-pitch-600/60 disabled:opacity-50',
    ghost:     'text-ghost-200 hover:bg-pitch-600/40 disabled:opacity-50',
    danger:    'backdrop-blur-[20px] backdrop-saturate-[180%] bg-bubb-700/50 border border-bubb-500/40 text-bubb-400 shadow-[0_4px_20px_rgba(168,40,72,0.30),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-bubb-500/25 disabled:opacity-50',
    outline:   'backdrop-blur-[20px] backdrop-saturate-[180%] bg-pitch-700/40 border border-pitch-400/90 text-ghost-200 shadow-[0_4px_16px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-turq-500/50 hover:text-turq-500 disabled:opacity-50',
  }

  const sizes = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-12 px-6 text-sm',
    lg: 'h-14 px-8 text-base',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  )
}
