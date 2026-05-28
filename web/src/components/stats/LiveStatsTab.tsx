import React, { useState } from 'react'
import { Rally } from '../../lib/api'
import { computeTUS, DEFAULT_TUS_WEIGHTS } from '../../lib/tus'
import { computeLiveStats } from '../../lib/statistics'
import { ProgressBar } from '../ui/ProgressBar'
import { SemiGauge } from '../ui/SemiGauge'
import { DonutChart } from '../ui/DonutChart'
import { RallyHeatmap } from './RallyHeatmap'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../ui/cn'

interface LiveStatsTabProps {
  rallies: Rally[]
  scoreUs: number
  scoreThem: number
  /** Player ID of the setter — used to correctly attribute rallies to rotations */
  setterPlayerId?: string | null
  teamName?: string
  opponentName?: string
}

export function LiveStatsTab({ rallies, scoreUs, scoreThem, setterPlayerId, teamName = 'Us', opponentName = 'Opponent' }: LiveStatsTabProps) {
  const [tusExpanded, setTusExpanded] = useState(false)

  const TUS_WINDOW = 6
  const rallyWindow = rallies.slice(-TUS_WINDOW)

  const tusRallies = rallyWindow.map(r => ({
    scorer: r.scorer as 'us' | 'them',
    pointType: r.pointType,
    scoreUs: r.scoreUs,
    scoreThem: r.scoreThem,
  }))

  const tusResult = computeTUS(tusRallies, scoreUs, scoreThem, DEFAULT_TUS_WEIGHTS)
  const stats = computeLiveStats(
    rallies.map(r => ({
      scorer: r.scorer as 'us' | 'them',
      pointType: r.pointType,
      scoreUs: r.scoreUs,
      scoreThem: r.scoreThem,
      servingTeam: r.servingTeam as 'us' | 'them',
      rotationAfter: r.rotationAfter as Record<string, string>,
      rotated: r.rotated,
      rallyIndex: r.rallyIndex,
    })),
    6,                          // rolling window
    setterPlayerId ?? undefined // setter player ID for correct rotation attribution
  )

  // Point breakdown: own positive play vs gifted from opponent errors
  const ourPositivePoints = rallies.filter(r => r.pointType === 'us_positive').length
  const usPointsFromErrors = rallies.filter(r => r.pointType === 'them_error').length
  const theirPositivePoints = rallies.filter(r => r.pointType === 'them_positive').length
  const themPointsFromErrors = rallies.filter(r => r.pointType === 'us_error').length

  return (
    <div className="px-4 pt-4 pb-20 space-y-4">
      {/* Points breakdown donuts */}
      <div className="grid grid-cols-2 gap-3">
        <DonutChart
          teamName={teamName}
          ownPoints={ourPositivePoints}
          opponentErrors={usPointsFromErrors}
          variant="us"
        />
        <DonutChart
          teamName={opponentName}
          ownPoints={theirPositivePoints}
          opponentErrors={themPointsFromErrors}
          variant="them"
        />
      </div>

      {/* TUS Card */}
      <div className="card p-4">
        <div className="mb-0">
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Timeout Urgency
            {tusResult.building && <span className="ml-2 font-normal normal-case opacity-60">(building…)</span>}
          </p>
        </div>

        <SemiGauge
          value={tusResult.tus}
          color={tusResult.color}
          label={tusResult.label}
          animated={tusResult.tus >= 0.76}
        />

        {/* Breakdown toggle */}
        <button
          onClick={() => setTusExpanded(!tusExpanded)}
          className="flex items-center gap-1 text-xs font-bold uppercase text-on-surface-variant"
        >
          Breakdown {tusExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {tusExpanded && (
          <div className="mt-3 space-y-2">
            {[
              { label: 'Momentum (30%)', value: tusResult.momentum, weight: 0.30 },
              { label: 'Error ratio (25%)', value: tusResult.error, weight: 0.25 },
              { label: 'Lead/deficit (25%)', value: tusResult.leadDeficit, weight: 0.25 },
              { label: 'Positive play (20%)', value: tusResult.positive, weight: 0.20 },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="text-on-surface font-bold">{(value * 100).toFixed(0)}%</span>
                </div>
                <ProgressBar value={value} color="orange" height="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rally heatmap */}
      <RallyHeatmap rallies={rallies} count={15} />

      {/* Rotation stats */}
      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Rotation Statistics</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-on-surface-variant">
              <th className="text-left py-1 font-bold uppercase tracking-wide">Rot</th>
              <th className="text-center py-1 font-bold">W</th>
              <th className="text-center py-1 font-bold">L</th>
              <th className="text-right py-1 font-bold">Srv%</th>
              <th className="text-right py-1 font-bold">Rcv%</th>
            </tr>
          </thead>
          <tbody>
            {stats.rotationStats.map(rot => (
              <tr key={rot.rotation} className="border-t border-outline/10">
                <td className="py-2 font-bold text-on-surface-variant">P{rot.rotation}</td>
                <td className="text-center py-2 font-bold text-green-400">{rot.wins}</td>
                <td className="text-center py-2 font-bold text-error/70">{rot.losses}</td>
                <td className="text-right py-2 text-on-surface">
                  {rot.serveRate > 0 ? `${(rot.serveRate * 100).toFixed(0)}%` : '–'}
                </td>
                <td className="text-right py-2 text-on-surface">
                  {rot.receiveRate > 0 ? `${(rot.receiveRate * 100).toFixed(0)}%` : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error ratio */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Error Ratio</p>
          <span className={cn(
            'text-xs font-bold uppercase px-2 py-0.5 rounded-full',
            stats.errorRatioCumulative >= 0.40 ? 'bg-error/15 text-error' :
            stats.errorRatioCumulative >= 0.28 ? 'bg-amber-500/15 text-amber-400' :
            'bg-green-500/15 text-green-400'
          )}>
            {stats.errorRatioCumulative >= 0.40 ? 'High' : stats.errorRatioCumulative >= 0.28 ? 'Mixed' : 'Low'}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant">Rolling {Math.min(6, stats.totalRallies)}</span>
              <span className="font-bold text-on-surface">{stats.errorRatioRolling.toFixed(2)}</span>
            </div>
            <ProgressBar value={stats.errorRatioRolling} color={stats.errorRatioRolling >= 0.4 ? 'red' : 'orange'} height="sm" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant">Full match</span>
              <span className="font-bold text-on-surface">{stats.errorRatioCumulative.toFixed(2)}</span>
            </div>
            <ProgressBar value={stats.errorRatioCumulative} color={stats.errorRatioCumulative >= 0.4 ? 'red' : 'amber'} height="sm" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant">Error clustering</span>
              <span className={cn(
                'font-bold',
                stats.clusteringIndex >= 0.5 ? 'text-orange' : 'text-on-surface'
              )}>
                {stats.clusteringIndex === -1 ? 'N/A' : stats.clusteringIndex.toFixed(2)}
              </span>
            </div>
            {stats.clusteringIndex >= 0 && (
              <ProgressBar value={stats.clusteringIndex} color={stats.clusteringIndex >= 0.5 ? 'orange' : 'green'} height="sm" />
            )}
            {stats.clusteringIndex >= 0.5 && (
              <p className="text-xs text-orange mt-1">{stats.clusteringLabel}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
