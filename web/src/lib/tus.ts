// Timeout Urgency Score computation (client-side)
import { waldWolfowitz } from './clustering'

export interface RallyForTUS {
  scorer: 'us' | 'them'
  pointType: string
  scoreUs: number
  scoreThem: number
}

export interface TUSWeights {
  momentum: number
  error: number
  leadDeficit: number
  positive: number
}

export const DEFAULT_TUS_WEIGHTS: TUSWeights = {
  momentum: 0.30,
  error: 0.25,
  leadDeficit: 0.25,
  positive: 0.20,
}

export interface TUSResult {
  tus: number
  momentum: number
  error: number
  leadDeficit: number
  positive: number
  label: TUSLabel
  color: TUSColor
  building: boolean
}

export type TUSLabel = 'Stable' | 'Watch' | 'Consider timeout' | 'Call timeout now'
export type TUSColor = 'green' | 'amber' | 'orange' | 'red'

export function getTUSLabel(tus: number): { label: TUSLabel; color: TUSColor } {
  if (tus <= 0.30) return { label: 'Stable', color: 'green' }
  if (tus <= 0.55) return { label: 'Watch', color: 'amber' }
  if (tus <= 0.75) return { label: 'Consider timeout', color: 'orange' }
  return { label: 'Call timeout now', color: 'red' }
}

export function computeTUS(
  ralliesWindow: RallyForTUS[],
  currentScoreUs: number,
  currentScoreThem: number,
  weights: TUSWeights = DEFAULT_TUS_WEIGHTS
): TUSResult {
  const n = ralliesWindow.length
  const building = n < 6

  if (n === 0) {
    return {
      tus: 0.5, momentum: 0.5, error: 0, leadDeficit: 0, positive: 0.5,
      ...getTUSLabel(0.5), building,
    }
  }

  // Signal 1 — Momentum (30%)
  const ourPts = ralliesWindow.filter(r => r.scorer === 'us').length
  const theirPts = n - ourPts
  const momentumRaw = (ourPts - theirPts) / n
  const momentumSignal = 1 - ((momentumRaw + 1) / 2)

  // Signal 2 — Error ratio (25%)
  const errors = ralliesWindow.map(r =>
    r.pointType === 'us_error' || r.pointType === 'them_positive' ? 1 : 0
  )
  const rollingErrors = errors.reduce((a: number, b: number) => a + b, 0)
  const clusteringIndex = Math.max(0, waldWolfowitz(errors))
  const errorSignal = 0.5 * (rollingErrors / n) + 0.5 * clusteringIndex

  // Signal 3 — Lead/deficit (25%)
  const deficit = Math.max(0, currentScoreThem - currentScoreUs) / 10
  const deficitTrend = (currentScoreThem - currentScoreUs) / 10
  const deficitTrendNorm = Math.max(0, Math.min(1, (deficitTrend + 1) / 2))
  const leadDeficitSignal = 0.5 * deficit + 0.5 * deficitTrendNorm

  // Signal 4 — Positive play trend (20%)
  const positivePts = ralliesWindow.filter(r => r.pointType === 'us_positive').length
  const trendRaw = (positivePts / n - 0.5) * 2
  const positiveSignal = Math.max(0, Math.min(1, trendRaw / 0.5 + 0.5))

  const tus = Math.max(0, Math.min(1,
    weights.momentum * momentumSignal +
    weights.error * errorSignal +
    weights.leadDeficit * leadDeficitSignal +
    weights.positive * positiveSignal
  ))

  const { label, color } = getTUSLabel(tus)

  return {
    tus,
    momentum: momentumSignal,
    error: errorSignal,
    leadDeficit: leadDeficitSignal,
    positive: positiveSignal,
    label,
    color,
    building,
  }
}
