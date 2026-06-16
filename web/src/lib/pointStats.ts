// Point-attribution aggregations (client-side, pure functions over Rally[]).
// All computable from the 2-step logged data: scorer · pointType · pointSubtype
// · servingTeam · score · rallyIndex. No player attribution.
import type { Rally } from './api'

type R = Pick<Rally, 'scorer' | 'pointType' | 'pointSubtype' | 'servingTeam' | 'scoreUs' | 'scoreThem' | 'rallyIndex'>

// ── Point source (how OUR points came) ───────────────────────────────────────
export interface PointSource { ace: number; kill: number; block: number; oppErr: number; total: number }
export function pointSource(rallies: R[]): PointSource {
  const our = rallies.filter(r => r.scorer === 'us')
  let ace = 0, kill = 0, block = 0, oppErr = 0
  for (const r of our) {
    if (r.pointType === 'them_error') oppErr++
    else if (r.pointSubtype === 'ace') ace++
    else if (r.pointSubtype === 'block') block++
    else kill++ // 'kill' or any unclassified winner
  }
  return { ace, kill, block, oppErr, total: our.length }
}

// ── Error mix (how WE gave points away) ──────────────────────────────────────
export interface ErrorMix { serve: number; reception: number; attack: number; other: number; total: number }
export function errorMix(rallies: R[]): ErrorMix {
  const errs = rallies.filter(r => r.pointType === 'us_error')
  let serve = 0, reception = 0, attack = 0, other = 0
  for (const r of errs) {
    switch (r.pointSubtype) {
      case 'serve': serve++; break
      case 'reception': reception++; break
      case 'attack': attack++; break
      default: other++
    }
  }
  return { serve, reception, attack, other, total: errs.length }
}

// ── Phase split (sideout / break) with mechanism breakdown ────────────────────
export interface PhaseStats {
  sideoutPct: number; breakPct: number
  receiveRallies: number; serveRallies: number
  sideouts: number; breaks: number
  sideoutKills: number; sideoutReceptErr: number
  breakAces: number; breakServeErr: number
}
export function phaseStats(rallies: R[]): PhaseStats {
  const recv = rallies.filter(r => r.servingTeam === 'them')
  const serv = rallies.filter(r => r.servingTeam === 'us')
  const sideouts = recv.filter(r => r.scorer === 'us').length
  const breaks = serv.filter(r => r.scorer === 'us').length
  return {
    sideoutPct: recv.length ? sideouts / recv.length : 0,
    breakPct: serv.length ? breaks / serv.length : 0,
    receiveRallies: recv.length,
    serveRallies: serv.length,
    sideouts,
    breaks,
    sideoutKills: recv.filter(r => r.scorer === 'us' && r.pointSubtype === 'kill').length,
    sideoutReceptErr: recv.filter(r => r.scorer === 'them' && r.pointSubtype === 'reception').length,
    breakAces: serv.filter(r => r.scorer === 'us' && r.pointSubtype === 'ace').length,
    breakServeErr: serv.filter(r => r.scorer === 'them' && r.pointSubtype === 'serve').length,
  }
}

// ── Self-generated %, net gifts, serve risk ──────────────────────────────────
export function selfGeneratedPct(rallies: R[]): number {
  const our = rallies.filter(r => r.scorer === 'us')
  if (!our.length) return 0
  return our.filter(r => r.pointType === 'us_positive').length / our.length
}

export function netGifts(rallies: R[]): { oppErr: number; ourErr: number; net: number } {
  const oppErr = rallies.filter(r => r.pointType === 'them_error').length
  const ourErr = rallies.filter(r => r.pointType === 'us_error').length
  return { oppErr, ourErr, net: oppErr - ourErr }
}

export function serveRisk(rallies: R[]): { aces: number; serveErr: number; ratio: number | null } {
  const aces = rallies.filter(r => r.scorer === 'us' && r.pointSubtype === 'ace').length
  const serveErr = rallies.filter(r => r.pointType === 'us_error' && r.pointSubtype === 'serve').length
  return { aces, serveErr, ratio: aces + serveErr > 0 ? aces / (aces + serveErr) : null }
}

