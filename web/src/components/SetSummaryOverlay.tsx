import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Area, ReferenceLine,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from 'recharts'
import { X, BarChart2 } from 'lucide-react'
import { Rally, GameSet, setsApi } from '../lib/api'
import { computeLiveStats } from '../lib/statistics'
import { DonutChart } from './ui/DonutChart'
import { Button } from './ui/Button'
import { cn } from './ui/cn'
import { chartTheme } from '../lib/chartTheme'

interface SetSummaryOverlayProps {
  matchId: string
  setNumber: number
  scoreUs: number
  scoreThem: number
  rallies: Rally[]
  setterPlayerId: string | null
  teamName: string
  teamInitials: string
  opponentName: string
  sets: GameSet[]
  onSetupNextSet: () => void
  onViewStats: () => void
}

// §2.2 KPI colour: turq-500 = on target, bell-500 = watch, bubb-500 = poor
function statColor(value: number, higherIsBetter: boolean): string {
  const v = higherIsBetter ? value : 1 - value
  if (v >= 0.60) return '#23B5D3'  // turq-500
  if (v >= 0.40) return '#279AF1'  // bell-500
  return '#EA526F'                  // bubb-500
}

// §2.4 Rotation grid colours
function rotationColor(winRate: number): { bg: string; text: string } {
  if (winRate >= 0.70) return { bg: 'rgba(35,181,211,0.22)',  text: '#23B5D3' }
  if (winRate >= 0.55) return { bg: 'rgba(39,154,241,0.15)',  text: '#5BB4F5' }
  if (winRate >= 0.40) return { bg: 'rgba(234,82,111,0.12)',  text: '#F07A90' }
  return                           { bg: 'rgba(234,82,111,0.22)',  text: '#EA526F' }
}

function StatTile({
  label,
  value,
  prevValue,
  higherIsBetter = true,
}: {
  label: string
  value: number
  prevValue?: number | null
  higherIsBetter?: boolean
}) {
  const color = statColor(value, higherIsBetter)
  const pct = `${(value * 100).toFixed(0)}%`

  let delta: React.ReactNode = null
  if (prevValue != null && Math.abs(value - prevValue) >= 0.005) {
    const improved = higherIsBetter ? value > prevValue : value < prevValue
    const arrow = value > prevValue ? '↑' : '↓'
    delta = (
      <span className={cn('text-[10px] font-bold', improved ? 'text-turq-400' : 'text-bubb-500')}>
        vs {(prevValue * 100).toFixed(0)}% last {arrow}
      </span>
    )
  }

  return (
    <div className="card p-3">
      <div className="text-[10px] text-ghost-300 uppercase tracking-wide font-bold mb-1">{label}</div>
      <div className="text-xl font-bold leading-none" style={{ color }}>{pct}</div>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  )
}

