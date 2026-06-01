import React from 'react'
import { Rally } from '../../lib/api'
import { cn } from '../ui/cn'

interface RallyHeatmapProps {
  rallies: Rally[]
  count?: number
}

export function RallyHeatmap({ rallies, count = 15 }: RallyHeatmapProps) {
  const recent = rallies.slice(-count)
  const emptySlots = Math.max(0, count - recent.length)

  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-3">
        Last {count} points
      </p>

      <div
        className="grid gap-1.5 mb-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={`empty-${i}`} className="h-10 rounded-sm bg-pitch-600 opacity-40" />
        ))}

        {recent.map(rally => {
          const isUs = rally.scorer === 'us'
          const isError =
            rally.pointType === 'them_error' || rally.pointType === 'us_error'

          return (
            <div
              key={rally.id}
              className={cn('h-10 rounded-sm flex items-center justify-center')}
              style={{ background: isUs ? '#23B5D3' : '#EA526F' }}
            >
              {isError && (
                <div className="w-2 h-2 rounded-full bg-pitch-950/60" />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-x-3 opacity-60">
        <LegendItem color="#23B5D3" dot={false} label="Our point" />
        <LegendItem color="#EA526F" dot={false} label="Their point" />
        <LegendItem color="#23B5D3" dot label="Their error" />
        <LegendItem color="#EA526F" dot label="Our error" />
      </div>
    </div>
  )
}

function LegendItem({ color, dot, label }: { color: string; dot: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div
        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center"
        style={{ background: color }}
      >
        {dot && <div className="w-1.5 h-1.5 rounded-full bg-pitch-950/60" />}
      </div>
      <span className="text-[10px] text-ghost-300 whitespace-nowrap">{label}</span>
    </div>
  )
}
