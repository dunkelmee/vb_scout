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
    primary: 'bg-gradient-to-r from-[#ff5c00] to-[#ff8c00] text-white shadow-[0_4px_16px_rgba(255,92,0,0.3)] hover:shadow-[0_6px_20px_rgba(255,92,0,0.5)] disabled:opacity-50',
    secondary: 'bg-surface-high border border-secondary-container/30 text-secondary-container hover:bg-surface-highest disabled:opacity-50',
    ghost: 'text-on-surface hover:bg-surface-high disabled:opacity-50',
    danger: 'bg-error-container text-error hover:bg-error/20 disabled:opacity-50',
    outline: 'border border-outline/40 text-on-surface hover:border-orange/50 hover:text-orange disabled:opacity-50',
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
