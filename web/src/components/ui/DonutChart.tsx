import React from 'react'

interface DonutChartProps {
  teamName: string
  ownPoints: number
  opponentErrors: number
  variant: 'us' | 'them'
}

export function DonutChart({ teamName, ownPoints, opponentErrors, variant }: DonutChartProps) {
  const cx = 40, cy = 40, r = 28
  const C = 2 * Math.PI * r

  const total = ownPoints + opponentErrors
  const f1 = total > 0 ? ownPoints / total : 0
  const f2 = total > 0 ? opponentErrors / total : 0

  // us = turq-500, them = bubb-500
  const baseColor = variant === 'us' ? '#23B5D3' : '#EA526F'

  const seg1Rot = -90
  const seg2Rot = -90 + f1 * 360

  return (
    <div className="card p-4 flex flex-col items-center">
      <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-2 w-full text-center truncate">
        {teamName}
      </p>

      <svg viewBox="0 0 80 80" className="w-20 h-20">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#252320" strokeWidth="10" />

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

      <div className="w-full mt-2 space-y-0.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-ghost-300">Own play</span>
          <span className="font-bold" style={{ color: baseColor }}>{ownPoints}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-ghost-300">Opp errors</span>
          <span className="font-bold text-ghost-400">{opponentErrors}</span>
        </div>
      </div>
    </div>
  )
}
