import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 현재 사용자가 접근 가능한 모든 매장 목록 + 활성 매장 ID */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const userId = session.user.id

  const access = await prisma.userRestaurant.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
    include: {
      restaurant: {
        select: { id: true, name: true, address: true, plan: true },
      },
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeRestaurantId: true, restaurantId: true },
  })

  return NextResponse.json({
    activeRestaurantId: user?.activeRestaurantId ?? user?.restaurantId ?? null,
    restaurants: access.map((a) => ({
      id: a.restaurant.id,
      name: a.restaurant.name,
      address: a.restaurant.address,
      plan: a.restaurant.plan,
      role: a.role,
      isPrimary: a.isPrimary,
    })),
  })
}
