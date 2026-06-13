import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin'
import { sendPushToUser } from '../lib/push'

const router = Router()

const SALT_ROUNDS = 12
const ROLES = ['superadmin', 'manager', 'player']

// Notify a user (in-app log + push) that an admin changed their account.
async function notifyAccountChange(
  userId: string,
  locale: string | null,
  kind: 'account_updated' | 'password_reset',
): Promise<void> {
  const de = locale === 'de'
  const content = kind === 'password_reset'
    ? (de
        ? { title: 'Passwort zurückgesetzt', body: 'Ein Administrator hat dein Passwort zurückgesetzt.' }
        : { title: 'Password reset', body: 'An administrator reset your password.' })
    : (de
        ? { title: 'Konto aktualisiert', body: 'Ein Administrator hat deine Kontodaten aktualisiert.' }
        : { title: 'Account updated', body: 'An administrator updated your account details.' })

  try {
    await prisma.notificationLog.create({
      data: { userId, type: kind, title: content.title, body: content.body },
    })
    await sendPushToUser(userId, { ...content, url: '/settings', tag: kind })
  } catch (err) {
    console.error('[admin notifyAccountChange]', err)
  }
}

// All routes require superadmin
router.use(requireSuperAdmin)

// GET /api/admin/teams — all teams with member counts
router.get('/teams', async (_req: Request, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: { select: { teamMembers: true, players: true, matches: true } },
        seasons: { where: { isActive: true }, select: { id: true, name: true }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    })

    return res.json(teams.map(t => ({
      id: t.id,
      name: t.name,
      initials: t.initials,
      createdAt: t.createdAt,
      memberCount: t._count.teamMembers,
      playerCount: t._count.players,
      matchCount: t._count.matches,
      activeSeason: t.seasons[0] ?? null,
    })))
  } catch (err) {
    console.error('[admin/teams GET]', err)
    return res.status(500).json({ error: 'Failed to fetch teams' })
  }
})

// POST /api/admin/teams — create a new team
router.post('/teams', async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string }
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

  try {
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({ data: { name: name.trim() } })
      await tx.season.create({
        data: {
          teamId: newTeam.id,
          name: `Season ${new Date().getFullYear()}`,
          startDate: new Date(),
          isActive: true,
        },
      })
      return newTeam
    })
    return res.status(201).json(team)
  } catch (err) {
    console.error('[admin/teams POST]', err)
    return res.status(500).json({ error: 'Failed to create team' })
  }
})

// DELETE /api/admin/teams/:id — delete a team and all its data
router.delete('/teams/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return res.status(404).json({ error: 'Team not found' })

    await prisma.$transaction(async (tx) => {
      const matches = await tx.match.findMany({ where: { teamId: id }, select: { id: true } })
      const matchIds = matches.map(m => m.id)

      if (matchIds.length > 0) {
        const sets = await tx.set.findMany({ where: { matchId: { in: matchIds } }, select: { id: true } })
        const setIds = sets.map((s: { id: string }) => s.id)
        if (setIds.length > 0) {
          await tx.rally.deleteMany({ where: { setId: { in: setIds } } })
          await tx.substitution.deleteMany({ where: { setId: { in: setIds } } })
          await tx.timeout.deleteMany({ where: { setId: { in: setIds } } })
          await tx.set.deleteMany({ where: { id: { in: setIds } } })
        }
        await tx.matchPlayer.deleteMany({ where: { matchId: { in: matchIds } } })
        await tx.matchAnalysis.deleteMany({ where: { matchId: { in: matchIds } } })
        await tx.match.deleteMany({ where: { teamId: id } })
      }

      const sessions = await tx.trainingSession.findMany({ where: { teamId: id }, select: { id: true } })
      const sessionIds = sessions.map((s: { id: string }) => s.id)
      if (sessionIds.length > 0) {
        await tx.trainingSession.deleteMany({ where: { teamId: id } })
      }

      await tx.trainingPriority.deleteMany({ where: { teamId: id } })
      await tx.player.deleteMany({ where: { teamId: id } })
      await tx.season.deleteMany({ where: { teamId: id } })
      await tx.inviteCode.deleteMany({ where: { teamId: id } })
      await tx.teamMember.deleteMany({ where: { teamId: id } })
      await tx.team.delete({ where: { id } })
    })

    return res.json({ message: 'Team deleted' })
  } catch (err) {
    console.error('[admin/teams DELETE]', err)
    return res.status(500).json({ error: 'Failed to delete team' })
  }
})

// GET /api/admin/users — all users
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, onboardingDone: true, createdAt: true,
        teamMemberships: {
          select: { teamId: true, role: true, isDefault: true, team: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    return res.json(users)
  } catch (err) {
    console.error('[admin/users GET]', err)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// PATCH /api/admin/users/:id — edit a user's details (notifies the user)
router.patch('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const { firstName, lastName, email, role } = req.body as {
    firstName?: string; lastName?: string; email?: string; role?: string
  }

  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).json({ error: 'role must be superadmin, manager or player' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'User not found' })

    const nextEmail = email?.trim().toLowerCase()
    if (nextEmail && nextEmail !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: nextEmail } })
      if (taken) return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const data: Record<string, unknown> = {}
    if (firstName !== undefined) data.firstName = firstName.trim()
    if (lastName !== undefined) data.lastName = lastName.trim()
    if (nextEmail) data.email = nextEmail
    if (role !== undefined) data.role = role

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, onboardingDone: true, createdAt: true, locale: true,
        teamMemberships: {
          select: { teamId: true, role: true, isDefault: true, team: { select: { name: true } } },
        },
      },
    })

    await notifyAccountChange(id, updated.locale, 'account_updated')

    return res.json(updated)
  } catch (err) {
    console.error('[admin/users PATCH]', err)
    return res.status(500).json({ error: 'Failed to update user' })
  }
})

// POST /api/admin/users/:id/reset-password — set a new password (notifies the user)
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  const { id } = req.params
  const { password } = req.body as { password?: string }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, locale: true } })
    if (!existing) return res.status(404).json({ error: 'User not found' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    await prisma.user.update({ where: { id }, data: { passwordHash } })

    await notifyAccountChange(id, existing.locale, 'password_reset')

    return res.json({ success: true })
  } catch (err) {
    console.error('[admin/users reset-password]', err)
    return res.status(500).json({ error: 'Failed to reset password' })
  }
})

// GET /api/admin/invites — all invite codes
router.get('/invites', async (_req: Request, res: Response) => {
  try {
    const invites = await prisma.inviteCode.findMany({
      include: {
        team: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.json(invites.map(inv => ({
      id: inv.id,
      code: inv.code,
      role: inv.role,
      teamId: inv.teamId,
      teamName: inv.team?.name ?? null,
      boundEmail: inv.boundEmail,
      useCount: inv.useCount,
      maxUses: inv.maxUses,
      expiresAt: inv.expiresAt,
      usedAt: inv.usedAt,
      usedById: inv.usedById,
      emailSentAt: inv.emailSentAt,
      createdAt: inv.createdAt,
      createdBy: `${inv.createdBy.firstName} ${inv.createdBy.lastName}`.trim() || inv.createdBy.email,
      isExpired: inv.expiresAt < new Date(),
      isFullyUsed: inv.useCount >= inv.maxUses,
    })))
  } catch (err) {
    console.error('[admin/invites GET]', err)
    return res.status(500).json({ error: 'Failed to fetch invite codes' })
  }
})

export default router
