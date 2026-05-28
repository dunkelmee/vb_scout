import prisma from './prisma'

export async function getSeasonStats(seasonId: string, teamId: string) {
  const matches = await prisma.match.findMany({
    where: { seasonId, teamId, status: 'completed' },
    include: { sets: { include: { rallies: true } } },
  })

  const totalMatches = matches.length
  const wins = matches.filter(m => m.setsWonUs > m.setsWonThem).length
  const losses = totalMatches - wins

  let totalSetsWon = 0
  let totalSetsLost = 0
  let totalPointsUs = 0
  let totalPointsThem = 0

  for (const match of matches) {
    totalSetsWon += match.setsWonUs
    totalSetsLost += match.setsWonThem
    for (const set of match.sets) {
      totalPointsUs += set.scoreUs
      totalPointsThem += set.scoreThem
    }
  }

  return {
    totalMatches,
    wins,
    losses,
    totalSetsWon,
    totalSetsLost,
    totalPointsUs,
    totalPointsThem,
  }
}
