import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { generateCode, hashCode, normaliseCode, verifyCode } from '../lib/inviteCode'
import { sendManagerInviteEmail, sendPlayerInviteEmail } from '../lib/email'
import { requireManager } from '../middleware/requireRole'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin'

export const invitesRouter = Router()

// POST /api/invites — create invite code
invitesRouter.post('/', requireManager, async (req: Request, res: Response) => {
  const { role, teamId: bodyTeamId, maxUses, boundEmail } = req.body as {
    role?: string
    teamId?: string
    maxUses?: number
    boundEmail?: string
  }

  if (!role || !['manager', 'player'].includes(role)) {
    return res.status(400).json({ error: 'role must be "manager" or "player"' })
  }

  const isSuperAdmin = req.user!.role === 'superadmin'

  if (role === 'manager' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Only superadmins can create manager invite codes' })
  }

  const resolvedTeamId = isSuperAdmin ? (bodyTeamId ?? null) : req.user!.teamId
  if (role === 'player' && !resolvedTeamId) {
    return res.status(400).json({ error: 'teamId is required for player invite codes' })
  }

  try {
    const plainCode = generateCode()
    const codeHash  = await hashCode(plainCode)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const creator = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true },
    })
    const invitedBy = creator
      ? (`${creator.firstName} ${creator.lastName}`.trim() || req.user!.email)
      : req.user!.email

    const invite = await prisma.inviteCode.create({
      data: {
        code: plainCode,
        codeHash,
        role,
        teamId: resolvedTeamId ?? undefined,
        boundEmail: boundEmail?.toLowerCase() ?? null,
        createdById: req.user!.id,
        expiresAt,
        maxUses: maxUses ?? 1,
      },
      include: { team: { select: { name: true } } },
    })

    let emailSent = false
    if (boundEmail) {
      if (role === 'manager') {
        emailSent = await sendManagerInviteEmail({ to: boundEmail, code: plainCode, expiresAt, invitedBy })
      } else if (role === 'player' && invite.team) {
        emailSent = await sendPlayerInviteEmail({
          to: boundEmail,
          code: plainCode,
          teamName: invite.team.name,
          expiresAt,
          invitedBy,
        })
      }
      await prisma.inviteCode.update({
        where: { id: invite.id },
        data: { emailSentAt: emailSent ? new Date() : null },
      })
    }

    return res.status(201).json({
      code: plainCode,
      expiresAt,
      role,
      teamId: resolvedTeamId,
      boundEmail: boundEmail ?? null,
      emailSent,
    })
  } catch (err) {
    console.error('[invites POST]', err)
    return res.status(500).json({ error: 'Failed to create invite code' })
  }
})

// GET /api/invites — list codes visible to the current user
invitesRouter.get('/', requireManager, async (req: Request, res: Response) => {
  try {
    const where = req.user!.role === 'superadmin' ? {} : { createdById: req.user!.id }

    const invites = await prisma.inviteCode.findMany({
      where,
      include: { team: { select: { name: true } } },
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
      emailSentAt: inv.emailSentAt,
      createdAt: inv.createdAt,
      isExpired: inv.expiresAt < new Date(),
      isFullyUsed: inv.useCount >= inv.maxUses,
    })))
  } catch (err) {
    console.error('[invites GET]', err)
    return res.status(500).json({ error: 'Failed to list invite codes' })
  }
})

// DELETE /api/invites/:id — revoke
invitesRouter.delete('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const invite = await prisma.inviteCode.findUnique({ where: { id: req.params.id } })
    if (!invite) return res.status(404).json({ error: 'Invite code not found' })

    if (req.user!.role !== 'superadmin' && invite.createdById !== req.user!.id) {
      return res.status(403).json({ error: "Cannot revoke another manager's code" })
    }

    await prisma.inviteCode.delete({ where: { id: req.params.id } })
    return res.json({ message: 'Invite code revoked' })
  } catch (err) {
    console.error('[invites DELETE]', err)
    return res.status(500).json({ error: 'Failed to revoke invite code' })
  }
})

// POST /api/invites/:id/resend — resend email (superadmin only)
invitesRouter.post('/:id/resend', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const invite = await prisma.inviteCode.findUnique({
      where: { id: req.params.id },
      include: {
        team: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    if (!invite) return res.status(404).json({ error: 'Invite code not found' })
    if (!invite.boundEmail) return res.status(400).json({ error: 'No bound email on this code' })
    if (invite.usedAt) return res.status(400).json({ error: 'Code already used' })
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Code has expired' })

    const invitedBy = `${invite.createdBy.firstName} ${invite.createdBy.lastName}`.trim() || invite.createdBy.email

    let emailSent = false
    if (invite.role === 'manager') {
      emailSent = await sendManagerInviteEmail({
        to: invite.boundEmail, code: invite.code, expiresAt: invite.expiresAt, invitedBy,
      })
    } else if (invite.team) {
      emailSent = await sendPlayerInviteEmail({
        to: invite.boundEmail, code: invite.code, teamName: invite.team.name, expiresAt: invite.expiresAt, invitedBy,
      })
    }

    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: { emailSentAt: emailSent ? new Date() : invite.emailSentAt },
    })

    return res.json({ emailSent })
  } catch (err) {
    console.error('[invites resend]', err)
    return res.status(500).json({ error: 'Failed to resend invite email' })
  }
})

// Standalone public handler for POST /api/invites/validate
export async function validateInviteHandler(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code?: string }
  if (!code) { res.status(400).json({ error: 'code is required' }); return }

  const normCode = normaliseCode(code)

  try {
    const candidates = await prisma.inviteCode.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: {
        team: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    })

    let matched: typeof candidates[0] | null = null
    for (const inv of candidates) {
      if (await verifyCode(normCode, inv.codeHash)) { matched = inv; break }
    }

    if (!matched || matched.useCount >= matched.maxUses) {
      res.json({ valid: false, reason: 'invalid_or_expired' })
      return
    }

    const invitedBy = `${matched.createdBy.firstName} ${matched.createdBy.lastName}`.trim()

    res.json({
      valid: true,
      role: matched.role,
      teamName: matched.team?.name ?? null,
      teamId: matched.teamId,
      invitedBy,
    })
  } catch (err) {
    console.error('[invites validate]', err)
    res.status(500).json({ error: 'Validation failed' })
  }
}

export default invitesRouter
