import React from 'react'
import { cn } from './cn'

interface FABProps {
  onClick: () => void
  icon: React.ReactNode
  label?: string
  className?: string
}

export function FAB({ onClick, icon, label, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-24 right-5 z-40 flex items-center gap-2 bg-gradient-to-r from-[#ff5c00] to-[#ff8c00] text-white rounded-full shadow-[0_4px_20px_rgba(255,92,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all active:scale-95 hover:shadow-[0_6px_28px_rgba(255,92,0,0.6),inset_0_1px_0_rgba(255,255,255,0.22)]',
        label ? 'px-5 py-4' : 'w-14 h-14 justify-center',
        className
      )}
    >
      {icon}
      {label && <span className="font-display font-bold text-sm uppercase tracking-wide">{label}</span>}
    </button>
  )
}
