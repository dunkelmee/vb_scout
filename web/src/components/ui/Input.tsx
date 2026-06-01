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
          className="text-xs font-bold uppercase tracking-wide text-ghost-300"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'bg-pitch-600/60 border border-pitch-400 rounded-lg px-4 py-3 text-ghost-100 placeholder:text-ghost-400 focus:outline-none focus:border-turq-500/50 focus:ring-1 focus:ring-turq-500/25 transition-colors min-h-[44px]',
          error && 'border-bubb-500/60 focus:border-bubb-500 focus:ring-bubb-500/25',
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-ghost-300">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-bubb-500">{error}</p>
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
        <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-wide text-ghost-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'bg-pitch-600/60 border border-pitch-400 rounded-lg px-4 py-3 text-ghost-100 placeholder:text-ghost-400 focus:outline-none focus:border-turq-500/50 transition-colors resize-none',
          error && 'border-bubb-500/60',
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-bubb-500">{error}</p>}
    </div>
  )
}
