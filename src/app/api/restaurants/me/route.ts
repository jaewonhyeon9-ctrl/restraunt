import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 현재 사용자가 접근 가능한 모든 매장 목록 + 활성 매장 ID + 매장별 초기 설정 진행 상태 */
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
        select: {
          id: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          plan: true,
          _count: {
            select: {
              fixedExpenses: true,
              suppliers: true,
              users: {
                where: {
                  role: { in: ['MANAGER', 'DEPUTY', 'STAFF', 'EMPLOYEE'] },
                  isActive: true,
                },
              },
            },
          },
        },
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
      lat: a.restaurant.lat,
      lng: a.restaurant.lng,
      plan: a.restaurant.plan,
      role: a.role,
      isPrimary: a.isPrimary,
      setup: {
        hasAddress: !!a.restaurant.address,
        hasLocation: a.restaurant.lat != null && a.restaurant.lng != null,
        fixedExpenseCount: a.restaurant._count.fixedExpenses,
        employeeCount: a.restaurant._count.users,
        supplierCount: a.restaurant._count.suppliers,
      },
    })),
  })
}
