import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  setterPlayerId?: string | null
  teamName?: string
  opponentName?: string
}

export function LiveStatsTab({ rallies, scoreUs, scoreThem, setterPlayerId, teamName, opponentName }: LiveStatsTabProps) {
  const { t } = useTranslation()
  const teamLabel = teamName || t('gameWizard.us')
  const opponentLabel = opponentName || t('gameWizard.opponent')
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
    6,
    setterPlayerId ?? undefined
  )

  const ourPositivePoints  = rallies.filter(r => r.pointType === 'us_positive').length
  const usPointsFromErrors = rallies.filter(r => r.pointType === 'them_error').length
  const theirPositivePoints = rallies.filter(r => r.pointType === 'them_positive').length
  const themPointsFromErrors = rallies.filter(r => r.pointType === 'us_error').length

  return (
    <div className="px-4 pt-4 pb-20 space-y-4">
      {/* Points breakdown donuts */}
      <div className="grid grid-cols-2 gap-3">
        <DonutChart
          teamName={teamLabel}
          ownPoints={ourPositivePoints}
          opponentErrors={usPointsFromErrors}
          variant="us"
        />
        <DonutChart
          teamName={opponentLabel}
          ownPoints={theirPositivePoints}
          opponentErrors={themPointsFromErrors}
          variant="them"
        />
      </div>

      {/* TUS Card */}
      <div className="card p-4">
        <div className="mb-0">
          <p className="text-xs font-bold uppercase tracking-wide text-ghost-300">
            {t('stats.timeoutUrgency')}
            {tusResult.building && <span className="ml-2 font-normal normal-case opacity-60">({t('stats.building')})</span>}
          </p>
        </div>

        <SemiGauge
          value={tusResult.tus}
          color={tusResult.color}
          label={tusResult.label}
          animated={tusResult.tus >= 0.76}
        />

        <button
          onClick={() => setTusExpanded(!tusExpanded)}
          className="flex items-center gap-1 text-xs font-bold uppercase text-ghost-300"
        >
          {t('stats.breakdown')} {tusExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {tusExpanded && (
          <div className="mt-3 space-y-2">
            {[
              { label: `${t('stats.momentum')} (30%)`,      value: tusResult.momentum,    weight: 0.30 },
              { label: `${t('stats.errorRatio')} (25%)`,    value: tusResult.error,       weight: 0.25 },
              { label: `${t('stats.leadDeficit')} (25%)`,   value: tusResult.leadDeficit, weight: 0.25 },
              { label: `${t('stats.positivePlay')} (20%)`,  value: tusResult.positive,    weight: 0.20 },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ghost-300">{label}</span>
                  <span className="text-ghost-100 font-bold">{(value * 100).toFixed(0)}%</span>
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
        <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-3">{t('stats.rotationStats')}</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ghost-400">
              <th className="text-left py-1 font-bold uppercase tracking-wide">{t('stats.rotShort')}</th>
              <th className="text-center py-1 font-bold">{t('stats.win')}</th>
              <th className="text-center py-1 font-bold">{t('stats.loss')}</th>
              <th className="text-right py-1 font-bold">{t('stats.servePct')}</th>
              <th className="text-right py-1 font-bold">{t('stats.receivePct')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.rotationStats.map(rot => (
              <tr key={rot.rotation} className="border-t border-pitch-400/30">
                <td className="py-2 font-bold text-ghost-300">P{rot.rotation}</td>
                <td className="text-center py-2 font-bold text-turq-400">{rot.wins}</td>
                <td className="text-center py-2 font-bold text-bubb-500/70">{rot.losses}</td>
                <td className="text-right py-2 text-ghost-100">
                  {rot.serveRate > 0 ? `${(rot.serveRate * 100).toFixed(0)}%` : '–'}
                </td>
                <td className="text-right py-2 text-ghost-100">
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
          <p className="text-xs font-bold uppercase tracking-wide text-ghost-300">{t('stats.errorRatio')}</p>
          <span className={cn(
            'text-xs font-bold uppercase px-2 py-0.5 rounded-full',
            stats.errorRatioCumulative >= 0.40
              ? 'bg-bubb-500/15 text-bubb-500'
              : stats.errorRatioCumulative >= 0.28
                ? 'bg-bell-500/15 text-bell-400'
                : 'bg-turq-500/15 text-turq-400'
          )}>
            {stats.errorRatioCumulative >= 0.40 ? t('stats.high') : stats.errorRatioCumulative >= 0.28 ? t('stats.mixed') : t('stats.low')}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ghost-300">{t('stats.rolling', { count: Math.min(6, stats.totalRallies) })}</span>
              <span className="font-bold text-ghost-100">{stats.errorRatioRolling.toFixed(2)}</span>
            </div>
            <ProgressBar value={stats.errorRatioRolling} color={stats.errorRatioRolling >= 0.4 ? 'red' : 'orange'} height="sm" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ghost-300">{t('stats.fullMatch')}</span>
              <span className="font-bold text-ghost-100">{stats.errorRatioCumulative.toFixed(2)}</span>
            </div>
            <ProgressBar value={stats.errorRatioCumulative} color={stats.errorRatioCumulative >= 0.4 ? 'red' : 'amber'} height="sm" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ghost-300">{t('stats.clustering')}</span>
              <span className={cn(
                'font-bold',
                stats.clusteringIndex >= 0.5 ? 'text-turq-500' : 'text-ghost-100'
              )}>
                {stats.clusteringIndex === -1 ? 'N/A' : stats.clusteringIndex.toFixed(2)}
              </span>
            </div>
            {stats.clusteringIndex >= 0 && (
              <ProgressBar value={stats.clusteringIndex} color={stats.clusteringIndex >= 0.5 ? 'orange' : 'green'} height="sm" />
            )}
            {stats.clusteringIndex >= 0.5 && (
              <p className="text-xs text-turq-500 mt-1">{stats.clusteringLabel}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
