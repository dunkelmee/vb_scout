import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import fs from 'fs'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { normaliseCode, verifyCode } from '../lib/inviteCode'
import { sendWelcomeEmail } from '../lib/email'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads'
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => cb(null, `user-${(req as Request).user!.id}.jpg`),
})
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

const router = Router()
const SALT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '30d'

type Role = 'superadmin' | 'manager' | 'player'

interface JwtPayload {
  id: string
  email: string
  role: Role
  teamId: string | null
}

function signTokens(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET!
  const accessToken  = jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY })
  const refreshToken = jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRY })
  return { accessToken, refreshToken }
}

function setCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  })
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

async function resolveDefaultTeamId(userId: string): Promise<string | null> {
  const membership = await prisma.teamMember.findFirst({
    where: { userId, isDefault: true },
  })
  if (membership) return membership.teamId
  // Fall back to any membership
  const any = await prisma.teamMember.findFirst({ where: { userId } })
  return any?.teamId ?? null
}

// POST /api/auth/register — invite-code-gated registration
router.post('/register', async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, inviteCode, teamName } = req.body as {
    firstName?: string
    lastName?: string
    email?: string
    password?: string
    inviteCode?: string
    teamName?: string
  }

  if (!firstName || !lastName || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'firstName, lastName, email, password and inviteCode are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    // Locate invite code record by the plaintext code
    const normCode = normaliseCode(inviteCode)
    const inviteRecords = await prisma.inviteCode.findMany({
      where: {
        expiresAt: { gt: new Date() },
        useCount: { lt: prisma.inviteCode.fields.maxUses as never },
      },
      include: { team: { select: { id: true, name: true } } },
    })

    let matchedInvite: typeof inviteRecords[0] | null = null
    for (const inv of inviteRecords) {
      const ok = await verifyCode(normCode, inv.codeHash)
      if (ok) { matchedInvite = inv; break }
    }

    if (!matchedInvite) {
      return res.status(422).json({ error: 'Invitation code is invalid or has expired' })
    }

    // Re-check useCount after finding
    if (matchedInvite.useCount >= matchedInvite.maxUses) {
      return res.status(422).json({ error: 'Invitation code has already been fully used' })
    }

    // Enforce boundEmail if set
    if (matchedInvite.boundEmail) {
      if (matchedInvite.boundEmail.toLowerCase() !== email.toLowerCase()) {
        return res.status(422).json({ error: 'This invitation was sent to a different email address.' })
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await prisma.$transaction(async (tx) => {
      let teamId = matchedInvite!.teamId

      // If the invite has no teamId (manager creating their own team), create one
      if (!teamId) {
        if (!teamName?.trim()) {
          throw new Error('teamName is required when the invitation code has no team')
        }
        const newTeam = await tx.team.create({
          data: { name: teamName.trim() },
        })
        teamId = newTeam.id
        // Create a default season for the new team
        await tx.season.create({
          data: {
            teamId: newTeam.id,
            name: `Season ${new Date().getFullYear()}`,
            startDate: new Date(),
            isActive: true,
          },
        })
      }

      const user = await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email,
          passwordHash,
          role: matchedInvite!.role,
        },
      })

      await tx.teamMember.create({
        data: { userId: user.id, teamId: teamId!, role: matchedInvite!.role, isDefault: true },
      })

      if (matchedInvite!.role === 'player') {
        await tx.player.create({
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            teamId: teamId!,
            userId: user.id,
          },
        })
      }

      await tx.inviteCode.update({
        where: { id: matchedInvite!.id },
        data: { useCount: { increment: 1 }, usedAt: new Date(), usedById: user.id },
      })

      return { user, teamId: teamId! }
    })

    // Fire-and-forget welcome email
    if (result.user.role !== 'superadmin') {
      const team = await prisma.team.findUnique({ where: { id: result.teamId }, select: { name: true } })
      sendWelcomeEmail({
        to: email,
        firstName: firstName.trim(),
        teamName: team?.name ?? '',
        role: result.user.role as 'manager' | 'player',
      }).catch(() => {})
    }

    const payload: JwtPayload = {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role as Role,
      teamId: result.teamId,
    }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    return res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        teamId: result.teamId,
        onboardingDone: result.user.onboardingDone,
      },
      accessToken,
      isFirstLogin: true,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('teamName is required')) {
      return res.status(400).json({ error: err.message })
    }
    console.error('[register]', err)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const teamId = user.role === 'superadmin' ? null : await resolveDefaultTeamId(user.id)

    let playerId: string | undefined
    if (user.role === 'player' && teamId) {
      const player = await prisma.player.findFirst({ where: { userId: user.id, teamId } })
      playerId = player?.id
    }

    const payload: JwtPayload = { id: user.id, email: user.email, role: user.role as Role, teamId }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        teamId,
        playerId,
        onboardingDone: user.onboardingDone,
        avatarUrl: user.avatarUrl ?? null,
      },
      accessToken,
      isFirstLogin: !user.onboardingDone && user.role !== 'superadmin',
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  try {
    const secret = process.env.JWT_SECRET!
    const payload = jwt.verify(token, secret) as JwtPayload
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)
    return res.json({ accessToken })
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('accessToken')
  res.clearCookie('refreshToken')
  return res.json({ message: 'Logged out' })
})

