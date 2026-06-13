import bcrypt from 'bcrypt'
import prisma from './prisma'

// Wipes all application data when WIPE_ALL_DATA=true is set.
// After the first deploy with this flag, remove it from Railway so it never fires again.
export async function wipeAllDataIfRequested() {
  if (process.env.WIPE_ALL_DATA !== 'true') return

  console.log('[wipe] WIPE_ALL_DATA=true detected — deleting all data...')

  await prisma.$executeRaw`
    TRUNCATE TABLE
      priority_outcomes,
      training_priorities,
      match_analysis,
      notification_logs,
      push_subscriptions,
      rsvps,
      training_sessions,
      substitutions,
      timeouts,
      rallies,
      sets,
      match_players,
      matches,
      seasons,
      players,
      invite_codes,
      team_members,
      users,
      teams
    RESTART IDENTITY CASCADE
  `

  console.log('[wipe] All data deleted.')
  console.log('[wipe] !! REMOVE the WIPE_ALL_DATA env var from Railway now, then redeploy !!')
}

export async function seedSuperAdmin() {
  const email    = process.env.SUPERADMIN_EMAIL
  const password = process.env.SUPERADMIN_PASSWORD

  if (!email || !password) {
    console.log('[seed] SUPERADMIN_EMAIL/PASSWORD not set — skipping superadmin seed')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        ...(existing.role !== 'superadmin' ? { role: 'superadmin' } : {}),
      },
    })
    console.log(`[seed] Superadmin credentials synced: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: '',
      role: 'superadmin',
      onboardingDone: true,
    },
  })
  console.log(`[seed] Superadmin created: ${email}`)
}
