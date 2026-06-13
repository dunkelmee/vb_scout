import prisma from './prisma'
import { sendPushToTeam } from './push'

export async function notifyAnalysisReady(matchId: string, teamId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return

  await sendPushToTeam(teamId, {
    title: 'Match analysis ready',
    body:  `Your post-match analysis vs ${match.opponent ?? 'opponent'} is ready to view`,
    url:   `/games/${matchId}/stats`,
    tag:   `analysis-${matchId}`,
  }, {
    roles:          ['manager'],
    notifPrefField: 'notifAnalysisReady',
  })
}
