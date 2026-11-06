import prisma from './prisma'
import type { Lineup } from './rotation'
import { NO_RALLY, SubEvent, currentLineup, isGameLibero, zonesOnly } from './substitutionRules'

/**
 * Roster and libero ids for a match. Liberos are the players designated for
 * this game (see isGameLibero). Falls back to the whole team when the match
 * has no explicit roster (older games).
 */
export async function getMatchRoster(matchId: string, teamId: string) {
  const matchPlayers = await prisma.matchPlayer.findMany({
    where: { matchId },
    include: { player: { select: { id: true, positions: true } } },
  })
  const players = matchPlayers.length > 0
    ? matchPlayers.map(mp => ({ id: mp.player.id, libero: isGameLibero(mp.isLibero, mp.player.positions) }))
    : (await prisma.player.findMany({ where: { teamId }, select: { id: true, positions: true } }))
        .map(p => ({ id: p.id, libero: isGameLibero(null, p.positions) }))

  return {
    rosterIds: players.map(p => p.id),
    liberoIds: players.filter(p => p.libero).map(p => p.id),
  }
}

/**
 * Everything needed to validate a substitution or compute the next rally:
 * the lineup currently on court (last rally + substitutions since), who serves
 * next, and the set's substitution history.
 */
export async function loadSetState(setId: string) {
  const set = await prisma.set.findUnique({
    where: { id: setId },
    include: {
      match: { select: { id: true, teamId: true } },
      rallies: { orderBy: { rallyIndex: 'desc' }, take: 1 },
      substitutions: { orderBy: [{ rallyIndex: 'asc' }, { loggedAt: 'asc' }] },
    },
  })
  if (!set) return null

  const lastRally = set.rallies[0] ?? null
  const lastRallyIndex = lastRally ? lastRally.rallyIndex : NO_RALLY
  const subs: SubEvent[] = set.substitutions.map(s => ({
    rallyIndex: s.rallyIndex,
    playerOutId: s.playerOutId,
    playerInId: s.playerInId,
    isLiberoSwap: s.isLiberoSwap,
  }))

  const startingLineup = zonesOnly(set.startingLineup)
  const base: Lineup = lastRally ? zonesOnly(lastRally.rotationAfter) : startingLineup
  const lineup = currentLineup(base, lastRallyIndex, subs)
  const servingTeam = (lastRally ? lastRally.currentServer : set.servingFirst) as 'us' | 'them'

  return { set, lastRally, lastRallyIndex, subs, startingLineup, lineup, servingTeam }
}
