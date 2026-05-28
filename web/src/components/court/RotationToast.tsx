import React from 'react'
import { RotateCw } from 'lucide-react'

export function RotationToast() {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-secondary-container/20 border border-secondary-container/30 text-secondary-container font-bold text-sm animate-slide-up shadow-lg">
      <RotateCw size={14} className="animate-spin" />
      ↻ Rotation
    </div>
  )
}
