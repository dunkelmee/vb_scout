// Reusable point-attribution charts. Palette-only (chartTheme.categories) and
// built on recharts / SVG to match the existing design system.
import React, { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ComposedChart, BarChart, LineChart, Area, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts'
import { Target, ChevronsDown, Shield, HandHelping, Gift, CircleAlert, Swords, type LucideIcon } from 'lucide-react'
import { chartTheme } from '../../lib/chartTheme'
import type { PhaseStats, TimelinePoint } from '../../lib/pointStats'

const C = chartTheme.categories

// Skill icon, colour = outcome.
export const CAT_ICON: Record<string, LucideIcon> = {
  ace: Target, kill: ChevronsDown, block: Shield,
  serve: Target, reception: HandHelping, attack: ChevronsDown,
  other: CircleAlert, oppErr: Gift, theirPoint: Swords,
}

type T = (k: string, opts?: Record<string, unknown>) => string
export function catLabel(t: T, cat: string): string {
  if (cat === 'oppErr') return t('subtype.oppErr')
  if (cat === 'theirPoint') return t('liveLog.catTheirPoint')
  return t(`subtype.${cat}`)
}

function rateColor(v: number): string {
  if (v >= 0.6) return C.ace      // turq
  if (v >= 0.45) return C.kill    // bell
  return C.reception              // pink
}

const TOOLTIP_STYLE = {
  background: chartTheme.tooltip.backgroundColor,
  border: '1px solid rgba(47,45,40,0.90)',
  borderRadius: 8,
  fontSize: 11,
}

export interface CatDatum { key: string; value: number }

// ── Legend chip ──────────────────────────────────────────────────────────────
export function LegendChip({ cat, label }: { cat: string; label?: string }) {
  const { t } = useTranslation()
  const Icon = CAT_ICON[cat]
  const color = C[cat] ?? C.other
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-ghost-300">
      {Icon ? <Icon size={11} style={{ color }} /> : <span className="w-2.5 h-[3px] rounded" style={{ background: color }} />}
      {label ?? catLabel(t, cat)}
    </span>
  )
}

