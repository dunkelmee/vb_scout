import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'
import { computeSetStats, computeRotationStats, computeErrorClustering, computePointQuality } from '../lib/statistics'

const router = Router()

const ANALYSIS_SERVICE_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8001'

// GET /api/games — list matches
router.get('/', async (req: Request, res: Response) => {
  const { type, seasonId, status } = req.query
  try {
    const matches = await prisma.match.findMany({
      where: {
        teamId: req.user!.teamId!,
        ...(type && { matchType: type as string }),
        ...(seasonId && { seasonId: seasonId as string }),
        ...(status && { status: status as string }),
      },
      include: {
        matchPlayers: { include: { player: { select: { id: true, firstName: true, lastName: true, jersey: true } } } },
        sets: { select: { id: true, setNumber: true, scoreUs: true, scoreThem: true, status: true } },
      },
      orderBy: { date: 'desc' },
    })
    res.json(matches)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch matches' })
  }
})

// POST /api/games — create match (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const {
    matchType, opponent, opponentInitials, homeTeam, guestTeam,
    date, location, firstServe, seasonId,
    playerIds, startingLineup,
    ref1Id, ref2Id, scorer1Id, scorer2Id,
  } = req.body

  if (!date) return res.status(400).json({ error: 'date is required' })

  try {
    const match = await prisma.$transaction(async (tx) => {
      const m = await tx.match.create({
        data: {
          teamId: req.user!.teamId!,
          seasonId: seasonId || undefined,
          matchType: matchType || 'playing',
          opponent,
          opponentInitials,
          homeTeam,
          guestTeam,
          date: new Date(date),
          location,
          firstServe: firstServe || 'us',
          ref1Id, ref2Id, scorer1Id, scorer2Id,
          status: 'upcoming',
        },
      })

      // Add players to match
      if (playerIds && playerIds.length > 0) {
        await tx.matchPlayer.createMany({
          data: playerIds.map((pid: string) => ({ matchId: m.id, playerId: pid })),
          skipDuplicates: true,
        })
      }

      // Create Set 1 if playing match with lineup
      if (matchType !== 'officiating' && startingLineup) {
        await tx.set.create({
          data: {
            matchId: m.id,
            setNumber: 1,
            startingLineup,
            servingFirst: firstServe || 'us',
            status: 'in_progress',
          },
        })
        await tx.match.update({ where: { id: m.id }, data: { status: 'in_progress' } })
      }

      return m
    })

    const result = await prisma.match.findUnique({
      where: { id: match.id },
      include: { sets: true, matchPlayers: true },
    })

    res.status(201).json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create match' })
  }
})

// GET /api/games/:id — get match with sets summary
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const match = await prisma.match.findFirst({
      where: { id, teamId: req.user!.teamId! },
      include: {
        team: { select: { name: true, initials: true } },
        sets: {
          orderBy: { setNumber: 'asc' },
          select: { id: true, setNumber: true, scoreUs: true, scoreThem: true, status: true, servingFirst: true, startingLineup: true },
        },
        matchPlayers: {
          include: {
            player: {
              select: { id: true, firstName: true, lastName: true, jersey: true, positions: true, isLibero: true },
            },
          },
        },
      },
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })
    res.json(match)
  } catch {
    res.status(500).json({ error: 'Failed to fetch match' })
  }
})

// PATCH /api/games/:id — update match (manager only)
router.patch('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  const {
    opponent, opponentInitials, homeTeam, guestTeam, date, location, firstServe,
    seasonId, status, setsWonUs, setsWonThem, setsPlayed, scoreUs, scoreThem,
    ref1Id, ref2Id, scorer1Id, scorer2Id,
  } = req.body

  try {
    const existing = await prisma.match.findFirst({ where: { id, teamId: req.user!.teamId! } })
    if (!existing) return res.status(404).json({ error: 'Match not found' })

    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(opponent !== undefined && { opponent }),
        ...(opponentInitials !== undefined && { opponentInitials }),
        ...(homeTeam !== undefined && { homeTeam }),
        ...(guestTeam !== undefined && { guestTeam }),
        ...(date && { date: new Date(date) }),
        ...(location !== undefined && { location }),
        ...(firstServe && { firstServe }),
        ...(seasonId !== undefined && { seasonId }),
        ...(status && { status }),
        ...(setsWonUs !== undefined && { setsWonUs }),
        ...(setsWonThem !== undefined && { setsWonThem }),
        ...(setsPlayed !== undefined && { setsPlayed }),
        ...(scoreUs && { scoreUs }),
        ...(scoreThem && { scoreThem }),
        ...(ref1Id !== undefined && { ref1Id: ref1Id || null }),
        ...(ref2Id !== undefined && { ref2Id: ref2Id || null }),
        ...(scorer1Id !== undefined && { scorer1Id: scorer1Id || null }),
        ...(scorer2Id !== undefined && { scorer2Id: scorer2Id || null }),
      },
    })

    // Trigger analysis when match is completed
    if (status === 'completed' && existing.status !== 'completed') {
      try {
        await fetch(`${ANALYSIS_SERVICE_URL}/analyse/${id}`, { method: 'POST' })
      } catch (e) {
        console.error('Failed to trigger analysis:', e)
      }
    }

    res.json(match)
  } catch {
    res.status(500).json({ error: 'Failed to update match' })
  }
})

