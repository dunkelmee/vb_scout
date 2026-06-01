import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { computeErrorClustering } from '../lib/statistics'

const router = Router()

// GET /api/dashboard — dashboard KPIs + upcoming games + trainings
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId!
    const now = new Date()

    // Active season
    const activeSeason = await prisma.season.findFirst({
      where: { teamId, isActive: true },
    })

    // KPIs scoped to active season
    const matchFilter = activeSeason
      ? { teamId, seasonId: activeSeason.id, status: 'completed' }
      : { teamId, status: 'completed' }

    const matches = await prisma.match.findMany({
      where: matchFilter as Record<string, unknown>,
      include: { sets: true },
      orderBy: { date: 'desc' },
    })

    const totalMatches = matches.length
    const wins = matches.filter(m => m.setsWonUs > m.setsWonThem).length
    const losses = totalMatches - wins
    const totalSetsWon = matches.reduce((s, m) => s + m.setsWonUs, 0)
    const totalSetsLost = matches.reduce((s, m) => s + m.setsWonThem, 0)

    let totalPointsUs = 0
    let totalPointsThem = 0
    for (const m of matches) {
      totalPointsUs += m.sets.reduce((s, set) => s + set.scoreUs, 0)
      totalPointsThem += m.sets.reduce((s, set) => s + set.scoreThem, 0)
    }

    // Upcoming games
    const upcomingGames = await prisma.match.findMany({
      where: { teamId, date: { gte: now }, status: 'upcoming' },
      orderBy: { date: 'asc' },
      take: 5,
      include: {
        matchPlayers: { include: { player: { select: { id: true, firstName: true, lastName: true, jersey: true } } } },
        ref1: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        ref2: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        scorer1: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        scorer2: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    })

    // Upcoming trainings
    const upcomingTrainings = await prisma.trainingSession.findMany({
      where: { teamId, date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 5,
      include: {
        trainingAttendance: { select: { status: true, playerId: true } },
      },
    })

    // Recent analysis (manager only)
    let recentAnalysis = null
    if (req.user!.role === 'manager') {
      const recent = await prisma.matchAnalysis.findFirst({
        where: { status: 'ready', match: { teamId } },
        orderBy: { updatedAt: 'desc' },
        include: { match: { select: { id: true, opponent: true, date: true } } },
      })
      if (recent) {
        const insights = recent.insights as { strengths?: unknown[]; weaknesses?: unknown[]; action_items?: unknown[] } | null
        recentAnalysis = {
          matchId: recent.matchId,
          matchOpponent: recent.match.opponent,
          matchDate: recent.match.date,
          topStrength: insights?.strengths?.[0] || null,
          topWeakness: insights?.weaknesses?.[0] || null,
          topAction: insights?.action_items?.[0] || null,
        }
      }
    }

    // Per-match performance stats for trend chart
    const recentMatches = await prisma.match.findMany({
      where: matchFilter as Record<string, unknown>,
      orderBy: { date: 'asc' },
      include: {
        sets: {
          orderBy: { setNumber: 'asc' },
          include: { rallies: { orderBy: { rallyIndex: 'asc' } } },
        },
      },
    })

    const winLossTrend = recentMatches.map(m => {
      const allRallies = m.sets.flatMap(s => s.rallies)
      const receive = allRallies.filter(r => r.servingTeam === 'them')
      const serve = allRallies.filter(r => r.servingTeam === 'us')
      return {
        id: m.id,
        date: m.date,
        opponent: m.opponent,
        opponentInitials: m.opponentInitials,
        setsWon: m.setsWonUs,
        setsLost: m.setsWonThem,
        result: m.setsWonUs > m.setsWonThem ? 'W' as const : 'L' as const,
        sideoutPct: receive.length > 0 ? receive.filter(r => r.scorer === 'us').length / receive.length : null,
        breakPct: serve.length > 0 ? serve.filter(r => r.scorer === 'us').length / serve.length : null,
        errorRatio: allRallies.length > 0
          ? allRallies.filter(r => r.pointType === 'us_error' || r.pointType === 'them_positive').length / allRallies.length
          : null,
      }
    })

    // Season-wide performance averages
    const allRallies = recentMatches.flatMap(m => m.sets.flatMap(s => s.rallies))
    let seasonPerf = null
    if (allRallies.length > 0) {
      const receive = allRallies.filter(r => r.servingTeam === 'them')
      const serve = allRallies.filter(r => r.servingTeam === 'us')
      seasonPerf = {
        sideoutPct: Math.round(receive.length > 0 ? receive.filter(r => r.scorer === 'us').length / receive.length * 100 : 0),
        breakPct: Math.round(serve.length > 0 ? serve.filter(r => r.scorer === 'us').length / serve.length * 100 : 0),
        errorRatio: Math.round(allRallies.filter(r => r.pointType === 'us_error' || r.pointType === 'them_positive').length / allRallies.length * 100) / 100,
      }
    }

    // Weakest rotation (position-based, cycling through 6 slots per set)
    const rotWins = new Array<number>(6).fill(0)
    const rotLosses = new Array<number>(6).fill(0)
    for (const m of recentMatches) {
      for (const set of m.sets) {
        let rot = 0
        for (const rally of set.rallies) {
          const idx = rot % 6
          if (rally.scorer === 'us') rotWins[idx]++
          else rotLosses[idx]++
          if (rally.rotated) rot++
        }
      }
    }
    let weakestRotation: { rotation: number; winPct: number } | null = null
    let worstPct = Infinity
    for (let i = 0; i < 6; i++) {
      const total = rotWins[i] + rotLosses[i]
      if (total < 5) continue
      const pct = rotWins[i] / total
      if (pct < worstPct) {
        worstPct = pct
        weakestRotation = { rotation: i + 1, winPct: Math.round(pct * 100) }
      }
    }

    res.json({
      activeSeason,
      kpis: {
        matchRecord: { wins, losses },
        setRecord: { wins: totalSetsWon, losses: totalSetsLost },
        points: { us: totalPointsUs, them: totalPointsThem },
        totalMatches,
      },
      upcomingGames,
      upcomingTrainings,
      recentAnalysis,
      winLossTrend,
      seasonPerf,
      weakestRotation,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch dashboard' })
  }
})

// GET /api/season-performance — per-match detail data for the season performance detail view
router.get('/season-performance', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId!

    const activeSeason = await prisma.season.findFirst({
      where: { teamId, isActive: true },
    })

    const matchFilter = activeSeason
      ? { teamId, seasonId: activeSeason.id, status: 'completed', matchType: 'playing' }
      : { teamId, status: 'completed', matchType: 'playing' }

    const matches = await prisma.match.findMany({
      where: matchFilter as Record<string, unknown>,
      orderBy: { date: 'asc' },
      include: {
        sets: {
          orderBy: { setNumber: 'asc' },
          include: { rallies: { orderBy: { rallyIndex: 'asc' } } },
        },
      },
    })

    const matchData = matches.map(m => {
      const allRallies = m.sets.flatMap((s: { rallies: unknown[] }) => s.rallies) as Array<{
        scorer: string; pointType: string; servingTeam: string; rotated: boolean
      }>

      const receive = allRallies.filter(r => r.servingTeam === 'them')
      const serve   = allRallies.filter(r => r.servingTeam === 'us')
      const ourPoints = allRallies.filter(r => r.scorer === 'us')

      const sideoutPct    = receive.length > 0 ? receive.filter(r => r.scorer === 'us').length / receive.length : 0
      const breakPct      = serve.length   > 0 ? serve.filter(r => r.scorer === 'us').length / serve.length : 0
      const positivePlayPct = ourPoints.length > 0
        ? ourPoints.filter(r => r.pointType === 'us_positive').length / ourPoints.length : 0
      const errorRatio    = allRallies.length > 0
        ? allRallies.filter(r => r.pointType === 'us_error' || r.pointType === 'them_positive').length / allRallies.length
        : 0

      const clusteringRaw = computeErrorClustering(allRallies as Parameters<typeof computeErrorClustering>[0])
      const errorClustering = clusteringRaw >= 0 ? clusteringRaw : null

      const pointsUs   = m.sets.reduce((s: number, set: { scoreUs: number }) => s + set.scoreUs, 0)
      const pointsThem = m.sets.reduce((s: number, set: { scoreThem: number }) => s + set.scoreThem, 0)

      // Per-rotation win rates using the same sequential counter as the dashboard
      const rotWins  = new Array<number>(6).fill(0)
      const rotTotal = new Array<number>(6).fill(0)
      for (const set of m.sets as Array<{ rallies: Array<{ scorer: string; rotated: boolean }> }>) {
        let rot = 0
        for (const rally of set.rallies) {
          const idx = rot % 6
          rotTotal[idx]++
          if (rally.scorer === 'us') rotWins[idx]++
          if (rally.rotated) rot++
        }
      }
      const rotations = Array.from({ length: 6 }, (_, i) => ({
        rotation: i + 1,
        winPct: rotTotal[i] >= 3 ? Math.round(rotWins[i] / rotTotal[i] * 100) : null,
      }))

      return {
        id: m.id,
        opponent: m.opponent,
        opponentInitials: m.opponentInitials,
        date: m.date,
        result: (m.setsWonUs > m.setsWonThem ? 'W' : 'L') as 'W' | 'L',
        setsWon: m.setsWonUs,
        setsLost: m.setsWonThem,
        pointsUs,
        pointsThem,
        sideoutPct,
        breakPct,
        positivePlayPct,
        errorRatio,
        errorClustering,
        rotations,
      }
    })

    const totalWins      = matchData.filter(m => m.result === 'W').length
    const totalPointsUs  = matchData.reduce((s, m) => s + m.pointsUs, 0)
    const totalPointsThem = matchData.reduce((s, m) => s + m.pointsThem, 0)
    const totalSetsWon   = matchData.reduce((s, m) => s + m.setsWon, 0)
    const totalSetsLost  = matchData.reduce((s, m) => s + m.setsLost, 0)

    res.json({
      seasonName:  activeSeason?.name ?? null,
      matchCount:  matchData.length,
      record:      { wins: totalWins, losses: matchData.length - totalWins },
      setsRecord:  { wins: totalSetsWon, losses: totalSetsLost },
      pointsUs:    totalPointsUs,
      pointsThem:  totalPointsThem,
      matches:     matchData,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch season performance' })
  }
})

// GET /api/training-priorities — get team's active priorities (manager only)
router.get('/training-priorities', requireManager, async (req: Request, res: Response) => {
  try {
    const priorities = await prisma.trainingPriority.findMany({
      where: { teamId: req.user!.teamId!, status: { not: 'dismissed' } },
      orderBy: { createdAt: 'desc' },
      include: {
        outcomes: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        sourceMatch: { select: { id: true, opponent: true, date: true } },
      },
    })
    res.json(priorities)
  } catch {
    res.status(500).json({ error: 'Failed to fetch priorities' })
  }
})

// PATCH /api/training-priorities/:id — update priority note/status (manager only)
router.patch('/training-priorities/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  const { note, status } = req.body

  try {
    const existing = await prisma.trainingPriority.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!existing) return res.status(404).json({ error: 'Priority not found' })

    const priority = await prisma.trainingPriority.update({
      where: { id },
      data: {
        ...(note !== undefined && { note }),
        ...(status && { status }),
      },
    })
    res.json(priority)
  } catch {
    res.status(500).json({ error: 'Failed to update priority' })
  }
})

export default router
