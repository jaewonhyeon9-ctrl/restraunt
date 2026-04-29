import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  authKey: z.string().min(1),
  userAgent: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const u = session?.user as { id?: string } | undefined
  if (!u?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 입력' }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: u.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      authKey: parsed.data.authKey,
      userAgent: parsed.data.userAgent ?? null,
    },
    update: {
      userId: u.id,
      p256dh: parsed.data.p256dh,
      authKey: parsed.data.authKey,
      userAgent: parsed.data.userAgent ?? null,
    },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  await auth() // require auth
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'endpoint 누락' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
