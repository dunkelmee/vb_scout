import React, { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { gamesApi, setsApi, MatchStats, MatchAnalysis, GameSet } from '../lib/api'
import { DonutChart } from '../components/ui/DonutChart'
import { useMatchAnalysis } from '../hooks/useMatchAnalysis'
import { useRole } from '../hooks/useRole'
import {
  ComposedChart, Area, ReferenceLine,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from 'recharts'
import { ArrowLeft, ChevronDown, ChevronUp, Hash } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { cn } from '../components/ui/cn'
import { chartTheme } from '../lib/chartTheme'

// ── Colour helpers ────────────────────────────────────────────────────────────

function perfColor(value: number, target: number, higherBetter: boolean): string {
  const meets = higherBetter ? value >= target : value <= target
  if (meets) return '#23B5D3'  // turq-500
  const close = higherBetter ? value >= target - 0.05 : value <= target + 0.05
  return close ? '#279AF1' : '#EA526F'  // bell-500 : bubb-500
}

function rotationColor(winRate: number): { bg: string; text: string } {
  if (winRate >= 0.60) return { bg: 'rgba(35,181,211,0.22)',  text: '#23B5D3' }
  if (winRate >= 0.40) return { bg: 'rgba(39,154,241,0.15)',  text: '#279AF1' }
  return                       { bg: 'rgba(234,82,111,0.22)', text: '#EA526F' }
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, display, color, barValue, sub }: {
  label: string
  display: string
  color: string
  barValue: number  // 0-1 for bar width
  sub?: string
}) {
  return (
    <div className="card p-3">
      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-bold mb-1">{label}</p>
      <p className="text-xl font-bold leading-none" style={{ color }}>{display}</p>
      {sub && <p className="text-[10px] text-on-surface-variant/40 mt-1 leading-tight">{sub}</p>}
      <div className="h-0.5 bg-white/[0.05] rounded-full mt-2">
        <div
          className="h-0.5 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, barValue * 100))}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Per-set score timeline ────────────────────────────────────────────────────

function SetScoreTimeline({ matchId, set }: { matchId: string; set: GameSet }) {
  const { data: setData, isLoading } = useQuery({
    queryKey: ['set', set.id],
    queryFn: () => setsApi.get(matchId, set.id),
  })

  const chartData = useMemo(() => {
    const rallies = setData?.rallies ?? []
    const pts: { rally: number; pos: number; neg: number }[] = [{ rally: 0, pos: 0, neg: 0 }]
    rallies.forEach(r => {
      const diff = r.scoreUs - r.scoreThem
      pts.push({ rally: r.rallyIndex + 1, pos: Math.max(0, diff), neg: Math.min(0, diff) })
    })
    return pts
  }, [setData])

  const timeouts = setData?.timeouts ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-turq-500/30 border-t-turq-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!setData?.rallies?.length) return null

  return (
    <div>
      <ResponsiveContainer width="100%" height={130}>
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
          {timeouts.map(t => (
            <ReferenceLine
              key={t.id}
              x={t.rallyIndex + 1}
              stroke={t.calledBy === 'us' ? 'rgba(35,181,211,0.55)' : 'rgba(234,82,111,0.55)'}
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          ))}
          <Area dataKey="pos" fill={chartTheme.turqFill} stroke={chartTheme.turq} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
          <Area dataKey="neg" fill={chartTheme.pinkFill} stroke={chartTheme.pink} strokeWidth={1.5} baseValue={0} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[11px] text-on-surface-variant/40 mt-1 px-1">
        <span>Final: {setData.scoreUs}–{setData.scoreThem}</span>
        <span>{setData.rallies.length} rallies</span>
      </div>
    </div>
  )
}

// ── Set comparison table row ──────────────────────────────────────────────────

function SetTableRow({
  label,
  sets,
  getValue,
  getColor,
}: {
  label: string
  sets: MatchStats['perSetStats']
  getValue: (s: MatchStats['perSetStats'][0]) => string
  getColor?: (s: MatchStats['perSetStats'][0]) => string
}) {
  return (
    <tr className="border-t border-outline/10">
      <td className="py-2 text-[10px] text-on-surface-variant/50 uppercase tracking-wide font-bold">{label}</td>
      {sets.map(s => (
        <td key={s.setId} className="text-center py-2 text-xs font-bold"
          style={{ color: getColor ? getColor(s) : '#E0E3E5' }}>
          {getValue(s)}
        </td>
      ))}
    </tr>
  )
}

// ── Analysis section ──────────────────────────────────────────────────────────

function AnalysisSection({ analysis }: { analysis: MatchAnalysis | undefined }) {
  const [simExpanded, setSimExpanded] = useState(false)

  if (!analysis || analysis.status === 'pending' || analysis.status === 'running') {
    return (
      <div className="card p-6 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-turq-500/30 border-t-turq-500 rounded-full animate-spin" />
        <p className="text-sm font-bold text-on-surface">Analysing match data…</p>
        <p className="text-xs text-on-surface-variant">Usually ready within 30 seconds.</p>
      </div>
    )
  }

  if (analysis.status === 'insufficient_data') {
    return (
      <div className="card p-4">
        <p className="text-sm text-on-surface-variant">
          Not enough data to analyse ({analysis.nRallies} rallies). Minimum 20 required.
        </p>
      </div>
    )
  }

  if (analysis.status === 'error') {
    return (
      <div className="card p-4 border-bubb-500/20">
        <p className="text-sm text-bubb-500">Analysis failed: {analysis.errorMessage || 'Unknown error'}</p>
      </div>
    )
  }

  if (analysis.status !== 'ready' || !analysis.insights) return null

  const { strengths = [], weaknesses = [], action_items = [], simulation_summary } = analysis.insights

  return (
    <div className="space-y-4">
      {strengths.length > 0 && <InsightGroup title="Strengths" cards={strengths} color="turq" />}
      {weaknesses.length > 0 && <InsightGroup title="Areas to Address" cards={weaknesses} color="bubb" />}
      {action_items.length > 0 && <InsightGroup title="Coaching Actions" cards={action_items} color="bell" />}

      {simulation_summary && (
        <div className="card p-4">
          <button
            onClick={() => setSimExpanded(!simExpanded)}
            className="flex items-center justify-between w-full"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Simulation</p>
            {simExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {simExpanded && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Baseline win probability</span>
                <span className="font-bold text-sm text-on-surface">
                  {(simulation_summary.baseline_win_pct * 100).toFixed(1)}%
                </span>
              </div>
              {simulation_summary.top_intervention && (
                <div className="mt-2 p-3 rounded-lg bg-surface-high">
                  <p className="text-xs text-on-surface-variant">Top improvement scenario:</p>
                  <p className="text-sm font-bold text-turq-500 mt-0.5">
                    {simulation_summary.top_intervention.label}
                  </p>
                  <p className="text-xs text-turq-400">
                    +{(simulation_summary.top_intervention.win_rate_delta * 100).toFixed(1)}% win rate
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InsightGroup({
  title, cards, color
}: {
  title: string
  cards: Array<{
    id: string; title: string; detail: string; current_value: number
    target_value?: number | null; direction: string; impact?: string | null
  }>
  color: 'turq' | 'bubb' | 'bell'
}) {
  const borderColor = { turq: 'border-turq-500/20', bubb: 'border-bubb-500/20', bell: 'border-bell-500/20' }
  const textColor   = { turq: 'text-turq-400',      bubb: 'text-bubb-500',      bell: 'text-bell-400' }

  return (
    <div>
      <h3 className={cn('text-xs font-bold uppercase tracking-wide mb-2', textColor[color])}>{title}</h3>
      <div className="space-y-2">
        {cards.map(card => (
          <div key={card.id} className={cn('card p-4 border-l-2', borderColor[color])}>
            <p className="font-bold text-sm text-on-surface">{card.title}</p>
            <p className="text-xs text-on-surface-variant mt-1">{card.detail}</p>
            <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
              <span className="text-xs text-on-surface-variant">
                Current: <span className="font-bold text-on-surface">{(card.current_value * 100).toFixed(1)}%</span>
                {card.target_value != null && (
                  <> → Target: <span className="font-bold text-on-surface">{(card.target_value * 100).toFixed(1)}%</span></>
                )}
              </span>
              {card.impact && (
                <span className="text-xs font-bold text-turq-400">{card.impact}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GameStatsPage() {
  const { id: matchId } = useParams<{ id: string }>()
  const { isManager } = useRole()
  const [timelineSetId, setTimelineSetId] = useState<string | null>(null)

  const { data: match } = useQuery({
    queryKey: ['game', matchId],
    queryFn: () => gamesApi.get(matchId!),
    enabled: !!matchId,
  })

  const { data: stats } = useQuery<MatchStats>({
    queryKey: ['stats', matchId],
    queryFn: () => gamesApi.stats(matchId!),
    enabled: !!matchId,
  })

  const { data: analysis } = useMatchAnalysis(matchId)

  const isCompleted = match?.status === 'completed'
  const sets = match?.sets ?? []

  // Fetch all sets to aggregate point-origin counts for donut charts
  const setQueries = useQueries({
    queries: sets.map(s => ({
      queryKey: ['set', s.id],
      queryFn: () => setsApi.get(matchId!, s.id),
      enabled: !!matchId && isCompleted,
    })),
  })

  const pointCounts = useMemo(() => {
    const allRallies = setQueries.flatMap(q => q.data?.rallies ?? [])
    return {
      ourPos:  allRallies.filter(r => r.pointType === 'us_positive').length,
      ourErr:  allRallies.filter(r => r.pointType === 'them_error').length,
      themPos: allRallies.filter(r => r.pointType === 'them_positive').length,
      themErr: allRallies.filter(r => r.pointType === 'us_error').length,
    }
  }, [setQueries])

  // Default active set for timeline: first set
  const activeTimelineSetId = timelineSetId ?? sets[0]?.id ?? null
  const activeTimelineSet = sets.find(s => s.id === activeTimelineSetId) ?? sets[0] ?? null

  // Opponent name for hero
  const ourTeam = match?.matchType === 'playing'
    ? (match.team?.name || 'Us')
    : (match?.homeTeam || 'Home')
  const theirTeam = match?.matchType === 'playing'
    ? (match?.opponent || 'Opponent')
    : (match?.guestTeam || 'Guest')

  const won = (match?.setsWonUs ?? 0) > (match?.setsWonThem ?? 0)

  // KPI colours
  const kpiSideout  = stats ? perfColor(stats.overall.sideoutPct, 0.55, true)  : '#888'
  const kpiBreak    = stats ? perfColor(stats.overall.breakPct, 0.45, true)    : '#888'
  const kpiError    = stats ? perfColor(stats.overall.errorRatio, 0.30, false) : '#888'
  const kpiPosPlay  = stats ? perfColor(stats.pointQuality.positivePlayPct, 0.60, true) : '#888'
  const pointsRatio = stats && stats.overall.pointsThem > 0
    ? stats.overall.pointsUs / stats.overall.pointsThem
    : 1
  const kpiRatio    = stats ? perfColor(pointsRatio, 1.0, true) : '#888'
  const kpiCluster  = stats && stats.errorClustering >= 0
    ? perfColor(stats.errorClustering, 0.50, false)
    : '#888'

  return (
    <div className="min-h-dvh bg-background">

      {/* ── Header ── */}
      <div className="px-4 pt-safe-top pt-4 pb-2 flex items-center gap-2 border-b border-outline/10 sticky top-0 bg-background z-10">
        <Link to="/games" className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-on-surface-variant">
            {format(match?.date || '')}
            {match?.location ? ` · ${match.location}` : ''}
          </p>
          <h1 className="font-display font-bold text-base text-on-surface truncate">
            Match summary
          </h1>
        </div>
        {isManager && !isCompleted && sets.length > 0 && (
          <Link
            to={`/games/${matchId}/log`}
            className="text-xs text-turq-500 font-bold border border-turq-500/30 rounded-full px-3 py-1.5 shrink-0"
          >
            Log
          </Link>
        )}
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">

        {/* ── Hero ── */}
        {match && (
          <div className="card p-5 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(35,181,211,0.08)_0%,transparent_65%)]" />
            <div className="relative">

              {/* Teams + set scores */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <p className="text-[11px] text-on-surface-variant uppercase tracking-wide mb-1 truncate">{ourTeam}</p>
                  <p
                    className="font-display font-black text-5xl leading-none"
                    style={{ color: won ? '#23B5D3' : '#5F5E5A' }}
                  >
                    {match.setsWonUs}
                  </p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <p className="text-[9px] text-on-surface-variant/40 uppercase tracking-wide">Sets</p>
                  <p className="text-2xl font-light text-on-surface-variant/30">–</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[11px] text-on-surface-variant uppercase tracking-wide mb-1 truncate">{theirTeam}</p>
                  <p
                    className="font-display font-black text-5xl leading-none"
                    style={{ color: !won ? '#EA526F' : '#5F5E5A' }}
                  >
                    {match.setsWonThem}
                  </p>
                </div>
              </div>

              {/* Result badge */}
              {isCompleted && (
                <div className="flex justify-center mt-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={won
                      ? { background: 'rgba(35,181,211,0.18)',  color: '#23B5D3' }
                      : { background: 'rgba(234,82,111,0.18)', color: '#EA526F' }}
                  >
                    {won ? '🏆 Match won' : '✗ Match lost'}
                  </span>
                </div>
              )}

              {/* Per-set score pills */}
              {sets.length > 0 && (
                <div className="flex gap-2 flex-wrap justify-center mt-3">
                  {sets.map(s => {
                    const setWon = s.scoreUs > s.scoreThem
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg px-2.5 py-1.5 text-center"
                        style={setWon
                          ? { background: 'rgba(35,181,211,0.18)',  border: '1px solid rgba(35,181,211,0.25)' }
                          : { background: 'rgba(234,82,111,0.10)', border: '1px solid rgba(234,82,111,0.15)' }}
                      >
                        <p className="text-[8px] text-on-surface-variant/50 mb-0.5">Set {s.setNumber}</p>
                        <p className="text-xs font-bold" style={{ color: setWon ? '#23B5D3' : '#EA526F' }}>
                          {s.scoreUs}–{s.scoreThem}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Meta row */}
              {stats && (
                <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-outline/10 text-[11px] text-on-surface-variant/40">
                  <span className="flex items-center gap-1">
                    <Hash size={10} />
                    {stats.overall.totalRallies} rallies
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {isCompleted && (pointCounts.ourPos + pointCounts.ourErr + pointCounts.themPos + pointCounts.themErr) > 0 && (
          <>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Point origin</p>
            <div className="grid grid-cols-2 gap-3">
              <DonutChart teamName={ourTeam}   ownPoints={pointCounts.ourPos}  opponentErrors={pointCounts.ourErr}  variant="us" />
              <DonutChart teamName={theirTeam} ownPoints={pointCounts.themPos} opponentErrors={pointCounts.themErr} variant="them" />
            </div>
          </>
        )}

        {stats && isCompleted && (
          <>
            {/* ── Key metrics ── */}
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Key metrics</p>
            <div className="grid grid-cols-2 gap-3">
              <KpiTile
                label="Sideout %"
                display={`${(stats.overall.sideoutPct * 100).toFixed(1)}%`}
                color={kpiSideout}
                barValue={stats.overall.sideoutPct}
                sub={`target ≥55%${stats.overall.sideoutPct >= 0.55 ? ' ✓' : ''}`}
              />
              <KpiTile
                label="Break %"
                display={`${(stats.overall.breakPct * 100).toFixed(1)}%`}
                color={kpiBreak}
                barValue={stats.overall.breakPct}
                sub={`target ≥45%${stats.overall.breakPct >= 0.45 ? ' ✓' : ''}`}
              />
              <KpiTile
                label="Error ratio"
                display={stats.overall.errorRatio.toFixed(2)}
                color={kpiError}
                barValue={Math.min(1, stats.overall.errorRatio)}
                sub={`target ≤0.30${stats.overall.errorRatio <= 0.30 ? ' ✓' : ''}`}
              />
              <KpiTile
                label="Positive play"
                display={`${(stats.pointQuality.positivePlayPct * 100).toFixed(1)}%`}
                color={kpiPosPlay}
                barValue={stats.pointQuality.positivePlayPct}
                sub={`target ≥60%${stats.pointQuality.positivePlayPct >= 0.60 ? ' ✓' : ''}`}
              />
              <KpiTile
                label="Points ratio"
                display={pointsRatio.toFixed(2)}
                color={kpiRatio}
                barValue={Math.min(1, pointsRatio / 1.5)}
                sub={`${stats.overall.pointsUs} scored · ${stats.overall.pointsThem} conceded`}
              />
              <KpiTile
                label="Error clustering"
                display={stats.errorClustering < 0 ? 'N/A' : stats.errorClustering.toFixed(2)}
                color={kpiCluster}
                barValue={stats.errorClustering < 0 ? 0 : Math.min(1, stats.errorClustering)}
                sub={stats.errorClustering < 0 ? 'Insufficient data' : stats.errorClustering >= 0.5 ? 'Clustered errors' : 'Mild clustering'}
              />
            </div>

            {/* ── Set comparison ── */}
            {stats.perSetStats.length > 0 && (
              <>
                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Set comparison</p>
                <div className="card p-4 overflow-x-auto">
                  <table className="w-full text-xs min-w-[220px]">
                    <thead>
                      <tr>
                        <th className="text-left pb-2.5 text-[9px] font-bold text-on-surface-variant/30 uppercase tracking-wide" />
                        {stats.perSetStats.map(s => {
                          const sw = s.scoreUs > s.scoreThem
                          return (
                            <th
                              key={s.setId}
                              className="text-center pb-2.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{ color: sw ? '#23B5D3' : '#EA526F' }}
                            >
                              S{s.setNumber} {sw ? 'W' : 'L'}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <SetTableRow
                        label="Score"
                        sets={stats.perSetStats}
                        getValue={s => `${s.scoreUs}–${s.scoreThem}`}
                        getColor={s => s.scoreUs > s.scoreThem ? '#23B5D3' : '#EA526F'}
                      />
                      <SetTableRow
                        label="Rallies"
                        sets={stats.perSetStats}
                        getValue={s => `${s.stats.totalRallies}`}
                      />
                      <SetTableRow
                        label="Sideout"
                        sets={stats.perSetStats}
                        getValue={s => `${(s.stats.sideoutPct * 100).toFixed(0)}%`}
                        getColor={s => perfColor(s.stats.sideoutPct, 0.55, true)}
                      />
                      <SetTableRow
                        label="Break %"
                        sets={stats.perSetStats}
                        getValue={s => `${(s.stats.breakPct * 100).toFixed(0)}%`}
                        getColor={s => perfColor(s.stats.breakPct, 0.45, true)}
                      />
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Score timeline with set selector ── */}
        {isCompleted && sets.length > 0 && matchId && (
          <>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Score timeline</p>
            <div className="card p-4">
              {/* Set pills */}
              <div className="flex gap-2 flex-wrap mb-4">
                {sets.map(s => {
                  const isActive = activeTimelineSetId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setTimelineSetId(s.id)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-bold transition-all',
                        isActive
                          ? 'bg-turq-500 text-pitch-950 shadow-[0_2px_8px_rgba(35,181,211,0.35)]'
                          : 'bg-white/[0.06] text-on-surface-variant hover:bg-white/[0.09]'
                      )}
                    >
                      S{s.setNumber}
                    </button>
                  )
                })}
              </div>

              {/* Chart */}
              {activeTimelineSet && (
                <SetScoreTimeline matchId={matchId} set={activeTimelineSet} />
              )}

              {/* Legend */}
              <div className="flex gap-4 mt-3 text-[11px] text-on-surface-variant/50">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#23B5D3' }} />
                  Leading
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#EA526F' }} />
                  Trailing
                </span>
              </div>
            </div>
          </>
        )}

        {stats && (
          <>
            {/* ── Rotation performance ── */}
            {stats.rotationStats.length > 0 && (
              <>
                <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Rotation performance</p>
                <div className="card p-4">
                  <div className="grid grid-cols-6 gap-2">
                    {stats.rotationStats.map(rot => {
                      const total = rot.wins + rot.losses
                      const winRate = total > 0 ? rot.wins / total : 0
                      const { bg, text } = rotationColor(winRate)
                      return (
                        <div key={rot.rotation} className="rounded-xl p-2 text-center" style={{ background: bg }}>
                          <p className="text-[9px] text-on-surface-variant/60 mb-1">R{rot.rotation}</p>
                          <p className="text-xs font-bold leading-none" style={{ color: text }}>
                            {total > 0 ? `${Math.round(winRate * 100)}%` : '–'}
                          </p>
                          <p className="text-[8px] text-on-surface-variant/40 mt-1">{total}R</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── AI insights ── */}
        {isCompleted && (
          <>
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">Match insights</p>
            <AnalysisSection analysis={analysis} />
          </>
        )}

      </div>
    </div>
  )
}
