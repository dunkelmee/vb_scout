import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Rally } from '../../lib/api'
import { computeTUS, DEFAULT_TUS_WEIGHTS } from '../../lib/tus'
import { computeLiveStats } from '../../lib/statistics'
import {
  pointSource, errorMix, phaseStats, scoringTimeline, activeLeak,
} from '../../lib/pointStats'
import { ProgressBar } from '../ui/ProgressBar'
import { SemiGauge } from '../ui/SemiGauge'
import {
  PhaseSplit, MultiDonut, CatBars, AnnotatedTimeline, RotationMatrix, InsightCard, catLabel, CAT_ICON,
} from './pointCharts'
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

export function LiveStatsTab({ rallies, scoreUs, scoreThem, setterPlayerId }: LiveStatsTabProps) {
  const { t } = useTranslation()
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

  const ps = pointSource(rallies)
  const em = errorMix(rallies)
  const phase = phaseStats(rallies)
  const timeline = scoringTimeline(rallies)
  const leak = activeLeak(rallies, 6)
  const LeakIcon = leak.subtype ? CAT_ICON[leak.subtype] : null

  const sourceData = [
    { key: 'kill', value: ps.kill },
    { key: 'oppErr', value: ps.oppErr },
    { key: 'block', value: ps.block },
    { key: 'ace', value: ps.ace },
  ]
  const errorData = [
    { key: 'reception', value: em.reception },
    { key: 'serve', value: em.serve },
    { key: 'attack', value: em.attack },
    { key: 'other', value: em.other },
  ]

  return (
    <div className="px-4 pt-4 pb-20 space-y-4">
      {/* Sideout / break — the headline numbers */}
      <PhaseSplit phase={phase} />

      {/* Active error leak (rolling) */}
      {leak.subtype && leak.count >= 3 && (
        <InsightCard tone="warn" icon={LeakIcon ? <LeakIcon size={16} /> : undefined}>
          {t('stats.activeLeak', { count: leak.count, skill: catLabel(t, leak.subtype) })}
        </InsightCard>
      )}

      {/* How we scored / where we leaked */}
      {ps.total > 0 && <MultiDonut title={t('stats.pointSource')} data={sourceData} />}
      {em.total > 0 && <CatBars title={t('stats.errorMix')} data={errorData} />}

      {/* Live scoring timeline */}
      {timeline.length > 0 && (
        <div>
          <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold mb-2">{t('setSummary.scoreTimeline')}</p>
          <AnnotatedTimeline data={timeline} height={140} />
        </div>
      )}

      {/* TUS Card */}
      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ghost-300">
          {t('stats.timeoutUrgency')}
          {tusResult.building && <span className="ml-2 font-normal normal-case opacity-60">({t('stats.building')})</span>}
        </p>
        <SemiGauge value={tusResult.tus} color={tusResult.color} label={tusResult.label} animated={tusResult.tus >= 0.76} />
        <button onClick={() => setTusExpanded(!tusExpanded)} className="flex items-center gap-1 text-xs font-bold uppercase text-ghost-300">
          {t('stats.breakdown')} {tusExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {tusExpanded && (
          <div className="mt-3 space-y-2">
            {[
              { label: `${t('stats.momentum')} (30%)`, value: tusResult.momentum },
              { label: `${t('stats.errorRatio')} (25%)`, value: tusResult.error },
              { label: `${t('stats.leadDeficit')} (25%)`, value: tusResult.leadDeficit },
              { label: `${t('stats.positivePlay')} (20%)`, value: tusResult.positive },
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

      {/* Rotation sideout/break matrix */}
      <RotationMatrix rows={stats.rotationStats} />

      {/* Error ratio + clustering */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ghost-300">{t('stats.errorRatio')}</p>
          <span className={cn(
            'text-xs font-bold uppercase px-2 py-0.5 rounded-full',
            stats.errorRatioCumulative >= 0.40 ? 'bg-bubb-500/15 text-bubb-500'
              : stats.errorRatioCumulative >= 0.28 ? 'bg-bell-500/15 text-bell-400'
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
              <span className={cn('font-bold', stats.clusteringIndex >= 0.5 ? 'text-turq-500' : 'text-ghost-100')}>
                {stats.clusteringIndex === -1 ? 'N/A' : stats.clusteringIndex.toFixed(2)}
              </span>
            </div>
            {stats.clusteringIndex >= 0 && (
              <ProgressBar value={stats.clusteringIndex} color={stats.clusteringIndex >= 0.5 ? 'orange' : 'green'} height="sm" />
            )}
            {stats.clusteringIndex >= 0.5 && <p className="text-xs text-turq-500 mt-1">{stats.clusteringLabel}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
