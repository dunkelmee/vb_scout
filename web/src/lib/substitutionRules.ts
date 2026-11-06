// Substitution & libero-replacement rules (FIVB) — shared by api and web.
// Keep api/src/lib/substitutionRules.ts and web/src/lib/substitutionRules.ts identical.

import type { Lineup, Zone } from './rotation'

/**
 * Ordering convention: a substitution's `rallyIndex` is the index of the last
 * completed rally before it was made, or NO_RALLY (-1) when it happened before
 * the first serve of the set.
 *
 * A rally's `rotationAfter` already includes every substitution made before
 * that rally, so the lineup on court right now is:
 *   (last rally's rotationAfter, or the starting lineup) + the substitutions
 *   logged since that rally.
 */
export const NO_RALLY = -1
export const MAX_SUBS_PER_SET = 6

const ZONES: Zone[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'zone6']
const BACK_ROW: Zone[] = ['zone1', 'zone5', 'zone6']

export interface SubEvent {
  rallyIndex: number
  playerOutId: string | null
  playerInId: string | null
  isLiberoSwap: boolean
}

export type SubErrorCode =
  | 'missing_player'
  | 'same_player'
  | 'player_out_not_on_court'
  | 'player_in_on_court'
  | 'player_in_not_in_roster'
  | 'player_replaced_by_libero'
  | 'no_rally_yet'
  | 'max_subs'
  | 'starter_already_left'
  | 'starter_already_returned'
  | 'starter_wrong_position'
  | 'sub_already_played'
  | 'sub_must_be_replaced_by_starter'
  | 'libero_already_on_court'
  | 'libero_front_row'
  | 'libero_cannot_serve'
  | 'libero_rally_between'
  | 'libero_wrong_return'

export const SUB_ERROR_MESSAGES: Record<SubErrorCode, string> = {
  missing_player:                  'Pick the player going off and the player coming on',
  same_player:                     'The player going off and coming on must be different',
  player_out_not_on_court:         'The player going off is not on court',
  player_in_on_court:              'The player coming on is already on court',
  player_in_not_in_roster:         'The player coming on is not on the roster for this game',
  player_replaced_by_libero:       'This player is replaced by the libero — swap the libero out first',
  no_rally_yet:                    'Before the first serve, change the lineup instead of substituting',
  max_subs:                        'Maximum of 6 substitutions in this set reached',
  starter_already_left:            'A starting player may only leave the court once per set',
  starter_already_returned:        'This starting player has already returned once in this set',
  starter_wrong_position:          'A starting player may only return in place of the player who replaced them',
  sub_already_played:              'A substitute may only enter once per set',
  sub_must_be_replaced_by_starter: 'A substitute can only be replaced by the starting player they replaced',
  libero_already_on_court:         'A libero is already on court',
  libero_front_row:                'The libero may only replace a back-row player (zones 1, 5, 6)',
  libero_cannot_serve:             'The libero cannot replace the server',
  libero_rally_between:            'There must be a completed rally between two libero replacements',
  libero_wrong_return:             'The libero can only be replaced by the player they replaced (or the other libero)',
}

export type SubValidation =
  | { ok: true; isLiberoSwap: boolean }
  | { ok: false; code: SubErrorCode; message: string }

export interface SubContext {
  /** Starting lineup of the set (zone → player). */
  startingLineup: Lineup
  /** Lineup on court right now (after all substitutions so far). */
  lineup: Lineup
  /** Team serving the next rally. */
  servingTeam: 'us' | 'them'
  /** rallyIndex of the last completed rally, or NO_RALLY. */
  lastRallyIndex: number
  /** All substitutions of this set so far, in the order they happened. */
  subs: SubEvent[]
  /** Players designated as libero for this game. */
  liberoIds: string[]
  /** Players on the roster for this game. */
  rosterIds: string[]
}

const fail = (code: SubErrorCode): SubValidation => ({ ok: false, code, message: SUB_ERROR_MESSAGES[code] })

/** Lineup zones only — strips extra keys such as `setPositions` from a stored lineup blob. */
export function zonesOnly(raw: unknown): Lineup {
  const src = (raw ?? {}) as Record<string, unknown>
  const out = {} as Lineup
  for (const z of ZONES) {
    if (typeof src[z] === 'string') out[z] = src[z] as string
  }
  return out
}

export function zoneOf(lineup: Lineup, playerId: string): Zone | undefined {
  return ZONES.find(z => lineup[z] === playerId)
}

/** Replace `playerOutId` with `playerInId` on court (no-op if `playerOutId` is not on court). */
export function applySub(lineup: Lineup, playerOutId: string | null, playerInId: string | null): Lineup {
  if (!playerOutId || !playerInId) return { ...lineup }
  const next = { ...lineup }
  for (const z of ZONES) {
    if (next[z] === playerOutId) next[z] = playerInId
  }
  return next
}

/** Lineup on court after applying the substitutions logged since the last rally. */
export function currentLineup(base: Lineup, lastRallyIndex: number, subs: SubEvent[]): Lineup {
  return subs
    .filter(s => s.rallyIndex === lastRallyIndex)
    .reduce((l, s) => applySub(l, s.playerOutId, s.playerInId), zonesOnly(base))
}

