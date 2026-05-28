import React from 'react'
import { cn } from './cn'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  variant?: 'pill' | 'underline'
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, variant = 'underline', className }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div className={cn('flex gap-2 overflow-x-auto no-scrollbar pb-1', className)}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all border',
              activeTab === tab.id
                ? 'bg-orange text-white border-orange'
                : 'bg-surface-high text-on-surface-variant border-outline/20 hover:border-orange/40'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex border-b border-outline/20', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors relative',
            activeTab === tab.id
              ? 'text-orange'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-orange" />
          )}
        </button>
      ))}
    </div>
  )
}
