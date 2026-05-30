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
                ? 'bg-orange text-white border-orange shadow-[0_4px_16px_rgba(255,92,0,0.35),inset_0_1px_0_rgba(255,255,255,0.22)]'
                : 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-white/[0.06] border-white/[0.12] text-on-surface-variant shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-white/[0.09] hover:border-white/[0.18]'
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
