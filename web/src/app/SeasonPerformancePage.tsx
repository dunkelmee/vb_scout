import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { seasonPerfApi, SeasonPerformanceData } from '../lib/api'
import { chartTheme } from '../lib/chartTheme'

type MatchRow = SeasonPerformanceData['matches'][number]

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

function matchLabel(m: MatchRow): string {
  return m.opponentInitials || getInitials(m.opponent)
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
      <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function clusterFill(v: number | null | undefined): string {
  if (v == null || v === 0) return 'rgba(255,255,255,0.08)'
  if (v > 0.5) return chartTheme.pink
  if (v > 0.2) return chartTheme.bell
  return chartTheme.turqLight
}

function rotCellStyle(v: number | null): { bg: string; text: string } {
  if (v === null) return { bg: 'rgba(255,255,255,0.04)', text: '#4A4A5A' }
  if (v >= 70) return { bg: 'rgba(35,181,211,0.14)', text: '#4EC8E4' }
  if (v >= 55) return { bg: 'rgba(39,154,241,0.16)', text: '#279AF1' }
  return { bg: 'rgba(234,82,111,0.13)', text: '#EA526F' }
}

const sharedTooltip = {
  contentStyle: {
    background: chartTheme.tooltip.backgroundColor,
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 11,
  },
  labelStyle: { color: chartTheme.tooltip.titleColor },
  itemStyle: { fontSize: 10 },
}

const axisBase = { axisLine: false as const, tickLine: false as const }

// ---- Rotation heatmap ----

function RotationHeatmap({ matches }: { matches: MatchRow[] }) {
  const { t } = useTranslation()
  const n = matches.length
  const gridCols = `28px repeat(${n}, 1fr)`

  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
        {t('seasonPerf.rotationHeatmap')}
      </p>
      <p className="text-[9px] text-on-surface-variant/60 mb-3">
        {t('seasonPerf.rotationHeatmapSub', { count: n })}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 3 }}>
        {/* Header */}
        <div />
        {matches.map((m, i) => (
          <div
            key={i}
            style={{ fontSize: 8, color: '#4A4A5A', textAlign: 'center', padding: '3px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {matchLabel(m)}
          </div>
        ))}
        {/* Rows R1–R6 */}
        {[1, 2, 3, 4, 5, 6].map(rot => (
          <React.Fragment key={rot}>
            <div style={{ fontSize: 9, color: '#8A8A9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              R{rot}
            </div>
            {matches.map((m, mi) => {
              const v = m.rotations.find(r => r.rotation === rot)?.winPct ?? null
              const s = rotCellStyle(v)
              return (
                <div
                  key={mi}
                  style={{ background: s.bg, color: s.text, borderRadius: 4, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600 }}
                >
                  {v !== null ? `${v}%` : '—'}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex gap-3 mt-3 text-[9px] text-on-surface-variant/60">
        <span><span style={{ color: chartTheme.turqLight }}>■</span> ≥70%</span>
        <span><span style={{ color: chartTheme.bell }}>■</span> 55–70%</span>
        <span><span style={{ color: chartTheme.pink }}>■</span> &lt;55%</span>
      </div>
    </div>
  )
}

// ---- Half comparison ----

interface HalfStats {
  wins: number
  losses: number
  sideoutPct: number | null
  errorRatio: number | null
  count: number
}

function computeHalf(ms: MatchRow[]): HalfStats {
  const wins   = ms.filter(m => m.result === 'W').length
  const sos    = ms.map(m => m.sideoutPct)
  const errs   = ms.map(m => m.errorRatio)
  return {
    wins,
    losses: ms.length - wins,
    sideoutPct: sos.length > 0 ? sos.reduce((a, v) => a + v, 0) / sos.length : null,
    errorRatio: errs.length > 0 ? errs.reduce((a, v) => a + v, 0) / errs.length : null,
    count: ms.length,
  }
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3 mb-2 last:mb-0">
      <p className="text-[9px] uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
      <p className={`font-display font-black text-lg ${color}`}>{value}</p>
    </div>
  )
}

function HalfComparison({ first, second, firstCount, totalCount }: {
  first: HalfStats
  second: HalfStats
  firstCount: number
  totalCount: number
}) {
  const { t } = useTranslation()
  const secondCount = totalCount - firstCount
  const firstWinRate  = first.wins  / Math.max(1, firstCount)
  const secondWinRate = second.wins / Math.max(1, secondCount)
  const recordUp  = secondWinRate > firstWinRate
  const sideoutUp = first.sideoutPct !== null && second.sideoutPct !== null && second.sideoutPct > first.sideoutPct
  const errorDown = first.errorRatio !== null  && second.errorRatio !== null  && second.errorRatio  < first.errorRatio

  const fmt = (v: number | null, mul = 100, suffix = '%') =>
    v !== null ? `${Math.round(v * mul)}${suffix}` : '—'

  return (
    <div>
      <h3 className="font-display font-bold text-xs uppercase tracking-widest text-on-surface-variant mb-3">
        {t('seasonPerf.firstHalf')}
      </h3>
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
            {t('seasonPerf.matchesRange', { from: 1, to: firstCount })}
          </p>
          <StatBlock label={t('dashboard.record')}     value={`${first.wins}–${first.losses}`}        color="text-secondary-container" />
          <StatBlock label={t('dashboard.sideoutPct')}  value={fmt(first.sideoutPct)}                  color="text-secondary-container" />
          <StatBlock label={t('stats.errorRatio')} value={fmt(first.errorRatio)}                 color="text-bubb-500" />
        </div>
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
            {t('seasonPerf.matchesRange', { from: firstCount + 1, to: totalCount })}
          </p>
          <StatBlock label={t('dashboard.record')}     value={`${second.wins}–${second.losses}`}      color={recordUp  ? 'text-turq-400' : 'text-secondary-container'} />
          <StatBlock label={t('dashboard.sideoutPct')}  value={fmt(second.sideoutPct)}                 color={sideoutUp ? 'text-turq-400' : 'text-secondary-container'} />
          <StatBlock label={t('stats.errorRatio')} value={fmt(second.errorRatio)}                color={errorDown ? 'text-turq-400' : 'text-bubb-500'} />
        </div>
      </div>
    </div>
  )
}

// ---- Skeleton ----

function Skeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="h-8 bg-surface-high rounded-lg w-48" />
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => <div key={i} className="card h-20" />)}
      </div>
      <div className="card h-52" />
      <div className="card h-48" />
      <div className="card h-48" />
      <div className="card h-40" />
      <div className="card h-36" />
    </div>
  )
}

// ---- Main page ----

export function SeasonPerformancePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<SeasonPerformanceData>({
    queryKey: ['season-performance'],
    queryFn: seasonPerfApi.get,
  })

  if (isLoading || !data) return <Skeleton />

  const all    = data.matches
  const last8  = all.slice(-8)
  const total  = data.matchCount

  const chartData = last8.map(m => ({
    label:      matchLabel(m),
    sideout:    Math.round(m.sideoutPct    * 100),
    breakPct:   Math.round(m.breakPct      * 100),
    posPlay:    Math.round(m.positivePlayPct * 100),
    errorRatio: Math.round(m.errorRatio    * 100),
    pointsUs:   m.pointsUs,
    pointsThem: m.pointsThem,
    clustering: m.errorClustering,
  }))

  const setsRatio = data.setsRecord.losses > 0
    ? (data.setsRecord.wins / data.setsRecord.losses).toFixed(1)
    : '—'
  const ptsRatio = data.pointsThem > 0
    ? (data.pointsUs / data.pointsThem).toFixed(2)
    : '—'

  const firstHalfCount = Math.ceil(total / 2)
  const firstHalf  = computeHalf(all.slice(0, firstHalfCount))
  const secondHalf = computeHalf(all.slice(firstHalfCount))

  const hasCluster = chartData.some(d => d.clustering !== null && d.clustering > 0)

  return (
    <div className="min-h-dvh bg-background pb-10">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-on-surface">{t('dashboard.seasonPerformance')}</h1>
          <p className="text-xs text-on-surface-variant">
            {data.seasonName ?? t('teamSwitcher.currentSeason')} · {t('seasonOverview.trends', { count: total })}
          </p>
        </div>
      </div>

      <div className="px-5 space-y-4">

        {/* 1. Three headline tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('dashboard.record')}</p>
            <p className="font-display font-black text-xl text-turq-400">
              {data.record.wins}–{data.record.losses}
            </p>
            <p className="text-[10px] text-turq-400 mt-0.5">
              {total > 0 ? t('seasonPerf.winsPct', { pct: Math.round(data.record.wins / total * 100) }) : '—'}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('seasonPerf.setsRatio')}</p>
            <p className="font-display font-black text-xl text-secondary-container">{setsRatio}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              {data.setsRecord.wins}{t('stats.win')} · {data.setsRecord.losses}{t('stats.loss')}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('seasonPerf.ptsRatio')}</p>
            <p className="font-display font-black text-xl text-secondary-container">{ptsRatio}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              {data.pointsUs} · {data.pointsThem}
            </p>
          </div>
        </div>

        {/* 2. Sideout % vs Break % */}
        {chartData.length > 1 && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              {t('seasonPerf.sideoutVsBreak')}
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">{t('seasonPerf.perMatch')}</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} domain={[25, 75]} tickFormatter={v => `${v}%`} />
                <Tooltip {...sharedTooltip} formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Line dataKey="sideout"  name={t('seasonPerf.legendSideout')} stroke={chartTheme.turqLight} strokeWidth={2} dot={{ r: 3, fill: chartTheme.turqLight, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                <Line dataKey="breakPct" name={t('seasonPerf.legendBreak')}   stroke={chartTheme.bell}      strokeWidth={2} dot={{ r: 3, fill: chartTheme.bell,      strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turqLight} label={t('seasonPerf.legendSideout')} />
              <LegendDot color={chartTheme.bell}      label={t('seasonPerf.legendBreak')} />
            </div>
          </div>
        )}

        {/* 3. Positive play % vs Error ratio % */}
        {chartData.length > 1 && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              {t('seasonPerf.posVsError')}
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">
              {t('seasonPerf.posErrorHint')}
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} tickFormatter={v => `${v}%`} />
                <Tooltip {...sharedTooltip} formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Line dataKey="posPlay"    name={t('seasonPerf.legendPosPlay')} stroke={chartTheme.turq} strokeWidth={2} dot={{ r: 3, fill: chartTheme.turq, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                <Line dataKey="errorRatio" name={t('seasonPerf.legendErrorRatio')}   stroke={chartTheme.pink} strokeWidth={2} dot={{ r: 3, fill: chartTheme.pink, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turq} label={t('seasonPerf.legendPosPlay')} />
              <LegendDot color={chartTheme.pink} label={t('seasonPerf.legendErrorRatio')} />
            </div>
          </div>
        )}

        {/* 4. Points flow */}
        {chartData.length > 0 && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              {t('seasonPerf.pointsFlow')}
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">{t('seasonPerf.scoredVsConceded')}</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }} barGap={2} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} />
                <Tooltip {...sharedTooltip} />
                <Bar dataKey="pointsUs"   name={t('seasonPerf.scored')}   fill={chartTheme.turq} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pointsThem" name={t('seasonPerf.conceded')} fill={chartTheme.pink} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turq} label={t('seasonPerf.scored')} />
              <LegendDot color={chartTheme.pink} label={t('seasonPerf.conceded')} />
            </div>
          </div>
        )}

        {/* 5. Rotation heatmap */}
        {last8.length > 0 && (
          <RotationHeatmap matches={last8} />
        )}

        {/* 6. Error clustering */}
        {hasCluster && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              {t('seasonPerf.clusteringPerMatch')}
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">
              {t('seasonPerf.clusteringHint')}
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} domain={[0, 1]} ticks={[0, 0.2, 0.5, 0.8, 1.0]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...sharedTooltip} formatter={(v: number) => [v.toFixed(2), t('stats.clustering')]} />
                <Bar dataKey="clustering" name={t('stats.clustering')} radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={clusterFill(d.clustering)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-2 text-[9px]">
              <span style={{ color: chartTheme.turqLight }}>■ &lt;0.2 {t('seasonPerf.clusterRandom')}</span>
              <span style={{ color: chartTheme.bell }}>■ 0.2–0.5 {t('seasonPerf.clusterMild')}</span>
              <span style={{ color: chartTheme.pink }}>■ &gt;0.5 {t('seasonPerf.clusterBursts')}</span>
            </div>
          </div>
        )}

        {/* 7. First half vs second half */}
        {total >= 2 && (
          <HalfComparison
            first={firstHalf}
            second={secondHalf}
            firstCount={firstHalfCount}
            totalCount={total}
          />
        )}

      </div>
    </div>
  )
}
