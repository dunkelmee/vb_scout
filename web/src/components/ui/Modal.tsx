import React, { useEffect } from 'react'
import { cn } from './cn'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={cn(
          'relative w-full sm:max-w-lg bg-surface-container border border-outline/20 rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up z-10',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-headline-md text-on-surface">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-high transition-colors"
            >
              <X size={20} className="text-on-surface-variant" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-high transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

// Bottom sheet variant (always slides from bottom)
export function BottomSheet({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-w-lg bg-surface-container border-t border-outline/20 rounded-t-2xl pt-2 pb-safe z-10 animate-slide-up max-h-[85dvh] overflow-y-auto',
          className
        )}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-outline/40" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-6 mb-5">
            <h2 className="font-display font-bold text-headline-md text-on-surface">{title}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-high">
              <X size={20} className="text-on-surface-variant" />
            </button>
          </div>
        )}
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
