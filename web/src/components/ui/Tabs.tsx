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
                ? 'bg-gradient-to-r from-turq-500 to-bell-500 text-pitch-950 border-turq-500/0 shadow-[0_4px_16px_rgba(35,181,211,0.35)]'
                : 'backdrop-blur-[20px] backdrop-saturate-[180%] bg-pitch-700/60 border-pitch-400/80 text-ghost-300 hover:bg-pitch-600/60 hover:border-pitch-300/60'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex border-b border-pitch-400/40', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors relative',
            activeTab === tab.id ? 'text-turq-500' : 'text-ghost-400 hover:text-ghost-300'
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-turq-500" />
          )}
        </button>
      ))}
    </div>
  )
}
