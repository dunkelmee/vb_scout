import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

const router = Router()

function parseDeviceLabel(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Android/.test(userAgent)) {
    if (/Chrome/.test(userAgent)) return 'Chrome on Android'
    return 'Android'
  }
  if (/Chrome/.test(userAgent)) return 'Chrome'
  if (/Firefox/.test(userAgent)) return 'Firefox'
  if (/Safari/.test(userAgent)) return 'Safari'
  return 'Browser'
}

// POST /api/push/subscribe
router.post('/subscribe', async (req: Request, res: Response) => {
  const { endpoint, keys, expirationTime } = req.body as {
    endpoint?: string
    keys?: unknown
    expirationTime?: unknown
  }
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })

  const userAgent  = req.headers['user-agent'] ?? ''
  const deviceLabel = parseDeviceLabel(userAgent)

  try {
    await prisma.pushSubscription.upsert({
      where:  { userId_endpoint: { userId: req.user!.id, endpoint } },
      update: { subscription: JSON.stringify(req.body), lastUsedAt: new Date() },
      create: {
        userId:       req.user!.id,
        endpoint,
        subscription: JSON.stringify(req.body),
        deviceLabel,
      },
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    res.status(500).json({ error: 'Failed to register subscription' })
  }
})

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string }
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })

  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId: req.user!.id, endpoint },
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    res.status(500).json({ error: 'Failed to remove subscription' })
  }
})

// GET /api/push/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: req.user!.id },
      select: { id: true, deviceLabel: true, lastUsedAt: true },
    })
    res.json({ subscribed: subscriptions.length > 0, devices: subscriptions })
  } catch (err) {
    console.error('[push/status]', err)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

export default router
