import { api } from './api'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
const PROMPT_DISMISS_KEY = 'pushPromptDismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  })

  // Use the shared api client so the call goes to VITE_API_URL with the Bearer
  // token (a relative fetch would hit the web origin's nginx proxy and bypass auth).
  // If the server save fails, surface it instead of falsely reporting success.
  try {
    await api.post('/api/push/subscribe', subscription.toJSON())
  } catch {
    return false
  }

  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration  = await navigator.serviceWorker.ready
  const subscription  = await registration.pushManager.getSubscription()
  if (!subscription) return

  await subscription.unsubscribe()

  try {
    await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint })
  } catch {
    /* local unsubscribe already done; ignore server cleanup failure */
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}

export function getPushDismissCount(): number {
  return parseInt(localStorage.getItem(PROMPT_DISMISS_KEY) ?? '0', 10)
}

export function incrementPushDismissCount(): void {
  localStorage.setItem(PROMPT_DISMISS_KEY, String(getPushDismissCount() + 1))
}

export function shouldShowPushPrompt(): boolean {
  return getPushDismissCount() < 2 && 'Notification' in window && Notification.permission === 'default'
}