// DELETE /api/games/:id — delete match (manager only)
router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const existing = await prisma.match.findFirst({ where: { id, teamId: req.user!.teamId! } })
    if (!existing) return res.status(404).json({ error: 'Match not found' })

    await prisma.match.delete({ where: { id } })
    res.json({ message: 'Match deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete match' })
  }
})

// GET /api/games/:id/stats — computed match stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  const { id } = req.params
  const { setId } = req.query

  try {
    const match = await prisma.match.findFirst({
      where: { id, teamId: req.user!.teamId! },
      include: {
        sets: {
          orderBy: { setNumber: 'asc' },
          include: { rallies: { orderBy: { rallyIndex: 'asc' } } },
        },
        matchPlayers: { include: { player: { select: { id: true, firstName: true, lastName: true, jersey: true, positions: true } } } },
      },
    })
    if (!match) return res.status(404).json({ error: 'Match not found' })

    // Filter by set if requested
    const setsToAnalyse = setId
      ? match.sets.filter(s => s.id === setId)
      : match.sets

    const allRallies = setsToAnalyse.flatMap(s => s.rallies)

    const rallyData = allRallies.map(r => ({
      scorer: r.scorer,
      pointType: r.pointType,
      scoreUs: r.scoreUs,
      scoreThem: r.scoreThem,
      servingTeam: r.servingTeam,
      rotationAfter: r.rotationAfter as Record<string, string>,
      rotated: r.rotated,
      rallyIndex: r.rallyIndex,
    }))

    const overallStats = computeSetStats(rallyData)
    const pointQuality = computePointQuality(rallyData)
    const errorClustering = computeErrorClustering(rallyData)

    // Per-set stats
    const perSetStats = match.sets.map(s => ({
      setId: s.id,
      setNumber: s.setNumber,
      scoreUs: s.scoreUs,
      scoreThem: s.scoreThem,
      status: s.status,
      stats: computeSetStats(s.rallies.map(r => ({
        scorer: r.scorer,
        pointType: r.pointType,
        scoreUs: r.scoreUs,
        scoreThem: r.scoreThem,
        servingTeam: r.servingTeam,
        rotationAfter: r.rotationAfter as Record<string, string>,
        rotated: r.rotated,
        rallyIndex: r.rallyIndex,
      }))),
    }))

    // Rotation stats (placeholder — rotation number derivation requires player positions)
    const playerPositions = Object.fromEntries(
      match.matchPlayers.map(mp => [mp.player.id, mp.player.positions])
    )
    const setterZoneByRally = rallyData.map(r => {
      const rotation = r.rotationAfter as Record<string, string>
      // Find setter zone from rotation
      for (const [zone, playerId] of Object.entries(rotation)) {
        if (playerPositions[playerId]?.includes('Setter')) {
          return parseInt(zone.replace('zone', ''), 10)
        }
      }
      return 1
    })
    const rotationStats = computeRotationStats(rallyData, setterZoneByRally)

    // TUS timeline
    const tusTimeline = allRallies.map(r => ({
      rallyIndex: r.rallyIndex,
      scoreUs: r.scoreUs,
      scoreThem: r.scoreThem,
      scorer: r.scorer,
    }))

    res.json({
      matchId: id,
      overall: overallStats,
      pointQuality,
      errorClustering,
      rotationStats,
      perSetStats,
      tusTimeline,
      totalRallies: allRallies.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to compute stats' })
  }
})

// GET /api/games/:id/analysis — relay analysis status + insights
router.get('/:id/analysis', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const analysis = await prisma.matchAnalysis.findUnique({
      where: { matchId: id },
    })

    if (!analysis) {
      return res.json({ status: 'pending', matchId: id })
    }

    res.json({
      status: analysis.status,
      matchId: id,
      nRallies: analysis.nRallies,
      insights: analysis.insights,
      result: analysis.result,
      errorMessage: analysis.errorMessage,
      updatedAt: analysis.updatedAt,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch analysis' })
  }
})

export default router
