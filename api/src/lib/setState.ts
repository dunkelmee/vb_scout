import prisma from './prisma'
import type { Lineup } from './rotation'
import { NO_RALLY, SubEvent, currentLineup, zonesOnly } from './substitutionRules'

/**
 * Roster and libero ids for a match. Falls back to the whole team when the
 * match has no explicit roster (older games).
 */
export async function getMatchRoster(matchId: string, teamId: string) {
  const matchPlayers = await prisma.matchPlayer.findMany({
    where: { matchId },
    include: { player: { select: { id: true, isLibero: true } } },
  })
  const players = matchPlayers.length > 0
    ? matchPlayers.map(mp => mp.player)
    : await prisma.player.findMany({ where: { teamId }, select: { id: true, isLibero: true } })

  return {
    rosterIds: players.map(p => p.id),
    liberoIds: players.filter(p => p.isLibero).map(p => p.id),
  }
}

/** Libero ids among the given players (used to validate a starting lineup). */
export async function getLiberoIds(playerIds: string[]) {
  if (playerIds.length === 0) return []
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, isLibero: true },
    select: { id: true },
  })
  return players.map(p => p.id)
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
