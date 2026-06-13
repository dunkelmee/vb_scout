import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { sendPushToTeam } from '../lib/push'
import { rsvpResponseContent } from '../lib/notificationContent'
import { requireManager } from '../middleware/requireRole'

const router = Router()

type RsvpStatus = 'confirmed' | 'declined' | 'maybe'
const VALID_STATUSES: RsvpStatus[] = ['confirmed', 'declined', 'maybe']

async function getTeamIdForEntity(
  entityType: string,
  entityId: string,
  userTeamId: string
): Promise<string | null> {
  if (entityType === 'training') {
    const s = await prisma.trainingSession.findFirst({
      where: { id: entityId, teamId: userTeamId },
    })
    return s?.teamId ?? null
  }
  if (entityType === 'game') {
    const m = await prisma.match.findFirst({
      where: { id: entityId, teamId: userTeamId },
    })
    return m?.teamId ?? null
  }
  return null
}

// POST /api/rsvp — create or update a player's RSVP
router.post('/', async (req: Request, res: Response) => {
  const { entityType, entityId, status, note } = req.body as {
    entityType?: string
    entityId?:   string
    status?:     string
    note?:       string
  }

  if (!entityType || !['training', 'game'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be "training" or "game"' })
  }
  if (!entityId) return res.status(400).json({ error: 'entityId is required' })
  if (!status || !VALID_STATUSES.includes(status as RsvpStatus)) {
    return res.status(400).json({ error: 'status must be confirmed | declined | maybe' })
  }

  const teamId = await getTeamIdForEntity(entityType, entityId, req.user!.teamId!)
  if (!teamId) return res.status(404).json({ error: 'Entity not found' })

  try {
    const rsvp = await prisma.rsvp.upsert({
      where: {
        playerId_entityType_entityId: {
          playerId: req.user!.id,
          entityType,
          entityId,
        },
      },
      update: { status, note: note !== undefined ? note : undefined, respondedAt: new Date() },
      create: {
        playerId:    req.user!.id,
        entityType,
        entityId,
        status,
        note,
        respondedAt: new Date(),
      },
    })

    // Notify managers
    const me = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (me) {
      const playerName = `${me.firstName} ${me.lastName}`
      const content = rsvpResponseContent(
        playerName,
        status as RsvpStatus,
        entityType as 'training' | 'game',
        'en'
      )
      await sendPushToTeam(teamId, {
        ...content,
        url:  entityType === 'training' ? `/trainings/${entityId}` : `/games/${entityId}`,
        tag:  `rsvp-${entityType}-${entityId}`,
      }, {
        roles:          ['manager'],
        excludeUserId:  req.user!.id,
        notifPrefField: 'notifRsvpResponses',
      })
    }

    res.json({ rsvp })
  } catch (err) {
    console.error('[rsvp]', err)
    res.status(500).json({ error: 'Failed to save RSVP' })
  }
})

// GET /api/rsvp/:entityType/:entityId — all RSVPs (manager only)
router.get('/:entityType/:entityId', requireManager, async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params
  if (!['training', 'game'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entityType' })
  }

  // Ensure the entity belongs to the manager's team before exposing responses
  const teamId = await getTeamIdForEntity(entityType, entityId, req.user!.teamId!)
  if (!teamId) return res.status(404).json({ error: 'Entity not found' })

  try {
    const rsvps = await prisma.rsvp.findMany({
      where: { entityType, entityId },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })
    res.json(rsvps)
  } catch (err) {
    console.error('[rsvp/list]', err)
    res.status(500).json({ error: 'Failed to fetch RSVPs' })
  }
})

// GET /api/rsvp/me/:entityType/:entityId — current user's RSVP
router.get('/me/:entityType/:entityId', async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params
  try {
    const rsvp = await prisma.rsvp.findUnique({
      where: {
        playerId_entityType_entityId: {
          playerId: req.user!.id,
          entityType,
          entityId,
        },
      },
    })
    res.json(rsvp ?? null)
  } catch (err) {
    console.error('[rsvp/me]', err)
    res.status(500).json({ error: 'Failed to fetch RSVP' })
  }
})

export default router
