import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { gamesApi, MatchStats, MatchAnalysis } from '../lib/api'
import { useMatchAnalysis } from '../hooks/useMatchAnalysis'
import { useRole } from '../hooks/useRole'
import { PageHeader } from '../components/ui/AppShell'
import { Tabs } from '../components/ui/Tabs'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, BarChart, Bar
} from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { cn } from '../components/ui/cn'

const SET_TABS_BASE = [{ id: 'all', label: 'All' }]

export function GameStatsPage() {
  const { id: matchId } = useParams<{ id: string }>()
  const { isManager } = useRole()
  const [activeSet, setActiveSet] = useState('all')
  const [simExpanded, setSimExpanded] = useState(false)

  const { data: match } = useQuery({
    queryKey: ['game', matchId],
    queryFn: () => gamesApi.get(matchId!),
    enabled: !!matchId,
  })

  const { data: stats } = useQuery<MatchStats>({
    queryKey: ['stats', matchId, activeSet],
    queryFn: () => gamesApi.stats(matchId!, activeSet !== 'all' ? activeSet : undefined),
    enabled: !!matchId,
  })

  const { data: analysis } = useMatchAnalysis(matchId)

  const setTabs = [
    ...SET_TABS_BASE,
    ...(match?.sets?.map(s => ({ id: s.id, label: `Set ${s.setNumber}` })) || []),
  ]

  const isCompleted = match?.status === 'completed'

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-2 flex items-center gap-2 border-b border-outline/10">
        <Link to="/games" className="p-2 -ml-2 rounded-full hover:bg-white/[0.06]">
          <ArrowLeft size={18} className="text-on-surface" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-on-surface-variant">
            {format(match?.date || '')}
          </p>
          <h1 className="font-display font-bold text-base text-on-surface truncate">
            {match?.matchType === 'playing'
              ? `vs ${match.opponent || 'TBD'}`
              : `${match?.homeTeam || '?'} vs ${match?.guestTeam || '?'}`}
          </h1>
        </div>
        {isManager && isCompleted && match?.sets?.[0] && (
          <Link
            to={`/games/${matchId}/log`}
            className="text-xs text-orange font-bold border border-orange/30 rounded-full px-3 py-1.5"
          >
            Log
          </Link>
        )}
      </div>

      {/* Set filter */}
      {setTabs.length > 1 && (
        <div className="px-4 py-3 border-b border-outline/10">
          <Tabs tabs={setTabs} activeTab={activeSet} onChange={setActiveSet} variant="pill" />
        </div>
      )}

      <div className="px-4 py-4 pb-6 space-y-4">
        {/* Match summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-display font-bold text-lg text-on-surface">
                {match?.setsWonUs ?? 0}–{match?.setsWonThem ?? 0}
              </p>
              <p className="text-xs text-on-surface-variant">Sets</p>
            </div>
            {match?.status === 'completed' && (
              <Badge
                label={match.setsWonUs > match.setsWonThem ? 'Win' : 'Loss'}
                variant={match.setsWonUs > match.setsWonThem ? 'green' : 'red'}
                size="md"
              />
            )}
          </div>

          {/* Set scores */}
          {match?.sets && match.sets.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {match.sets.map(s => (
                <div
                  key={s.id}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold',
                    s.scoreUs > s.scoreThem ? 'bg-orange/15 text-orange' : 'bg-surface-highest text-on-surface-variant'
                  )}
                >
                  {s.scoreUs}–{s.scoreThem}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats (only if we have data) */}
        {stats && (
          <>
            {/* Point quality */}
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Point Quality</p>
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  label={stats.pointQuality.benchmark}
                  variant={stats.pointQuality.benchmark === 'Assertive' ? 'green' : stats.pointQuality.benchmark === 'Balanced' ? 'amber' : 'red'}
                  size="md"
                />
              </div>
              {[
                { label: 'Positive play %', value: stats.pointQuality.positivePlayPct },
                { label: 'Sideout quality', value: stats.pointQuality.sideoutQuality },
                { label: 'Break quality', value: stats.pointQuality.breakQuality },
              ].map(({ label, value }) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant">{label}</span>
                    <span className="font-bold text-on-surface">{(value * 100).toFixed(1)}%</span>
                  </div>
                  <ProgressBar
                    value={value}
                    color={value >= 0.55 ? 'green' : value >= 0.40 ? 'amber' : 'red'}
                    height="sm"
                  />
                </div>
              ))}
            </div>

            {/* Rotation stats table */}
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Rotation Statistics</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-on-surface-variant border-b border-outline/10">
                    <th className="text-left py-1.5 font-bold">Rot</th>
                    <th className="text-center py-1.5">W</th>
                    <th className="text-center py-1.5">L</th>
                    <th className="text-right py-1.5">Break%</th>
                    <th className="text-right py-1.5">SO%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rotationStats.map(rot => (
                    <tr key={rot.rotation} className="border-t border-outline/10">
                      <td className="py-2 font-bold text-on-surface-variant">R{rot.rotation}</td>
                      <td className="text-center py-2 text-green-400 font-bold">{rot.wins}</td>
                      <td className="text-center py-2 text-error/70 font-bold">{rot.losses}</td>
                      <td className="text-right py-2 text-on-surface">{(rot.breakPct * 100).toFixed(0)}%</td>
                      <td className="text-right py-2 text-on-surface">{(rot.sideoutPct * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error pressure */}
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Error Pressure</p>
              <div className="space-y-3">
                <StatRow label="Sideout %" value={`${(stats.overall.sideoutPct * 100).toFixed(1)}%`} />
                <StatRow label="Break %" value={`${(stats.overall.breakPct * 100).toFixed(1)}%`} />
                <StatRow label="Error ratio" value={stats.overall.errorRatio.toFixed(3)} />
                <StatRow
                  label="Error clustering"
                  value={stats.errorClustering === -1 ? 'N/A' : stats.errorClustering.toFixed(2)}
                  highlight={stats.errorClustering >= 0.5 ? 'orange' : undefined}
                />
              </div>
            </div>

            {/* Score timeline */}
            {stats.tusTimeline.length > 3 && (
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Score Timeline</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={stats.tusTimeline} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="rallyIndex" tick={{ fill: '#e0e3e5', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#e0e3e5', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1d2022', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 11 }}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    <Line
                      type="monotone"
                      dataKey="scoreUs"
                      name="Us"
                      stroke="#ff5c00"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="scoreThem"
                      name="Them"
                      stroke="rgba(255,255,255,0.3)"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Analysis section */}
        {isCompleted && (
          <div className="mt-2">
            <h2 className="font-display font-bold text-base text-on-surface mb-3">AI Analysis</h2>
            <AnalysisSection analysis={analysis} />
          </div>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-on-surface-variant">{label}</span>
      <span className={cn('font-bold text-sm', highlight === 'orange' ? 'text-orange' : 'text-on-surface')}>
        {value}
      </span>
    </div>
  )
}

function AnalysisSection({ analysis }: { analysis: MatchAnalysis | undefined }) {
  const [simExpanded, setSimExpanded] = useState(false)

  if (!analysis || analysis.status === 'pending' || analysis.status === 'running') {
    return (
      <div className="card p-6 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-orange/30 border-t-orange rounded-full animate-spin" />
        <p className="text-sm font-bold text-on-surface">Analysing match data...</p>
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
      <div className="card p-4 border-error/20">
        <p className="text-sm text-error">Analysis failed: {analysis.errorMessage || 'Unknown error'}</p>
      </div>
    )
  }

  if (analysis.status !== 'ready' || !analysis.insights) {
    return null
  }

  const { strengths = [], weaknesses = [], action_items = [], simulation_summary } = analysis.insights

  return (
    <div className="space-y-4">
      {/* Strengths */}
      {strengths.length > 0 && (
        <InsightGroup title="Strengths" cards={strengths} color="green" />
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <InsightGroup title="Areas to Address" cards={weaknesses} color="red" />
      )}

      {/* Action items */}
      {action_items.length > 0 && (
        <InsightGroup title="Coaching Actions" cards={action_items} color="orange" />
      )}

      {/* Simulation summary */}
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
              <StatRow
                label="Baseline win probability"
                value={`${(simulation_summary.baseline_win_pct * 100).toFixed(1)}%`}
              />
              {simulation_summary.top_intervention && (
                <div className="mt-2 p-3 rounded-lg bg-surface-high">
                  <p className="text-xs text-on-surface-variant">Top improvement scenario:</p>
                  <p className="text-sm font-bold text-orange mt-0.5">
                    {simulation_summary.top_intervention.label}
                  </p>
                  <p className="text-xs text-green-400">
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
  color: 'green' | 'red' | 'orange'
}) {
  const borderColor = { green: 'border-green-500/20', red: 'border-error/20', orange: 'border-orange/20' }
  const textColor = { green: 'text-green-400', red: 'text-error', orange: 'text-orange' }

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
                {card.target_value !== null && card.target_value !== undefined && (
                  <> → Target: <span className="font-bold text-on-surface">{(card.target_value * 100).toFixed(1)}%</span></>
                )}
              </span>
              {card.impact && (
                <span className="text-xs font-bold text-green-400">{card.impact}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
