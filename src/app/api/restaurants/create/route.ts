import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  name: z.string().min(1).max(60),
  address: z.string().max(120).nullish(),
})

/** 새 매장 생성 — 현재 사용자가 자동으로 OWNER + 활성 매장으로 전환 */
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

  // 사장만 새 매장 생성 가능
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!me || me.role !== 'OWNER') {
    return NextResponse.json({ error: '사장만 매장 생성 가능' }, { status: 403 })
  }

  const restaurant = await prisma.$transaction(async (tx) => {
    const r = await tx.restaurant.create({
      data: {
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        plan: 'FREE',
      },
    })

    // 사용자에게 OWNER 권한 부여
    await tx.userRestaurant.create({
      data: {
        userId,
        restaurantId: r.id,
        role: 'OWNER',
        isPrimary: false,
      },
    })

    // 새 매장으로 자동 전환
    await tx.user.update({
      where: { id: userId },
      data: { activeRestaurantId: r.id },
    })

    return r
  })

  return NextResponse.json({
    ok: true,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
    },
  })
}
