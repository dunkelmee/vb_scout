import React from 'react'
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
  const n = matches.length
  const gridCols = `28px repeat(${n}, 1fr)`

  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
        Rotation win rate — heatmap
      </p>
      <p className="text-[9px] text-on-surface-variant/60 mb-3">
        Win rate per rotation per match — last {n} {n === 1 ? 'game' : 'games'}
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
        First half vs second half
      </h3>
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
            Matches 1–{firstCount}
          </p>
          <StatBlock label="Record"     value={`${first.wins}–${first.losses}`}        color="text-secondary-container" />
          <StatBlock label="Sideout %"  value={fmt(first.sideoutPct)}                  color="text-secondary-container" />
          <StatBlock label="Error ratio" value={fmt(first.errorRatio)}                 color="text-bubb-500" />
        </div>
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">
            Matches {firstCount + 1}–{totalCount}
          </p>
          <StatBlock label="Record"     value={`${second.wins}–${second.losses}`}      color={recordUp  ? 'text-turq-400' : 'text-secondary-container'} />
          <StatBlock label="Sideout %"  value={fmt(second.sideoutPct)}                 color={sideoutUp ? 'text-turq-400' : 'text-secondary-container'} />
          <StatBlock label="Error ratio" value={fmt(second.errorRatio)}                color={errorDown ? 'text-turq-400' : 'text-bubb-500'} />
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
          <h1 className="font-display font-bold text-lg text-on-surface">Season performance</h1>
          <p className="text-xs text-on-surface-variant">
            {data.seasonName ?? 'Current season'} · {total} {total === 1 ? 'match' : 'matches'}
          </p>
        </div>
      </div>

      <div className="px-5 space-y-4">

        {/* 1. Three headline tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Record</p>
            <p className="font-display font-black text-xl text-turq-400">
              {data.record.wins}–{data.record.losses}
            </p>
            <p className="text-[10px] text-turq-400 mt-0.5">
              {total > 0 ? `${Math.round(data.record.wins / total * 100)}% wins` : '—'}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Sets ratio</p>
            <p className="font-display font-black text-xl text-secondary-container">{setsRatio}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              {data.setsRecord.wins}W · {data.setsRecord.losses}L
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Pts ratio</p>
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
              Sideout % vs Break %
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">Per match</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} domain={[25, 75]} tickFormatter={v => `${v}%`} />
                <Tooltip {...sharedTooltip} formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Line dataKey="sideout"  name="Sideout %" stroke={chartTheme.turqLight} strokeWidth={2} dot={{ r: 3, fill: chartTheme.turqLight, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                <Line dataKey="breakPct" name="Break %"   stroke={chartTheme.bell}      strokeWidth={2} dot={{ r: 3, fill: chartTheme.bell,      strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turqLight} label="Sideout %" />
              <LegendDot color={chartTheme.bell}      label="Break %" />
            </div>
          </div>
        )}

        {/* 3. Positive play % vs Error ratio % */}
        {chartData.length > 1 && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Positive play % vs Error ratio
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">
              Positive play ↑ good · Error ratio ↓ good
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} tickFormatter={v => `${v}%`} />
                <Tooltip {...sharedTooltip} formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Line dataKey="posPlay"    name="Positive play %" stroke={chartTheme.turq} strokeWidth={2} dot={{ r: 3, fill: chartTheme.turq, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                <Line dataKey="errorRatio" name="Error ratio %"   stroke={chartTheme.pink} strokeWidth={2} dot={{ r: 3, fill: chartTheme.pink, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turq} label="Positive play %" />
              <LegendDot color={chartTheme.pink} label="Error ratio %" />
            </div>
          </div>
        )}

        {/* 4. Points flow */}
        {chartData.length > 0 && (
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Points flow per match
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">Scored vs conceded</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }} barGap={2} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} />
                <Tooltip {...sharedTooltip} />
                <Bar dataKey="pointsUs"   name="Scored"   fill={chartTheme.turq} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pointsThem" name="Conceded" fill={chartTheme.pink} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <LegendDot color={chartTheme.turq} label="Scored" />
              <LegendDot color={chartTheme.pink} label="Conceded" />
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
              Error clustering per match
            </p>
            <p className="text-[9px] text-on-surface-variant/60 mb-3">
              0 = random errors · 1 = systematic bursts under pressure
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} margin={{ top: 6, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} interval={0} />
                <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} {...axisBase} domain={[0, 1]} ticks={[0, 0.2, 0.5, 0.8, 1.0]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...sharedTooltip} formatter={(v: number) => [v.toFixed(2), 'Clustering']} />
                <Bar dataKey="clustering" name="Clustering" radius={[3, 3, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={clusterFill(d.clustering)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-2 text-[9px]">
              <span style={{ color: chartTheme.turqLight }}>■ &lt;0.2 Random</span>
              <span style={{ color: chartTheme.bell }}>■ 0.2–0.5 Mild</span>
              <span style={{ color: chartTheme.pink }}>■ &gt;0.5 Bursts</span>
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
