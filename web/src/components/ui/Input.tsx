import React from 'react'
import { cn } from './cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-bold uppercase tracking-wide text-on-surface-variant"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'bg-surface-high border border-outline/30 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-orange/60 focus:ring-1 focus:ring-orange/30 transition-colors min-h-[44px]',
          error && 'border-error/60 focus:border-error focus:ring-error/30',
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-on-surface-variant">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'bg-surface-high border border-outline/30 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-orange/60 transition-colors resize-none',
          error && 'border-error/60',
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