/** libero id → id of the player that libero is currently replacing. */
export function liberoReplacements(subs: SubEvent[], liberoIds: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const s of subs) {
    if (!s.isLiberoSwap || !s.playerOutId || !s.playerInId) continue
    const outIsLibero = liberoIds.includes(s.playerOutId)
    const inIsLibero  = liberoIds.includes(s.playerInId)
    if (inIsLibero && outIsLibero) {
      // Libero ↔ second libero: the replaced player carries over
      if (map[s.playerOutId]) map[s.playerInId] = map[s.playerOutId]
      delete map[s.playerOutId]
    } else if (inIsLibero) {
      map[s.playerInId] = s.playerOutId
    } else if (outIsLibero) {
      delete map[s.playerOutId]
    }
  }
  return map
}

/** Validate a substitution or libero replacement against the FIVB rules. */
export function validateSub(ctx: SubContext, playerOutId: string, playerInId: string): SubValidation {
  if (!playerOutId || !playerInId) return fail('missing_player')
  if (playerOutId === playerInId) return fail('same_player')

  const outZone = zoneOf(ctx.lineup, playerOutId)
  if (!outZone) return fail('player_out_not_on_court')
  if (zoneOf(ctx.lineup, playerInId)) return fail('player_in_on_court')
  if (!ctx.rosterIds.includes(playerInId)) return fail('player_in_not_in_roster')

  const outIsLibero = ctx.liberoIds.includes(playerOutId)
  const inIsLibero  = ctx.liberoIds.includes(playerInId)
  const replaced    = liberoReplacements(ctx.subs, ctx.liberoIds)

  // ── Libero replacement (rule 19.3) — unlimited, not counted as a substitution
  if (outIsLibero || inIsLibero) {
    const liberoSwapSinceLastRally = ctx.subs.some(s => s.isLiberoSwap && s.rallyIndex === ctx.lastRallyIndex)
    if (liberoSwapSinceLastRally) return fail('libero_rally_between')

    if (outIsLibero && inIsLibero) return { ok: true, isLiberoSwap: true } // libero ↔ second libero

    if (inIsLibero) {
      if (ZONES.some(z => ctx.lineup[z] && ctx.liberoIds.includes(ctx.lineup[z]))) return fail('libero_already_on_court')
      if (!BACK_ROW.includes(outZone)) return fail('libero_front_row')
      if (outZone === 'zone1' && ctx.servingTeam === 'us') return fail('libero_cannot_serve')
      return { ok: true, isLiberoSwap: true }
    }

    // Libero leaves: only the player they replaced may come back
    if (replaced[playerOutId] !== playerInId) return fail('libero_wrong_return')
    return { ok: true, isLiberoSwap: true }
  }

  // ── Regular substitution (rules 15.5–15.7)
  if (Object.values(replaced).includes(playerInId)) return fail('player_replaced_by_libero')
  if (ctx.lastRallyIndex === NO_RALLY) return fail('no_rally_yet')

  const regular = ctx.subs.filter(s => !s.isLiberoSwap)
  if (regular.length >= MAX_SUBS_PER_SET) return fail('max_subs')

  const starters = Object.values(zonesOnly(ctx.startingLineup)).filter(id => !ctx.liberoIds.includes(id))
  const inIsStarter  = starters.includes(playerInId)
  const outIsStarter = starters.includes(playerOutId)

  if (inIsStarter) {
    // A starter may re-enter once, and only in place of the player who replaced them
    if (regular.some(s => s.playerInId === playerInId)) return fail('starter_already_returned')
    const replacedBy = regular.find(s => s.playerOutId === playerInId)?.playerInId
    if (replacedBy !== playerOutId) return fail('starter_wrong_position')
    return { ok: true, isLiberoSwap: false }
  }

  // Player coming on is a substitute
  if (regular.some(s => s.playerInId === playerInId)) return fail('sub_already_played')
  if (!outIsStarter) return fail('sub_must_be_replaced_by_starter')
  if (regular.some(s => s.playerOutId === playerOutId)) return fail('starter_already_left')
  return { ok: true, isLiberoSwap: false }
}

/**
 * After a rotation, a libero who has rotated into the front row (zone 4) must
 * leave the court; the player they replaced comes back (rule 19.3.2).
 * Returns the forced replacement, or null when none is needed.
 */
export function liberoForcedExit(
  lineup: Lineup,
  subs: SubEvent[],
  liberoIds: string[],
): { playerOutId: string; playerInId: string } | null {
  const replaced = liberoReplacements(subs, liberoIds)
  for (const z of ZONES) {
    if (BACK_ROW.includes(z)) continue
    const id = lineup[z]
    if (id && liberoIds.includes(id) && replaced[id]) {
      return { playerOutId: id, playerInId: replaced[id] }
    }
  }
  return null
}

/** Validate a starting lineup: six different players and no libero (rule 19.3.1). */
export function validateStartingLineup(raw: unknown, liberoIds: string[]): string | null {
  const lineup = zonesOnly(raw)
  const ids = ZONES.map(z => lineup[z]).filter(Boolean)
  if (ids.length !== 6) return 'The starting lineup needs a player in all 6 zones'
  if (new Set(ids).size !== 6) return 'A player cannot be in two zones'
  if (ids.some(id => liberoIds.includes(id))) {
    return 'The libero is not part of the starting lineup — bring them in with a libero replacement'
  }
  return null
}
