// Wald-Wolfowitz runs test for error clustering (client-side)

export interface Rally {
  pointType: string
  scorer: string
}

export function waldWolfowitz(sequence: number[]): number {
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

export function errorSequenceFromRallies(rallies: Rally[]): number[] {
  return rallies.map(r =>
    r.pointType === 'us_error' || r.pointType === 'them_positive' ? 1 : 0
  )
}
