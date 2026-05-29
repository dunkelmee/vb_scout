import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GameSet, ralliesApi } from '../../lib/api'
import { cn } from '../ui/cn'
import { Clock, RotateCw } from 'lucide-react'
import { useMatchStore } from '../../store/matchStore'

interface TimelineTabProps {
  set: GameSet
  matchId: string
}

type TimelineEntry =
  | { type: 'rally'; rallyIndex: number; scorer: string; pointType: string; scoreUs: number; scoreThem: number; rotated: boolean; setNumber: number; id: string }
  | { type: 'timeout'; rallyIndex: number; calledBy: string; atScoreUs: number; atScoreThem: number; id: string }
  | { type: 'substitution'; rallyIndex: number; playerOutName: string; playerInName: string; id: string }

export function TimelineTab({ set, matchId }: TimelineTabProps) {
  const qc = useQueryClient()
  const store = useMatchStore()

  // Build merged timeline
  const entries: TimelineEntry[] = []

  for (const r of set.rallies || []) {
    entries.push({
      type: 'rally',
      id: r.id,
      rallyIndex: r.rallyIndex,
      scorer: r.scorer,
      pointType: r.pointType,
      scoreUs: r.scoreUs,
      scoreThem: r.scoreThem,
      rotated: r.rotated,
      setNumber: set.setNumber,
    })
  }

  for (const t of set.timeouts || []) {
    entries.push({
      type: 'timeout',
      id: t.id,
      rallyIndex: t.rallyIndex,
      calledBy: t.calledBy,
      atScoreUs: t.atScoreUs,
      atScoreThem: t.atScoreThem,
    })
  }

  for (const s of set.substitutions || []) {
    const outName = s.playerOut ? `#${s.playerOut.jersey || '?'} ${s.playerOut.firstName}` : '?'
    const inName = s.playerIn ? `#${s.playerIn.jersey || '?'} ${s.playerIn.firstName}` : '?'
    entries.push({
      type: 'substitution',
      id: s.id,
      rallyIndex: s.rallyIndex,
      playerOutName: outName,
      playerInName: inName,
    })
  }

  // Sort descending (newest first)
  entries.sort((a, b) => b.rallyIndex - a.rallyIndex)

  const pointTypeLabel: Record<string, string> = {
    us_positive: 'Own play',
    them_error: 'Their error',
    them_positive: 'Their play',
    us_error: 'Our error',
  }

  return (
    <div className="px-4 py-4 pb-20">
      {entries.length === 0 && (
        <p className="text-center text-on-surface-variant text-sm py-8">No events yet.</p>
      )}

      {/* Score display at top */}
      {store.scoreUs > 0 || store.scoreThem > 0 ? (
        <div className="mb-4 flex justify-center">
          <div className="px-6 py-3 bg-orange rounded-xl">
            <span className="font-display font-black text-2xl text-white">
              {store.scoreUs} – {store.scoreThem}
            </span>
          </div>
        </div>
      ) : null}

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-outline/20" />

        <div className="space-y-2 pl-6">
          {entries.map((entry, idx) => (
            <TimelineEntry key={entry.id} entry={entry} isNewest={idx === 0} setNumber={set.setNumber} pointTypeLabel={pointTypeLabel} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineEntry({
  entry, isNewest, setNumber, pointTypeLabel
}: {
  entry: TimelineEntry
  isNewest: boolean
  setNumber: number
  pointTypeLabel: Record<string, string>
}) {
  if (entry.type === 'timeout') {
    return (
      <div className="relative">
        <div className="absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-secondary-container border-2 border-surface-container" />
        <div className="card p-3 flex items-center gap-3 border-l-2 border-secondary-container">
          <Clock size={14} className="text-secondary-container shrink-0" />
          <div>
            <p className="text-xs font-bold text-secondary-container uppercase tracking-wide">
              TIMEOUT: {entry.calledBy === 'us' ? 'US' : 'THEM'}
            </p>
            <p className="text-xs text-on-surface-variant">
              Called at {entry.atScoreUs}–{entry.atScoreThem}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (entry.type === 'substitution') {
    return (
      <div className="relative">
        <div className="absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-surface-bright border-2 border-surface-container" />
        <div className="card p-3 flex items-center gap-3">
          <span className="text-on-surface-variant text-sm">⇄</span>
          <div className="flex-1">
            <span className="text-xs font-bold text-on-surface-variant">IN </span>
            <span className="text-xs font-bold text-green-400">{entry.playerInName}</span>
            <span className="text-xs text-on-surface-variant"> → OUT </span>
            <span className="text-xs font-bold text-error/70">{entry.playerOutName}</span>
          </div>
        </div>
      </div>
    )
  }

  // Rally entry
  const ourPoint = entry.scorer === 'us'
  const isPositive = entry.pointType === 'us_positive' || entry.pointType === 'them_positive'

  return (
    <div className="relative">
      <div className={cn(
        'absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-surface-container',
        ourPoint ? 'bg-orange' : 'bg-surface-high'
      )} />

      <div className={cn(
        'card p-3',
        isNewest && 'border-orange/30 bg-orange/5'
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-surface-high rounded px-1.5 py-0.5 font-bold text-on-surface-variant">
              S{setNumber}
            </span>
            <span className="font-bold text-sm text-on-surface">
              {entry.scoreUs} – {entry.scoreThem}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isNewest && (
              <span className="text-[9px] bg-orange text-white rounded-full px-2 py-0.5 font-bold uppercase">Newest</span>
            )}
            <span className={cn(
              'text-xs font-bold uppercase flex items-center gap-1',
              ourPoint ? 'text-orange' : 'text-error/70'
            )}>
              {ourPoint ? '✓' : '✗'} {ourPoint ? 'Our point' : 'Their point'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-on-surface">
            {pointTypeLabel[entry.pointType] || entry.pointType}
          </p>
          {entry.rotated && (
            <span className="text-xs text-secondary-container flex items-center gap-1">
              <RotateCw size={10} /> Rotated
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
