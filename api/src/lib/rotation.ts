// Shared rotation logic (mirrors web/src/lib/rotation.ts)

export type Zone = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6'
export type Lineup = Record<Zone, string> // zone → player_id

/**
 * FIVB zone layout (top-down view):
 *        NET
 * ─────────────────────
 * │  4  │  3  │  2  │  ← front row
 * │─────│─────│─────│
 * │  5  │  6  │  1  │  ← back row
 * ─────────────────────
 *      OUR BASELINE
 *
 * Zone 1 = back right = server
 *
 * Clockwise rotation (FIVB): zone 2 → zone 1 (new server),
 * zone 3 → zone 2, …, zone 1 → zone 6.
 * Setter path through zones: 1 → 6 → 5 → 4 → 3 → 2 → 1
 * (traces clockwise when viewed from above with NET at top).
 */
export function rotate(lineup: Lineup): Lineup {
  return {
    zone1: lineup.zone2,   // zone-2 player steps to zone 1 and serves
    zone2: lineup.zone3,
    zone3: lineup.zone4,
    zone4: lineup.zone5,
    zone5: lineup.zone6,
    zone6: lineup.zone1,   // previous server drops to zone 6
  }
}

export interface PointResult {
  newLineup: Lineup
  rotated: boolean
  newServer: 'us' | 'them'
}

export function addPoint({
  scorer,
  currentServer,
  currentLineup,
}: {
  scorer: 'us' | 'them'
  currentServer: 'us' | 'them'
  currentLineup: Lineup
}): PointResult {
  if (scorer === 'us' && currentServer === 'them') {
    return { newLineup: rotate(currentLineup), rotated: true, newServer: 'us' }
  }
  if (scorer === 'us' && currentServer === 'us') {
    return { newLineup: currentLineup, rotated: false, newServer: 'us' }
  }
  if (scorer === 'them' && currentServer === 'us') {
    return { newLineup: currentLineup, rotated: false, newServer: 'them' }
  }
  // scorer === 'them' && currentServer === 'them'
  return { newLineup: currentLineup, rotated: false, newServer: 'them' }
}

/**
 * Identify rotation number from setter zone.
 * Rotation number = the zone the designated setter occupies.
 */
export function getRotationNumber(
  lineup: Lineup,
  setPositions: Record<string, string[]> | undefined,
  playerPositions: Record<string, string[]>
): number {
  // Use setPositions from startingLineup if available
  if (setPositions) {
    for (const [zone, posArr] of Object.entries(setPositions)) {
      if (Array.isArray(posArr) && posArr.includes('Setter')) {
        const zoneNum = parseInt(zone.replace('zone', ''), 10)
        if (!isNaN(zoneNum)) return zoneNum
      }
    }
  }

  // Fallback: find player with Setter in positions, prefer most specialised
  let bestZone = 1
  let bestPlayerPositionCount = Infinity

  for (const [zone, playerId] of Object.entries(lineup)) {
    const positions = playerPositions[playerId] || []
    if (positions.includes('Setter') && positions.length < bestPlayerPositionCount) {
      bestPlayerPositionCount = positions.length
      bestZone = parseInt(zone.replace('zone', ''), 10)
    }
  }

  return bestZone
}