export function SetSummaryOverlay({
  matchId,
  setNumber,
  scoreUs,
  scoreThem,
  rallies,
  setterPlayerId,
  teamName,
  teamInitials,
  opponentName,
  sets,
  onSetupNextSet,
  onViewStats,
}: SetSummaryOverlayProps) {
  const won = scoreUs > scoreThem

  const previousSet = sets.find(s => s.setNumber === setNumber - 1 && s.status === 'completed')

  const { data: prevSetData } = useQuery({
    queryKey: ['set', previousSet?.id],
    queryFn: () => setsApi.get(matchId, previousSet!.id),
    enabled: !!previousSet,
  })

  const stats = useMemo(() => computeLiveStats(
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
  ), [rallies, setterPlayerId])

  const prevStats = useMemo(() => {
    if (!prevSetData?.rallies?.length) return null
    return computeLiveStats(
      prevSetData.rallies.map(r => ({
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
  }, [prevSetData, setterPlayerId])

  const chartData = useMemo(() => {
    const pts: { rally: number; pos: number; neg: number }[] = [
      { rally: 0, pos: 0, neg: 0 },
    ]
    rallies.forEach(r => {
      const diff = r.scoreUs - r.scoreThem
      pts.push({ rally: r.rallyIndex + 1, pos: Math.max(0, diff), neg: Math.min(0, diff) })
    })
    return pts
  }, [rallies])

  const ourPos   = rallies.filter(r => r.pointType === 'us_positive').length
  const ourErr   = rallies.filter(r => r.pointType === 'them_error').length
  const themPos  = rallies.filter(r => r.pointType === 'them_positive').length
  const themErr  = rallies.filter(r => r.pointType === 'us_error').length

  const completed   = sets.filter(s => s.status === 'completed')
  const setsWonUs   = completed.filter(s => s.scoreUs > s.scoreThem).length + (scoreUs > scoreThem ? 1 : 0)
  const setsWonThem = completed.filter(s => s.scoreThem > s.scoreUs).length  + (scoreThem > scoreUs ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 bg-pitch-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-pitch-400/40 shrink-0">
        <button
          onClick={onSetupNextSet}
          className="p-2 -ml-2 rounded-full hover:bg-pitch-600/40 transition-colors"
        >
          <X size={18} className="text-ghost-100" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-ghost-300">Set {setNumber}</p>
          <h1 className="font-display font-bold text-base text-ghost-100 leading-tight">Set summary</h1>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">

        {/* Score hero */}
        <div className="card p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(35,181,211,0.10)_0%,transparent_70%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <p className="text-[11px] text-ghost-300 uppercase tracking-wide mb-1">{teamName}</p>
                <p
                  className="font-display font-black leading-none"
                  style={{ fontSize: '3rem', color: won ? '#23B5D3' : '#4A4A5A' }}
                >
                  {scoreUs}
                </p>
              </div>
              <span className="text-2xl font-light text-ghost-400/40">–</span>
              <div className="flex-1 text-center">
                <p className="text-[11px] text-ghost-300 uppercase tracking-wide mb-1">{opponentName}</p>
                <p
                  className="font-display font-black leading-none"
                  style={{ fontSize: '3rem', color: won ? '#4A4A5A' : '#EA526F' }}
                >
                  {scoreThem}
                </p>
              </div>
            </div>

            {/* Win/loss badge */}
            <div className="flex justify-center mt-3">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={
                  won
                    ? { background: 'rgba(35,181,211,0.18)',  color: '#23B5D3' }
                    : { background: 'rgba(234,82,111,0.18)',  color: '#EA526F' }
                }
              >
                {won ? '✓ Set won' : '✗ Set lost'}
              </span>
            </div>

            {/* Set pips */}
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: 5 }, (_, i) => {
                const n = i + 1
                const isCurrent = n === setNumber
                let usWon = false
                let themWon = false
                if (isCurrent) {
                  usWon = scoreUs > scoreThem
                  themWon = scoreThem > scoreUs
                } else {
                  const s = sets.find(s => s.setNumber === n)
                  if (s) { usWon = s.scoreUs > s.scoreThem; themWon = s.scoreThem > s.scoreUs }
                }
                return (
                  <div
                    key={n}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                      isCurrent && 'ring-2 ring-turq-500 ring-offset-1 ring-offset-pitch-950'
                    )}
                    style={{
                      background: usWon ? 'rgba(35,181,211,0.20)' : themWon ? 'rgba(234,82,111,0.20)' : '#252320',
                      color:      usWon ? '#23B5D3'               : themWon ? '#EA526F'               : '#4A4A5A',
                    }}
                  >
                    {n}
                  </div>
                )
              })}
            </div>
            <p className="text-center text-[11px] text-ghost-400/60 mt-2">
              {teamInitials} leads {setsWonUs}–{setsWonThem} · {rallies.length} rallies
            </p>
          </div>
        </div>

        {/* Point origin donuts */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">Point origin</p>
        <div className="grid grid-cols-2 gap-3">
          <DonutChart teamName={teamName}     ownPoints={ourPos}  opponentErrors={ourErr}  variant="us" />
          <DonutChart teamName={opponentName} ownPoints={themPos} opponentErrors={themErr} variant="them" />
        </div>

        {/* Key stats */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">This set</p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Sideout %"    value={stats.sideoutPct}           prevValue={prevStats?.sideoutPct}           higherIsBetter />
          <StatTile label="Break %"      value={stats.breakPct}             prevValue={prevStats?.breakPct}             higherIsBetter />
          <StatTile label="Error ratio"  value={stats.errorRatioCumulative} prevValue={prevStats?.errorRatioCumulative} higherIsBetter={false} />
          <StatTile label="Positive play" value={stats.positivePlayPct}    prevValue={prevStats?.positivePlayPct}      higherIsBetter />
        </div>

        {/* Score timeline — §2.9 */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">Score timeline</p>
        <div className="card p-3">
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
              <XAxis
                dataKey="rally"
                tick={{ fill: chartTheme.tickColor, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: chartTheme.tickColor, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v > 0 ? `+${v}` : `${v}`}
              />
              <Tooltip
                contentStyle={{ background: chartTheme.tooltip.backgroundColor, border: '1px solid rgba(47,45,40,0.90)', borderRadius: 8, fontSize: 11 }}
                labelFormatter={(v) => `Rally ${v}`}
                formatter={(value: number, name: string) => [
                  value > 0 ? `+${value}` : `${value}`,
                  name === 'pos' ? 'Lead' : 'Deficit',
                ]}
              />
              <ReferenceLine y={0} stroke={chartTheme.gridColor} />
              <Area dataKey="pos" fill={chartTheme.turqFill} stroke={chartTheme.turq} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
              <Area dataKey="neg" fill={chartTheme.pinkFill} stroke={chartTheme.pink} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Rotation performance — §2.4 */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">Rotation performance</p>
        <div className="card p-4">
          <div className="grid grid-cols-6 gap-2">
            {stats.rotationStats.map(rot => {
              const total = rot.wins + rot.losses
              const winRate = total > 0 ? rot.wins / total : 0
              const { bg, text } = rotationColor(winRate)
              return (
                <div key={rot.rotation} className="rounded-sm p-2 text-center" style={{ background: bg }}>
                  <p className="text-[9px] text-ghost-400/60 mb-1">R{rot.rotation}</p>
                  <p className="text-xs font-bold leading-none" style={{ color: text }}>
                    {total > 0 ? `${Math.round(winRate * 100)}%` : '–'}
                  </p>
                  <p className="text-[8px] text-ghost-400/40 mt-1">{total}R</p>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom actions */}
      <div className="shrink-0 px-4 py-4 border-t border-pitch-400/40 space-y-2 bg-pitch-950">
        <Button fullWidth onClick={onSetupNextSet}>
          Set up Set {setNumber + 1}
        </Button>
        <Button fullWidth variant="outline" onClick={onViewStats} className="gap-2">
          <BarChart2 size={15} />
          View full match stats
        </Button>
      </div>
    </div>
  )
}
