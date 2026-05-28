import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

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

    // Win/loss trend for charts
    const recentMatches = await prisma.match.findMany({
      where: matchFilter as Record<string, unknown>,
      orderBy: { date: 'asc' },
      take: 10,
      include: { sets: { select: { scoreUs: true, scoreThem: true, setNumber: true } } },
    })

    const winLossTrend = recentMatches.map(m => ({
      id: m.id,
      date: m.date,
      opponent: m.opponent,
      setsWon: m.setsWonUs,
      setsLost: m.setsWonThem,
      result: m.setsWonUs > m.setsWonThem ? 'W' : 'L',
    }))

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
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch dashboard' })
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
