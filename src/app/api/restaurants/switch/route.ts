import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  restaurantId: z.string().min(1),
})

/** 활성 매장 전환 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const userId = session.user.id

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 권한 확인 — 사용자가 해당 매장에 접근 권한 있는지
  const access = await prisma.userRestaurant.findUnique({
    where: {
      userId_restaurantId: {
        userId,
        restaurantId: parsed.data.restaurantId,
      },
    },
  })
  if (!access) {
    return NextResponse.json({ error: '접근 권한 없음' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeRestaurantId: parsed.data.restaurantId },
  })

  return NextResponse.json({
    ok: true,
    activeRestaurantId: parsed.data.restaurantId,
  })
}
