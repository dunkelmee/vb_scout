// Post-match statistics computation (server-side)

interface Rally {
  scorer: string
  pointType: string
  scoreUs: number
  scoreThem: number
  servingTeam: string
  rotationAfter: Record<string, string>
  rotated: boolean
  rallyIndex: number
}

interface SetStats {
  sideoutPct: number
  breakPct: number
  errorRatio: number
  positivePlayPct: number
  totalRallies: number
  pointsUs: number
  pointsThem: number
  errorsUs: number
  errorsThem: number
}

interface RotationStat {
  rotation: number
  wins: number
  losses: number
  breakPct: number
  sideoutPct: number
  netPct: number
  rallies: number
}

export function computeSetStats(rallies: Rally[]): SetStats {
  const total = rallies.length
  if (total === 0) {
    return { sideoutPct: 0, breakPct: 0, errorRatio: 0, positivePlayPct: 0, totalRallies: 0, pointsUs: 0, pointsThem: 0, errorsUs: 0, errorsThem: 0 }
  }

  const receivingRallies = rallies.filter(r => r.servingTeam === 'them')
  const servingRallies = rallies.filter(r => r.servingTeam === 'us')

  const sideouts = receivingRallies.filter(r => r.scorer === 'us').length
  const breakPoints = servingRallies.filter(r => r.scorer === 'us').length

  const sideoutPct = receivingRallies.length > 0 ? sideouts / receivingRallies.length : 0
  const breakPct = servingRallies.length > 0 ? breakPoints / servingRallies.length : 0

  const theirPoints = rallies.filter(r => r.scorer === 'them')
  const theirErrorPoints = theirPoints.filter(r => r.pointType === 'us_error' || r.pointType === 'them_positive' )
  const errorRatio = theirPoints.length > 0 ? theirErrorPoints.length / theirPoints.length : 0

  const ourPoints = rallies.filter(r => r.scorer === 'us')
  const positivePoints = ourPoints.filter(r => r.pointType === 'us_positive').length
  const positivePlayPct = ourPoints.length > 0 ? positivePoints / ourPoints.length : 0

  const pointsUs = ourPoints.length
  const pointsThem = theirPoints.length
  const errorsUs = rallies.filter(r => r.pointType === 'us_error').length
  const errorsThem = rallies.filter(r => r.pointType === 'them_error').length

  return { sideoutPct, breakPct, errorRatio, positivePlayPct, totalRallies: total, pointsUs, pointsThem, errorsUs, errorsThem }
}

export function computeRotationStats(
  rallies: Rally[],
  setterZoneByRally: number[]
): RotationStat[] {
  const rotStats: Map<number, RotationStat> = new Map()

  for (let rot = 1; rot <= 6; rot++) {
    rotStats.set(rot, { rotation: rot, wins: 0, losses: 0, breakPct: 0, sideoutPct: 0, netPct: 0, rallies: 0 })
  }

  rallies.forEach((rally, idx) => {
    const rot = setterZoneByRally[idx] || 1
    const stat = rotStats.get(rot)!
    stat.rallies++
    if (rally.scorer === 'us') {
      stat.wins++
    } else {
      stat.losses++
    }
  })

  // Compute per-rotation break% and sideout%
  for (let rot = 1; rot <= 6; rot++) {
    const rotRallies = rallies.filter((r, idx) => setterZoneByRally[idx] === rot)
    const serving = rotRallies.filter(r => r.servingTeam === 'us')
    const receiving = rotRallies.filter(r => r.servingTeam === 'them')

    const stat = rotStats.get(rot)!
    stat.breakPct = serving.length > 0 ? serving.filter(r => r.scorer === 'us').length / serving.length : 0
    stat.sideoutPct = receiving.length > 0 ? receiving.filter(r => r.scorer === 'us').length / receiving.length : 0
    stat.netPct = stat.rallies > 0 ? stat.wins / stat.rallies : 0
  }

  return Array.from(rotStats.values())
}

export function computeErrorClustering(rallies: Rally[]): number {
  // Wald-Wolfowitz runs test for error clustering
  const sequence = rallies.map(r =>
    r.pointType === 'us_error' || r.pointType === 'them_positive' ? 1 : 0
  )

  const n1 = sequence.filter(x => x === 1).length
  const n0 = sequence.filter(x => x === 0).length

  if (n1 < 5 || n0 < 5) return -1

  let runs = 1
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i - 1]) runs++
  }

  const n = n1 + n0
  const ER = (2 * n1 * n0) / n + 1
  const VR = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1))

  if (VR <= 0) return 0

  const Z = (runs - ER) / Math.sqrt(VR)
  return Math.min(1.0, Math.max(0.0, -Z / 3))
}

export function computePointQuality(rallies: Rally[]): {
  positivePlayPct: number
  errorForcedLossPct: number
  breakQuality: number
  sideoutQuality: number
  benchmark: string
} {
  const ourPoints = rallies.filter(r => r.scorer === 'us')
  const positivePlayPct = ourPoints.length > 0
    ? ourPoints.filter(r => r.pointType === 'us_positive').length / ourPoints.length
    : 0

  const theirPoints = rallies.filter(r => r.scorer === 'them')
  const errorForcedLossPct = theirPoints.length > 0
    ? theirPoints.filter(r => r.pointType === 'us_error').length / theirPoints.length
    : 0

  const servingRallies = rallies.filter(r => r.servingTeam === 'us')
  const receivingRallies = rallies.filter(r => r.servingTeam === 'them')

  const breakQuality = servingRallies.filter(r => r.scorer === 'us' && r.pointType === 'us_positive').length /
    Math.max(1, servingRallies.filter(r => r.scorer === 'us').length)

  const sideoutQuality = receivingRallies.filter(r => r.scorer === 'us' && r.pointType === 'us_positive').length /
    Math.max(1, receivingRallies.filter(r => r.scorer === 'us').length)

  let benchmark = 'Error-dependent'
  if (positivePlayPct >= 0.6) benchmark = 'Assertive'
  else if (positivePlayPct >= 0.4) benchmark = 'Balanced'

  return { positivePlayPct, errorForcedLossPct, breakQuality, sideoutQuality, benchmark }
}
