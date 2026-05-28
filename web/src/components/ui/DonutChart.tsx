import React from 'react'

interface DonutChartProps {
  teamName: string
  ownPoints: number      // points earned through own positive play
  opponentErrors: number // points gifted by the opponent's errors
  variant: 'us' | 'them'
}

export function DonutChart({ teamName, ownPoints, opponentErrors, variant }: DonutChartProps) {
  const cx = 40, cy = 40, r = 28
  const C = 2 * Math.PI * r  // ~175.9

  const total = ownPoints + opponentErrors
  const f1 = total > 0 ? ownPoints / total : 0
  const f2 = total > 0 ? opponentErrors / total : 0

  const baseColor = variant === 'us' ? '#FF5C00' : '#e0e3e5'

  // Rotation-based segmentation: each segment is a dashed circle rotated to its start position
  const seg1Rot = -90                 // starts at 12 o'clock
  const seg2Rot = -90 + f1 * 360     // starts where segment 1 ends

  return (
    <div className="card p-4 flex flex-col items-center">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2 w-full text-center truncate">
        {teamName}
      </p>

      <svg viewBox="0 0 80 80" className="w-20 h-20">
        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1d2022" strokeWidth="10" />

        {/* Segment 1: own positive points (bright) */}
        {total > 0 && f1 > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={baseColor}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${(f1 * C).toFixed(2)} 10000`}
            strokeDashoffset="0"
            transform={`rotate(${seg1Rot} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )}

        {/* Segment 2: points from opponent errors (dim) */}
        {total > 0 && f2 > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={baseColor}
            strokeOpacity={0.30}
            strokeWidth="10"
            strokeLinecap="butt"
            strokeDasharray={`${(f2 * C).toFixed(2)} 10000`}
            strokeDashoffset="0"
            transform={`rotate(${seg2Rot.toFixed(2)} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.5s ease, transform 0.5s ease' }}
          />
        )}

        {/* Center: total score */}
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={baseColor}
          fontSize="20"
          fontWeight="900"
          fontFamily="Montserrat, sans-serif"
        >
          {total}
        </text>
      </svg>

      {/* Legend */}
      <div className="w-full mt-2 space-y-0.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-on-surface-variant">Own play</span>
          <span className="font-bold" style={{ color: baseColor }}>{ownPoints}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-on-surface-variant">Opp errors</span>
          <span className="font-bold text-on-surface-variant">{opponentErrors}</span>
        </div>
      </div>
    </div>
  )
}