// ── Runs / momentum ──────────────────────────────────────────────────────────
export interface Runs { biggestFor: number; biggestAgainst: number; currentTeam: 'us' | 'them' | null; currentLen: number }
export function runs(rallies: R[]): Runs {
  let biggestFor = 0, biggestAgainst = 0, cur = 0
  let curTeam: 'us' | 'them' | null = null
  for (const r of rallies) {
    if (r.scorer === curTeam) cur++
    else { curTeam = r.scorer; cur = 1 }
    if (curTeam === 'us') biggestFor = Math.max(biggestFor, cur)
    else biggestAgainst = Math.max(biggestAgainst, cur)
  }
  return { biggestFor, biggestAgainst, currentTeam: curTeam, currentLen: cur }
}

/** The dominant error subtype in the last `window` rallies (the "active leak"). */
export function activeLeak(rallies: R[], window = 6): { subtype: string | null; count: number } {
  const recent = rallies.slice(-window).filter(r => r.pointType === 'us_error')
  const counts: Record<string, number> = {}
  for (const r of recent) {
    const k = r.pointSubtype ?? 'other'
    counts[k] = (counts[k] ?? 0) + 1
  }
  let subtype: string | null = null, count = 0
  for (const [k, v] of Object.entries(counts)) if (v > count) { subtype = k; count = v }
  return { subtype, count }
}

// ── Closeout segments (start / middle / finish) ──────────────────────────────
export interface Segment { label: string; us: number; them: number; pct: number }
export function segments(rallies: R[]): Segment[] {
  const bands: { label: string; lo: number; hi: number }[] = [
    { label: '0–8', lo: 0, hi: 8 },
    { label: '9–16', lo: 9, hi: 16 },
    { label: '17+', lo: 17, hi: 999 },
  ]
  return bands.map(b => {
    const inBand = rallies.filter(r => {
      const m = Math.max(r.scoreUs, r.scoreThem)
      return m >= b.lo && m <= b.hi
    })
    const us = inBand.filter(r => r.scorer === 'us').length
    const them = inBand.filter(r => r.scorer === 'them').length
    return { label: b.label, us, them, pct: inBand.length ? us / inBand.length : 0 }
  })
}

// ── Time in lead & lead changes ──────────────────────────────────────────────
export function timeInLead(rallies: R[]): { pctLeading: number; leadChanges: number } {
  let leading = 0, changes = 0, prevSign = 0
  for (const r of rallies) {
    const d = r.scoreUs - r.scoreThem
    if (d > 0) leading++
    const sign = Math.sign(d)
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) changes++
    if (sign !== 0) prevSign = sign
  }
  return { pctLeading: rallies.length ? leading / rallies.length : 0, leadChanges: changes }
}

// ── Annotated scoring timeline ───────────────────────────────────────────────
export interface TimelinePoint {
  rally: number
  margin: number
  pos: number
  neg: number
  scorer: 'us' | 'them'
  /** category for the marker: ace|kill|block|oppErr|serve|reception|attack|other|theirPoint */
  cat: string | null
  servingTeam: 'us' | 'them'
}
export function scoringTimeline(rallies: R[]): TimelinePoint[] {
  return rallies.map(r => {
    const margin = r.scoreUs - r.scoreThem
    const cat = r.scorer === 'us'
      ? (r.pointType === 'them_error' ? 'oppErr' : (r.pointSubtype ?? 'kill'))
      : (r.pointType === 'us_error' ? (r.pointSubtype ?? 'other') : 'theirPoint')
    return {
      rally: r.rallyIndex + 1,
      margin,
      pos: Math.max(0, margin),
      neg: Math.min(0, margin),
      scorer: r.scorer,
      cat,
      servingTeam: r.servingTeam,
    }
  })
}

// ── Earned vs unforced (match quality) ───────────────────────────────────────
export function earnedVsUnforced(rallies: R[]): { winners: number; errors: number; winnerPct: number } {
  let winners = 0, errors = 0
  for (const r of rallies) {
    if (r.pointType === 'us_positive' || r.pointType === 'them_positive') winners++
    else errors++ // us_error or them_error
  }
  const total = winners + errors
  return { winners, errors, winnerPct: total ? winners / total : 0 }
}