// GET /api/auth/me — current user profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, onboardingDone: true, avatarUrl: true,
      },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const teamId = req.user!.teamId
    let playerId: string | undefined
    if (user.role === 'player' && teamId) {
      const player = await prisma.player.findFirst({ where: { userId: user.id, teamId } })
      playerId = player?.id
    }

    return res.json({ ...user, teamId, playerId })
  } catch (err) {
    console.error('[me]', err)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// PATCH /api/auth/me — update onboardingDone or name
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  const { onboardingDone, firstName, lastName } = req.body as {
    onboardingDone?: boolean
    firstName?: string
    lastName?: string
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(onboardingDone !== undefined && { onboardingDone }),
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, onboardingDone: true, avatarUrl: true,
      },
    })
    return res.json({ ...updated, teamId: req.user!.teamId })
  } catch (err) {
    console.error('[me patch]', err)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

// POST /api/auth/me/photo — upload or replace profile picture
router.post('/me/photo', authenticate, uploadAvatar.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    const avatarUrl = `/uploads/${req.file.filename}`
    await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl } })
    return res.json({ avatarUrl })
  } catch (err) {
    console.error('[me/photo]', err)
    return res.status(500).json({ error: 'Failed to save photo' })
  }
})

// DELETE /api/auth/me/photo — remove profile picture
router.delete('/me/photo', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarUrl: true } })
    if (user?.avatarUrl) {
      const filePath = `${UPLOADS_DIR}/${user.avatarUrl.split('/').pop()}`
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: null } })
    return res.json({ avatarUrl: null })
  } catch (err) {
    console.error('[me/photo delete]', err)
    return res.status(500).json({ error: 'Failed to remove photo' })
  }
})

// GET /api/auth/me/teams — all team memberships for the current user
router.get('/me/teams', authenticate, async (req: Request, res: Response) => {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          select: {
            id: true, name: true, initials: true,
            seasons: {
              where: { isActive: true },
              select: { id: true, name: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    })

    return res.json(memberships.map(m => ({
      teamId: m.teamId,
      teamName: m.team.name,
      teamInitials: m.team.initials,
      role: m.role,
      isDefault: m.isDefault,
      joinedAt: m.joinedAt,
      activeSeason: m.team.seasons[0] ?? null,
    })))
  } catch (err) {
    console.error('[me/teams]', err)
    return res.status(500).json({ error: 'Failed to fetch teams' })
  }
})

// POST /api/auth/switch-team — re-issue JWT for a different team
router.post('/switch-team', authenticate, async (req: Request, res: Response) => {
  const { teamId } = req.body as { teamId?: string }
  if (!teamId) return res.status(400).json({ error: 'teamId is required' })

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId } },
    })
    if (!membership) return res.status(403).json({ error: 'Not a member of this team' })

    // Mark this team as default, clear old default
    await prisma.$transaction([
      prisma.teamMember.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.teamMember.update({
        where: { userId_teamId: { userId: req.user!.id, teamId } },
        data: { isDefault: true },
      }),
    ])

    let playerId: string | undefined
    if (membership.role === 'player') {
      const player = await prisma.player.findFirst({ where: { userId: req.user!.id, teamId } })
      playerId = player?.id
    }

    const payload: JwtPayload = {
      id: req.user!.id,
      email: req.user!.email,
      role: membership.role as Role,
      teamId,
    }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    return res.json({ accessToken, teamId, role: membership.role, playerId })
  } catch (err) {
    console.error('[switch-team]', err)
    return res.status(500).json({ error: 'Failed to switch team' })
  }
})

// POST /api/auth/teams/join — join an additional team via invite code
router.post('/teams/join', authenticate, async (req: Request, res: Response) => {
  const { inviteCode } = req.body as { inviteCode?: string }
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode is required' })

  const normCode = normaliseCode(inviteCode)
  try {
    const inviteRecords = await prisma.inviteCode.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { team: { select: { id: true, name: true, initials: true } } },
    })

    let matched: typeof inviteRecords[0] | null = null
    for (const inv of inviteRecords) {
      if (await verifyCode(normCode, inv.codeHash)) { matched = inv; break }
    }

    if (!matched || matched.useCount >= matched.maxUses) {
      return res.status(422).json({ error: 'Invitation code is invalid, expired, or fully used' })
    }
    if (!matched.teamId || !matched.team) {
      return res.status(422).json({ error: 'This invitation code cannot be used to join a team' })
    }

    if (matched.boundEmail && matched.boundEmail.toLowerCase() !== req.user!.email.toLowerCase()) {
      return res.status(422).json({ error: 'This invitation was sent to a different email address.' })
    }

    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId: matched.teamId } },
    })
    if (existing) return res.status(409).json({ error: 'Already a member of this team' })

    await prisma.$transaction([
      prisma.teamMember.create({
        data: { userId: req.user!.id, teamId: matched.teamId, role: matched.role, isDefault: false },
      }),
      prisma.inviteCode.update({
        where: { id: matched.id },
        data: { useCount: { increment: 1 }, usedAt: new Date(), usedById: req.user!.id },
      }),
    ])

    return res.json({ team: matched.team, role: matched.role })
  } catch (err) {
    console.error('[teams/join]', err)
    return res.status(500).json({ error: 'Failed to join team' })
  }
})

export default router
