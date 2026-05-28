import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
const SALT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '7d'
const REFRESH_TOKEN_EXPIRY = '30d'

function signTokens(payload: object) {
  const secret = process.env.JWT_SECRET!
  const accessToken = jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY })
  const refreshToken = jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRY })
  return { accessToken, refreshToken }
}

function setCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

// POST /api/auth/register — creates user (manager) + team
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, teamName } = req.body
  if (!email || !password || !teamName) {
    return res.status(400).json({ error: 'email, password and teamName are required' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data: { name: teamName } })
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'manager', teamId: team.id },
      })
      // Create a default active season
      await tx.season.create({
        data: {
          teamId: team.id,
          name: `Season ${new Date().getFullYear()}`,
          startDate: new Date(),
          isActive: true,
        },
      })
      return { team, user }
    })

    const payload = { id: result.user.id, email: result.user.email, role: result.user.role, teamId: result.user.teamId }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    res.status(201).json({ user: payload, accessToken })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    // Find linked player if player role
    let playerId: string | undefined
    if (user.role === 'player') {
      const player = await prisma.player.findFirst({ where: { userId: user.id } })
      playerId = player?.id
    }

    const payload = { id: user.id, email: user.email, role: user.role as 'manager' | 'player', teamId: user.teamId, playerId }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    res.json({ user: payload, accessToken })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  try {
    const secret = process.env.JWT_SECRET!
    const payload = jwt.verify(token, secret) as { id: string; email: string; role: string; teamId: string | null }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)
    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('accessToken')
  res.clearCookie('refreshToken')
  res.json({ message: 'Logged out' })
})

// POST /api/auth/invite/:playerId — manager sends player invite
router.post('/invite/:playerId', authenticate, async (req: Request, res: Response) => {
  if (req.user?.role !== 'manager') return res.status(403).json({ error: 'Manager only' })

  const { playerId } = req.params
  try {
    const player = await prisma.player.findFirst({
      where: { id: playerId, teamId: req.user.teamId! },
    })
    if (!player) return res.status(404).json({ error: 'Player not found' })

    // Generate one-time invite token
    const inviteToken = uuidv4()
    const secret = process.env.JWT_SECRET!
    const token = jwt.sign(
      { playerId, teamId: req.user.teamId, inviteToken },
      secret,
      { expiresIn: '7d' }
    )

    res.json({ inviteToken: token, message: 'Send this token to the player to complete registration' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate invite' })
  }
})

// POST /api/auth/accept-invite — player sets password via one-time token
router.post('/accept-invite', async (req: Request, res: Response) => {
  const { token, email, password } = req.body
  if (!token || !email || !password) {
    return res.status(400).json({ error: 'token, email and password required' })
  }

  try {
    const secret = process.env.JWT_SECRET!
    const decoded = jwt.verify(token, secret) as { playerId: string; teamId: string }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return res.status(409).json({ error: 'Email already in use' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'player', teamId: decoded.teamId },
      })
      await tx.player.update({
        where: { id: decoded.playerId },
        data: { userId: user.id },
      })
      return user
    })

    const payload = { id: result.id, email: result.email, role: result.role as 'player', teamId: result.teamId, playerId: decoded.playerId }
    const { accessToken, refreshToken } = signTokens(payload)
    setCookies(res, accessToken, refreshToken)

    res.status(201).json({ user: payload, accessToken })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

export default router
