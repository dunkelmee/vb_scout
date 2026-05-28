import React from 'react'
import { cn } from './cn'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'w-full appearance-none bg-surface-high border border-outline/30 rounded-lg px-4 py-3 pr-10 text-on-surface focus:outline-none focus:border-orange/60 transition-colors min-h-[44px]',
            error && 'border-error/60',
            className
          )}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

// Multi-select chip group
interface ChipGroupProps {
  label?: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  maxSelect?: number
}

export function ChipGroup({ label, options, selected, onChange, maxSelect }: ChipGroupProps) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt))
    } else {
      if (maxSelect && selected.length >= maxSelect) return
      onChange([...selected, opt])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border',
              selected.includes(opt)
                ? 'bg-orange text-white border-orange'
                : 'bg-surface-high text-on-surface-variant border-outline/20 hover:border-orange/40'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
