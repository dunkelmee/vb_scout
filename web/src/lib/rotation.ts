// Shared rotation logic — mirrors api/src/lib/rotation.ts

export type Zone = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6'
export type Lineup = Record<Zone, string> // zone → player_id

export const ALL_ZONES: Zone[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'zone6']

/**
 * FIVB zone layout (top-down view of our side):
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
 * Setter path: 1 → 6 → 5 → 4 → 3 → 2 → 1
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
  return { newLineup: currentLineup, rotated: false, newServer: 'them' }
}

export function getRotationNumber(
  lineup: Lineup,
  setPositions?: Record<string, string[]>
): number {
  // Use setPositions first
  if (setPositions) {
    for (const [zone, posArr] of Object.entries(setPositions)) {
      if (Array.isArray(posArr) && posArr.includes('Setter')) {
        return parseInt(zone.replace('zone', ''), 10)
      }
    }
  }
  return 1
}

// Back-row zones
export const BACK_ROW_ZONES: Zone[] = ['zone1', 'zone5', 'zone6']
export const FRONT_ROW_ZONES: Zone[] = ['zone2', 'zone3', 'zone4']

export function isBackRow(zone: Zone): boolean {
  return BACK_ROW_ZONES.includes(zone)
}

// Zone positions for SVG rendering
export const ZONE_POSITIONS: Record<Zone, { x: number; y: number }> = {
  zone4: { x: 16.67, y: 25 },
  zone3: { x: 50, y: 25 },
  zone2: { x: 83.33, y: 25 },
  zone5: { x: 16.67, y: 75 },
  zone6: { x: 50, y: 75 },
  zone1: { x: 83.33, y: 75 },
}
