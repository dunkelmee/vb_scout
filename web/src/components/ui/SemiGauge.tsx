import React from 'react'
import type { TUSColor } from '../../lib/tus'

const STROKE: Record<TUSColor, string> = {
  green: '#4ade80',
  amber: '#fbbf24',
  orange: '#FF5C00',
  red: '#f87171',
}

const ZONES: [number, number, TUSColor][] = [
  [0, 0.30, 'green'],
  [0.30, 0.55, 'amber'],
  [0.55, 0.75, 'orange'],
  [0.75, 1.0, 'red'],
]

interface SemiGaugeProps {
  value: number
  color: TUSColor
  label: string
  animated?: boolean
}

export function SemiGauge({ value, color, label, animated = false }: SemiGaugeProps) {
  // Semicircle: center (100, 115), radius 80, clockwise via top (sweep-flag=1)
  const cx = 100, cy = 115, r = 80
  const C = Math.PI * r  // ~251.33

  function pt(t: number, radius = r): [number, number] {
    const a = Math.PI + t * Math.PI
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
  }

  function zonePath(t1: number, t2: number): string {
    const [sx, sy] = pt(t1)
    const [ex, ey] = pt(t2)
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`
  }

  const v = Math.min(1, Math.max(0, value))
  const dashoffset = C * (1 - v)
  const stroke = STROKE[color]

  return (
    <div className="flex justify-center">
      {/* viewBox trims the blank space above the arc (arc top ~y=28, give 8px buffer → start at y=20) */}
      <svg viewBox="0 20 200 112" className="w-full max-w-[220px]">
        {/* Colored zone backgrounds — same strokeWidth as fill so endpoints align flush */}
        {ZONES.map(([t1, t2, zc]) => (
          <path
            key={t1}
            d={zonePath(t1, t2)}
            fill="none"
            stroke={STROKE[zc]}
            strokeWidth={14}
            strokeOpacity={0.20}
            strokeLinecap="butt"
          />
        ))}

        {/* Active fill arc — butt linecap so both ends are flush with the track */}
        <path
          d="M 20 115 A 80 80 0 0 1 180 115"
          fill="none"
          stroke={stroke}
          strokeWidth={14}
          strokeLinecap="butt"
          strokeDasharray={C.toFixed(1)}
          strokeDashoffset={dashoffset.toFixed(1)}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease' }}
          className={animated ? 'animate-pulse-slow' : undefined}
        />

        {/* Value */}
        <text
          x="100"
          y="84"
          textAnchor="middle"
          fill={stroke}
          fontSize="30"
          fontWeight="900"
          fontFamily="Montserrat, sans-serif"
          style={{ transition: 'fill 0.4s ease' }}
        >
          {value.toFixed(2)}
        </text>

        {/* Label */}
        <text
          x="100"
          y="103"
          textAnchor="middle"
          fill={stroke}
          fontSize="9.5"
          fontWeight="700"
          fontFamily="Montserrat, sans-serif"
          opacity="0.80"
          style={{ transition: 'fill 0.4s ease' }}
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}
