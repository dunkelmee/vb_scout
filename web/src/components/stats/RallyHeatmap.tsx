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
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">
        Last {count} points
      </p>

      {/* Dynamic grid — Tailwind only goes to grid-cols-12, so use inline style */}
      <div
        className="grid gap-1.5 mb-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={`empty-${i}`} className="h-10 rounded-sm bg-surface-high opacity-40" />
        ))}

        {recent.map(rally => {
          const isUs = rally.scorer === 'us'
          const isError =
            rally.pointType === 'them_error' || rally.pointType === 'us_error'

          return (
            <div
              key={rally.id}
              className={cn(
                'h-10 rounded-sm flex items-center justify-center',
                isUs ? 'bg-orange' : 'bg-on-surface'
              )}
            >
              {isError && (
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isUs ? 'bg-white' : 'bg-orange'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend — single row, right-aligned, dimmed */}
      <div className="flex items-center justify-end gap-x-3 opacity-50">
        <LegendItem bg="orange" label="Our point" />
        <LegendItem bg="white" label="Their point" />
        <LegendItem bg="orange" dot="white" label="Their error" />
        <LegendItem bg="white" dot="orange" label="Our error" />
      </div>
    </div>
  )
}

function LegendItem({
  bg,
  dot,
  label,
}: {
  bg: 'orange' | 'white'
  dot?: 'orange' | 'white'
  label: string
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div
        className={cn(
          'w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center',
          bg === 'orange' ? 'bg-orange' : 'bg-on-surface'
        )}
      >
        {dot && (
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              dot === 'white' ? 'bg-white' : 'bg-orange'
            )}
          />
        )}
      </div>
      <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{label}</span>
    </div>
  )
}
