import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

let configured = false
function ensureConfigured() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@restraunt-ebon-phi.vercel.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured()
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return { sent: 0, removed: 0 }

  let sent = 0
  let removed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.authKey },
          },
          JSON.stringify(payload),
        )
        sent++
      } catch (err) {
        const e = err as { statusCode?: number }
        if (e.statusCode === 404 || e.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
          removed++
        }
      }
    }),
  )
  return { sent, removed }
}
