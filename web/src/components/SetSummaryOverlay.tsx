import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X, BarChart2 } from 'lucide-react'
import { Rally, GameSet, setsApi } from '../lib/api'
import { computeLiveStats } from '../lib/statistics'
import { pointSource, errorMix, scoringTimeline, selfGeneratedPct, netGifts, serveRisk } from '../lib/pointStats'
import { MultiDonut, CatBars, AnnotatedTimeline, RotationMatrix, KpiTile, InsightCard } from './stats/pointCharts'
import { Button } from './ui/Button'
import { cn } from './ui/cn'

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
  const { t } = useTranslation()
  const won = scoreUs > scoreThem

  const previousSet = sets.find(s => s.setNumber === setNumber - 1 && s.status === 'completed')

  const { data: prevSetData } = useQuery({
    queryKey: ['set', previousSet?.id],
    queryFn: () => setsApi.get(matchId, previousSet!.id),
    enabled: !!previousSet,
  })

  const currentSet = sets.find(s => s.setNumber === setNumber)
  const { data: currentSetData } = useQuery({
    queryKey: ['set', currentSet?.id],
    queryFn: () => setsApi.get(matchId, currentSet!.id),
    enabled: !!currentSet,
  })
  const timeouts = currentSetData?.timeouts ?? []

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

  const timeline = useMemo(() => scoringTimeline(rallies), [rallies])
  const ps = useMemo(() => pointSource(rallies), [rallies])
  const em = useMemo(() => errorMix(rallies), [rallies])
  const selfGen = selfGeneratedPct(rallies)
  const gifts = netGifts(rallies)
  const serve = serveRisk(rallies)

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
          <p className="text-xs text-ghost-300">{t('liveLog.set', { number: setNumber })}</p>
          <h1 className="font-display font-bold text-base text-ghost-100 leading-tight">{t('setSummary.title')}</h1>
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
                {won ? `✓ ${t('setSummary.setWon', { number: setNumber })}` : `✗ ${t('setSummary.setLost', { number: setNumber })}`}
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
              {teamInitials} {t('setSummary.leading', { us: setsWonUs, them: setsWonThem })} · {t('setSummary.rallies', { count: rallies.length })}
            </p>
          </div>
        </div>

        {/* Point source + error mix */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">{t('setSummary.pointOrigin')}</p>
        {ps.total > 0 && <MultiDonut title={t('stats.pointSource')} data={sourceData} />}
        {em.total > 0 && <CatBars title={t('stats.errorMix')} data={errorData} />}

        {/* Key stats */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">{t('setSummary.thisSet')}</p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t('dashboard.sideoutPct')}  value={stats.sideoutPct}           prevValue={prevStats?.sideoutPct}           higherIsBetter />
          <StatTile label={t('dashboard.breakPct')}    value={stats.breakPct}             prevValue={prevStats?.breakPct}             higherIsBetter />
          <StatTile label={t('stats.errorRatio')}      value={stats.errorRatioCumulative} prevValue={prevStats?.errorRatioCumulative} higherIsBetter={false} />
          <StatTile label={t('stats.positivePlay')}    value={stats.positivePlayPct}      prevValue={prevStats?.positivePlayPct}      higherIsBetter />
        </div>

        {/* Quality KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KpiTile label={t('stats.selfGenerated')} value={`${Math.round(selfGen * 100)}%`} color="#23B5D3" />
          <KpiTile label={t('stats.netGifts')} value={gifts.net > 0 ? `+${gifts.net}` : `${gifts.net}`}
            sub={`${gifts.oppErr}/${gifts.ourErr}`} color={gifts.net >= 0 ? '#23B5D3' : '#EA526F'} />
          <KpiTile label={t('stats.serveRisk')} value={`${serve.aces}:${serve.serveErr}`}
            color={serve.ratio != null && serve.ratio >= 0.5 ? '#23B5D3' : '#EA526F'} />
        </div>

        {/* Score timeline (annotated by point type) */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">{t('setSummary.scoreTimeline')}</p>
        <AnnotatedTimeline data={timeline} timeouts={timeouts} height={140} />

        {/* Rotation sideout/break matrix */}
        <p className="text-[10px] text-ghost-400/70 uppercase tracking-widest font-bold">{t('setSummary.rotationPerf')}</p>
        <RotationMatrix rows={stats.rotationStats} />

        {/* Insight */}
        {em.total > 0 && em.reception >= 2 && em.reception >= em.serve && em.reception >= em.attack && (
          <InsightCard tone="warn">
            {t('setSummary.insightReception', { count: em.reception })}
          </InsightCard>
        )}

      </div>

      {/* Bottom actions */}
      <div className="shrink-0 px-4 py-4 border-t border-pitch-400/40 space-y-2 bg-pitch-950">
        <Button fullWidth onClick={onSetupNextSet}>
          {t('setSummary.setupNextSet', { number: setNumber + 1 })}
        </Button>
        <Button fullWidth variant="outline" onClick={onViewStats} className="gap-2">
          <BarChart2 size={15} />
          {t('setSummary.fullMatchStats')}
        </Button>
      </div>
    </div>
  )
}
