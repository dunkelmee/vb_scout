// Live match statistics computation (client-side)
import { waldWolfowitz, errorSequenceFromRallies } from './clustering'

export interface LiveRally {
  scorer: 'us' | 'them'
  pointType: string
  scoreUs: number
  scoreThem: number
  servingTeam: 'us' | 'them'
  rotationAfter: Record<string, string>
  rotated: boolean
  rallyIndex: number
}

export interface LiveStats {
  sideoutPct: number
  breakPct: number
  errorRatioRolling: number
  errorRatioCumulative: number
  clusteringIndex: number
  clusteringLabel: string
  positivePlayPct: number
  pointsUs: number
  pointsThem: number
  errorsUs: number
  errorsThem: number
  rotationStats: RotationStat[]
  totalRallies: number
}

export interface RotationStat {
  rotation: number
  wins: number
  losses: number
  serveRate: number
  receiveRate: number
}

export function computeLiveStats(rallies: LiveRally[], window = 6, setterPlayerId?: string): LiveStats {
  const total = rallies.length
  if (total === 0) {
    return {
      sideoutPct: 0, breakPct: 0, errorRatioRolling: 0, errorRatioCumulative: 0,
      clusteringIndex: -1, clusteringLabel: 'N/A', positivePlayPct: 0,
      pointsUs: 0, pointsThem: 0, errorsUs: 0, errorsThem: 0,
      rotationStats: Array.from({ length: 6 }, (_, i) => ({
        rotation: i + 1, wins: 0, losses: 0, serveRate: 0, receiveRate: 0,
      })),
      totalRallies: 0,
    }
  }

  const receiveRallies = rallies.filter(r => r.servingTeam === 'them')
  const serveRallies = rallies.filter(r => r.servingTeam === 'us')
  const ourRallies = rallies.filter(r => r.scorer === 'us')
  const theirRallies = rallies.filter(r => r.scorer === 'them')

  const sideouts = receiveRallies.filter(r => r.scorer === 'us').length
  const breaks = serveRallies.filter(r => r.scorer === 'us').length

  const sideoutPct = receiveRallies.length > 0 ? sideouts / receiveRallies.length : 0
  const breakPct = serveRallies.length > 0 ? breaks / serveRallies.length : 0

  const theirErrors = theirRallies.filter(r => r.pointType === 'us_error').length
  const ourErrors = rallies.filter(r => r.pointType === 'us_error').length

  // Rolling error ratio (last `window` rallies)
  const rollingRallies = rallies.slice(-window)
  const rollingErrors = rollingRallies.filter(r =>
    r.pointType === 'us_error' || r.pointType === 'them_positive'
  ).length
  const errorRatioRolling = rollingRallies.length > 0 ? rollingErrors / rollingRallies.length : 0

  // Cumulative error ratio
  const cumErrors = rallies.filter(r =>
    r.pointType === 'us_error' || r.pointType === 'them_positive'
  ).length
  const errorRatioCumulative = total > 0 ? cumErrors / total : 0

  // Error clustering
  const errSeq = errorSequenceFromRallies(rallies.map(r => ({ pointType: r.pointType, scorer: r.scorer })))
  const clusteringIndex = waldWolfowitz(errSeq)
  const clusteringLabel = clusteringIndex === -1
    ? 'Insufficient data'
    : clusteringIndex >= 0.5
      ? 'Clear burst pattern'
      : clusteringIndex >= 0.25
        ? 'Moderate clustering'
        : 'Random distribution'

  const positivePlayPct = ourRallies.length > 0
    ? ourRallies.filter(r => r.pointType === 'us_positive').length / ourRallies.length
    : 0

  // Rotation stats
  // For each rally, determine which rotation was *on court during* the rally.
  // When rotated=true the rotation was applied after the point was decided, so
  // the during-rally lineup is the *previous* rally's rotationAfter.
  // When rotated=false the lineup didn't change, so rotationAfter == rotationDuring.
  const setterZoneByRally: number[] = rallies.map((r, i) => {
    if (!setterPlayerId) return 1
    const rotDuring =
      r.rotated && i > 0 ? rallies[i - 1].rotationAfter : r.rotationAfter
    const entry = Object.entries(rotDuring).find(([, id]) => id === setterPlayerId)
    return entry ? parseInt(entry[0].replace('zone', ''), 10) : 1
  })

  const rotMap: Map<number, { wins: number; losses: number; serve: number[]; receive: number[] }> = new Map()
  for (let i = 1; i <= 6; i++) {
    rotMap.set(i, { wins: 0, losses: 0, serve: [], receive: [] })
  }

  rallies.forEach((r, i) => {
    const rotation = setterZoneByRally[i]
    const rot = rotMap.get(rotation) ?? rotMap.get(1)!
    if (r.scorer === 'us') rot.wins++; else rot.losses++
    if (r.servingTeam === 'us') rot.serve.push(r.scorer === 'us' ? 1 : 0)
    else rot.receive.push(r.scorer === 'us' ? 1 : 0)
  })

  const rotationStats: RotationStat[] = Array.from({ length: 6 }, (_, i) => {
    const rot = rotMap.get(i + 1)!
    const serveRate = rot.serve.length > 0 ? rot.serve.reduce((a, b) => a + b, 0) / rot.serve.length : 0
    const receiveRate = rot.receive.length > 0 ? rot.receive.reduce((a, b) => a + b, 0) / rot.receive.length : 0
    return { rotation: i + 1, wins: rot.wins, losses: rot.losses, serveRate, receiveRate }
  })

  return {
    sideoutPct, breakPct, errorRatioRolling, errorRatioCumulative,
    clusteringIndex, clusteringLabel, positivePlayPct,
    pointsUs: ourRallies.length, pointsThem: theirRallies.length,
    errorsUs: ourErrors, errorsThem: theirErrors,
    rotationStats, totalRallies: total,
  }
}
