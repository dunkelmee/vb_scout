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
  const base = 'inline-flex items-center justify-center font-display font-bold uppercase tracking-wide rounded-full transition-all duration-150 active:scale-95 select-none focus:outline-none focus:ring-2 focus:ring-orange/50'

  const variants = {
    primary: 'bg-gradient-to-r from-[#ff5c00] to-[#ff8c00] text-white shadow-[0_4px_20px_rgba(255,92,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] hover:shadow-[0_6px_28px_rgba(255,92,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] disabled:opacity-50',
    secondary: 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/[0.06] border border-white/[0.14] text-secondary-container shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-white/[0.09] disabled:opacity-50',
    ghost: 'text-on-surface hover:bg-white/[0.06] disabled:opacity-50',
    danger: 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-[rgba(147,0,10,0.55)] border border-red-900/40 text-error shadow-[0_4px_20px_rgba(147,0,10,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-error/25 disabled:opacity-50',
    outline: 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/[0.04] border border-white/[0.14] text-on-surface shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-orange/50 hover:text-orange disabled:opacity-50',
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