// ── Multi-segment donut (point source / error mix) ───────────────────────────
export function MultiDonut({ title, data }: { title?: string; data: CatDatum[] }) {
  const { t } = useTranslation()
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 28, circ = 2 * Math.PI * r, cx = 40, cy = 40
  let acc = 0
  return (
    <div className="card p-4">
      {title && <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-2">{title}</p>}
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="w-[72px] h-[72px] shrink-0">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#252320" strokeWidth="10" />
          {total > 0 && data.map(d => {
            if (d.value <= 0) return null
            const frac = d.value / total
            const rot = -90 + acc * 360
            acc += frac
            return (
              <circle key={d.key} cx={cx} cy={cy} r={r} fill="none"
                stroke={C[d.key] ?? C.other} strokeWidth="10" strokeLinecap="butt"
                strokeDasharray={`${(frac * circ).toFixed(2)} 10000`}
                transform={`rotate(${rot.toFixed(2)} ${cx} ${cy})`} />
            )
          })}
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#F7F7FF" fontSize="19" fontWeight="900" fontFamily="Montserrat, sans-serif">{total}</text>
        </svg>
        <div className="flex-1 min-w-0 space-y-1">
          {data.map(d => {
            const Icon = CAT_ICON[d.key]
            const color = C[d.key] ?? C.other
            return (
              <div key={d.key} className="flex items-center gap-2 text-xs">
                {Icon ? <Icon size={13} style={{ color }} /> : <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
                <span className="text-ghost-300 truncate">{catLabel(t, d.key)}</span>
                <span className="ml-auto font-bold tabular-nums text-ghost-100">{d.value}</span>
                <span className="text-ghost-400 w-8 text-right text-[10px]">{total ? Math.round(d.value / total * 100) : 0}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Horizontal category bars (error mix) ─────────────────────────────────────
export function CatBars({ title, data }: { title?: string; data: CatDatum[] }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="card p-4">
      {title && <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-3">{title}</p>}
      <div className="space-y-2.5">
        {data.map(d => {
          const Icon = CAT_ICON[d.key]
          const color = C[d.key] ?? C.other
          return (
            <div key={d.key}>
              <div className="flex items-center gap-2 text-xs mb-1">
                {Icon && <Icon size={13} style={{ color }} />}
                <span className="text-ghost-300">{catLabel(t, d.key)}</span>
                <span className="ml-auto font-bold text-ghost-100">{d.value}</span>
              </div>
              <div className="h-2 rounded bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.max(3, d.value / max * 100)}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Phase split (sideout / break) with mechanism subline ─────────────────────
export function PhaseSplit({ phase }: { phase: PhaseStats }) {
  const { t } = useTranslation()
  const Tile = ({ labelKey, pct, won, played, line }: {
    labelKey: string; pct: number; won: number; played: number; line: string
  }) => (
    <div className="card p-3 flex-1">
      <div className="text-[10px] text-ghost-300 uppercase tracking-wide font-bold">{t(labelKey)}</div>
      <div className="text-2xl font-black leading-none mt-0.5" style={{ color: rateColor(pct) }}>
        {played > 0 ? `${Math.round(pct * 100)}%` : '–'}
      </div>
      <div className="text-[10px] text-ghost-400 mt-0.5 tabular-nums">{won}/{played}</div>
      <div className="text-[10px] text-ghost-300 mt-1">{line}</div>
    </div>
  )
  return (
    <div className="flex gap-3">
      <Tile labelKey="dashboard.sideoutPct" pct={phase.sideoutPct} won={phase.sideouts} played={phase.receiveRallies}
        line={`${phase.sideoutKills} ${t('subtype.kill')} · ${phase.sideoutReceptErr} ${t('subtype.reception')}`} />
      <Tile labelKey="dashboard.breakPct" pct={phase.breakPct} won={phase.breaks} played={phase.serveRallies}
        line={`${phase.breakAces} ${t('subtype.ace')} · ${phase.breakServeErr} ${t('subtype.serve')}`} />
    </div>
  )
}

// ── Rotation sideout/break matrix ────────────────────────────────────────────
export interface RotRow { rotation: number; wins: number; losses: number; serveRate: number; receiveRate: number }
export function RotationMatrix({ rows }: { rows: RotRow[] }) {
  const { t } = useTranslation()
  const cell = (rate: number, played: boolean) => (
    <span className="font-bold tabular-nums" style={{ color: played ? rateColor(rate) : '#4A4A5A' }}>
      {played ? `${Math.round(rate * 100)}%` : '–'}
    </span>
  )
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ghost-300 mb-3">{t('stats.rotationStats')}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-ghost-400">
            <th className="text-left py-1 font-bold uppercase tracking-wide">{t('stats.rotShort')}</th>
            <th className="text-right py-1 font-bold">{t('dashboard.sideoutPct')}</th>
            <th className="text-right py-1 font-bold">{t('dashboard.breakPct')}</th>
            <th className="text-right py-1 font-bold">{t('stats.win')}/{t('stats.loss')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const played = r.wins + r.losses > 0
            return (
              <tr key={r.rotation} className="border-t border-pitch-400/30">
                <td className="py-2 font-bold text-ghost-300">P{r.rotation}</td>
                <td className="text-right py-2">{cell(r.receiveRate, played)}</td>
                <td className="text-right py-2">{cell(r.serveRate, played)}</td>
                <td className="text-right py-2 tabular-nums">
                  <span className="text-turq-400 font-bold">{r.wins}</span>
                  <span className="text-ghost-400">/</span>
                  <span className="text-bubb-500/80 font-bold">{r.losses}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Annotated scoring timeline ───────────────────────────────────────────────
const HILITE = new Set(['ace', 'block', 'reception', 'serve', 'attack'])
export function AnnotatedTimeline({ data, timeouts = [], height = 150 }: {
  data: TimelinePoint[]
  timeouts?: { id: string; rallyIndex: number; calledBy: string }[]
  height?: number
}) {
  const { t } = useTranslation()
  const chartData = [{ rally: 0, pos: 0, neg: 0 }, ...data]
  const markers = data.filter(d => d.cat && HILITE.has(d.cat))
  return (
    <div className="card p-3">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
          <XAxis dataKey="rally" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => v > 0 ? `+${v}` : `${v}`} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => `${t('postMatch.rally', { defaultValue: 'Rally' })} ${v}`}
            formatter={(value: number, name: string) => [value > 0 ? `+${value}` : `${value}`,
              name === 'pos' ? t('postMatch.leading') : t('postMatch.trailing')]} />
          <ReferenceLine y={0} stroke={chartTheme.gridColor} />
          {timeouts.map(to => (
            <ReferenceLine key={to.id} x={to.rallyIndex + 1}
              stroke={to.calledBy === 'us' ? 'rgba(35,181,211,0.55)' : 'rgba(234,82,111,0.55)'}
              strokeDasharray="4 3" strokeWidth={1.5} />
          ))}
          <Area dataKey="pos" fill={chartTheme.turqFill} stroke={chartTheme.turq} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
          <Area dataKey="neg" fill={chartTheme.pinkFill} stroke={chartTheme.pink} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
          {markers.map((m, i) => {
            const Icon = CAT_ICON[m.cat!]
            const color = C[m.cat!] ?? C.other
            return (
              <ReferenceDot
                key={i}
                x={m.rally}
                y={m.margin}
                isFront
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                shape={((props: { cx?: number; cy?: number }) => {
                  const { cx, cy } = props
                  if (cx == null || cy == null) return <g />
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={8.5} fill="#0F0E0C" stroke={color} strokeWidth={1.2} />
                      {Icon ? <Icon x={cx - 6} y={cy - 6} size={12} strokeWidth={2.4} color={color} /> : <g />}
                    </g>
                  )
                }) as never}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {['ace', 'block', 'reception', 'serve'].map(c => <LegendChip key={c} cat={c} />)}
      </div>
    </div>
  )
}

// ── Stacked bars (point-source / error by set) ───────────────────────────────
export function StackedBySet({ data, keys, height = 160 }: {
  data: Array<Record<string, number | string>>
  keys: string[]
  height?: number
}) {
  return (
    <div className="card p-3">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: chartTheme.tickColor, fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={C[k] ?? C.other}
              radius={i === keys.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{keys.map(k => <LegendChip key={k} cat={k} />)}</div>
    </div>
  )
}

// ── Trend lines (season) ─────────────────────────────────────────────────────
export interface TrendSeries { key: string; color: string; labelKey: string }
export function TrendLines({ data, series, target, height = 150, yDomain, suffix = '%' }: {
  data: Array<Record<string, number | string>>
  series: TrendSeries[]
  target?: number
  height?: number
  yDomain?: [number | 'auto', number | 'auto']
  suffix?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="card p-3">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: chartTheme.tickColor, fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis domain={yDomain ?? ['auto', 'auto']} tick={{ fill: chartTheme.tickColor, fontSize: 9 }}
            tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}${suffix}`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {target != null && (
            <ReferenceLine y={target} stroke={chartTheme.turq} strokeDasharray="4 4" strokeOpacity={0.7} />
          )}
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2}
              dot={{ r: 2.5, fill: s.color }} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {series.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1 text-[10px] text-ghost-300">
            <span className="w-3 h-[3px] rounded" style={{ background: s.color }} />{t(s.labelKey)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
export function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-3">
      <div className="text-[9px] text-ghost-300 uppercase tracking-wide font-bold">{label}</div>
      <div className="text-lg font-black leading-tight mt-0.5" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[9.5px] text-ghost-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Insight card ─────────────────────────────────────────────────────────────
export function InsightCard({ tone, icon, children }: {
  tone: 'good' | 'bad' | 'warn' | 'info'
  icon?: ReactNode
  children: ReactNode
}) {
  const border = tone === 'good' ? C.ace : tone === 'bad' ? C.reception : tone === 'warn' ? C.attack : C.kill
  return (
    <div className="flex gap-2 p-3 rounded-xl bg-surface-high" style={{ borderLeft: `3px solid ${border}` }}>
      {icon && <span style={{ color: border }} className="shrink-0 mt-0.5">{icon}</span>}
      <p className="text-xs text-ghost-200 leading-relaxed">{children}</p>
    </div>
  )
}
