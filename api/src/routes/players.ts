import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../lib/prisma'
import { requireManager } from '../middleware/requireRole'

const router = Router()

// ── Photo upload configuration ─────────────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads'

// Ensure the uploads directory exists on startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => {
    // Use the player ID as the filename so uploading a new photo replaces the old one
    const playerId = (req as Request).params.id
    cb(null, `${playerId}.jpg`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/players
router.get('/', async (req: Request, res: Response) => {
  try {
    const players = await prisma.player.findMany({
      where: { teamId: req.user!.teamId! },
      orderBy: [{ jersey: 'asc' }, { lastName: 'asc' }],
    })
    res.json(players)
  } catch {
    res.status(500).json({ error: 'Failed to fetch players' })
  }
})

// POST /api/players — create player (manager only)
router.post('/', requireManager, async (req: Request, res: Response) => {
  const { firstName, lastName, birthday, heightM, jersey, positions, isLibero, hasRefereeLicense } = req.body
  if (!firstName || !lastName || !positions) {
    return res.status(400).json({ error: 'firstName, lastName and positions are required' })
  }

  try {
    const player = await prisma.player.create({
      data: {
        teamId: req.user!.teamId!,
        firstName,
        lastName,
        birthday: birthday ? new Date(birthday) : undefined,
        heightM: heightM || undefined,
        jersey: jersey || undefined,
        positions: Array.isArray(positions) ? positions : [positions],
        isLibero: isLibero || false,
        hasRefereeLicense: hasRefereeLicense || false,
      },
    })

    res.status(201).json(player)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create player' })
  }
})

// GET /api/players/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const player = await prisma.player.findFirst({
      where: { id, teamId: req.user!.teamId! },
    })
    if (!player) return res.status(404).json({ error: 'Player not found' })

    if (req.user!.role === 'player' && player.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    if (req.user!.role === 'player') {
      const { birthday, heightM, hasRefereeLicense, userId, ...safePlayer } = player
      return res.json(safePlayer)
    }

    res.json(player)
  } catch {
    res.status(500).json({ error: 'Failed to fetch player' })
  }
})

// PATCH /api/players/:id — managers can edit anyone; players can edit their own record
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { firstName, lastName, birthday, heightM, jersey, positions, isLibero, hasRefereeLicense } = req.body
  const isManager = req.user!.role === 'manager' || req.user!.role === 'superadmin'

  try {
    const existing = await prisma.player.findFirst({ where: { id, teamId: req.user!.teamId! } })
    if (!existing) return res.status(404).json({ error: 'Player not found' })

    if (!isManager && existing.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const player = await prisma.player.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
        ...(heightM !== undefined && { heightM }),
        ...(jersey !== undefined && { jersey }),
        ...(positions && { positions: Array.isArray(positions) ? positions : [positions] }),
        ...(isLibero !== undefined && { isLibero }),
        ...(hasRefereeLicense !== undefined && { hasRefereeLicense }),
      },
    })

    res.json(player)
  } catch {
    res.status(500).json({ error: 'Failed to update player' })
  }
})

// POST /api/players/:id/photo — managers can upload for anyone; players can upload for their own record
router.post(
  '/:id/photo',
  upload.single('photo'),
  async (req: Request, res: Response) => {
    const { id } = req.params
    const isManager = req.user!.role === 'manager' || req.user!.role === 'superadmin'

    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided (jpeg/png/webp, max 5 MB)' })
    }

    try {
      const existing = await prisma.player.findFirst({ where: { id, teamId: req.user!.teamId! } })
      if (!existing) {
        fs.unlink(req.file.path, () => {})
        return res.status(404).json({ error: 'Player not found' })
      }

      if (!isManager && existing.userId !== req.user!.id) {
        fs.unlink(req.file.path, () => {})
        return res.status(403).json({ error: 'Access denied' })
      }

      // Store the public URL path (served by Express static middleware)
      const avatarUrl = `/uploads/${req.file.filename}`

      const player = await prisma.player.update({
        where: { id },
        data: { avatarUrl },
      })

      res.json(player)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to save photo' })
    }
  }
)

// DELETE /api/players/:id/photo — managers can remove for anyone; players can remove their own
router.delete('/:id/photo', async (req: Request, res: Response) => {
  const { id } = req.params
  const isManager = req.user!.role === 'manager' || req.user!.role === 'superadmin'
  try {
    const existing = await prisma.player.findFirst({ where: { id, teamId: req.user!.teamId! } })
    if (!existing) return res.status(404).json({ error: 'Player not found' })

    if (!isManager && existing.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete file from disk if it exists
    const filePath = path.join(UPLOADS_DIR, `${id}.jpg`)
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {})

    const player = await prisma.player.update({
      where: { id },
      data: { avatarUrl: null },
    })

    res.json(player)
  } catch {
    res.status(500).json({ error: 'Failed to remove photo' })
  }
})

// DELETE /api/players/:id
router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const existing = await prisma.player.findFirst({ where: { id, teamId: req.user!.teamId! } })
    if (!existing) return res.status(404).json({ error: 'Player not found' })

    // Clean up photo file when player is deleted
    const filePath = path.join(UPLOADS_DIR, `${id}.jpg`)
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {})

    await prisma.player.delete({ where: { id } })
    res.json({ message: 'Player deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete player' })
  }
})

export default router
