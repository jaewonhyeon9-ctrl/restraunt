import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/menus/manual
 *
 * 직원용 조리 매뉴얼 조회 — 모든 역할 가능 (원가/판매가 정보 제외).
 * 메뉴별 사진, 레시피(재료+양), 조리 단계 노출.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const menus = await prisma.menu.findMany({
    where: { restaurantId, isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      recipes: {
        include: {
          inventoryItem: { select: { id: true, name: true, unit: true } },
        },
      },
    },
  })

  return NextResponse.json({
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      imageUrl: m.imageUrl,
      cookingSteps: m.cookingSteps,
      recipes: m.recipes.map((r) => ({
        itemName: r.inventoryItem.name,
        qtyUsed: r.qtyUsed,
        unit: r.inventoryItem.unit,
      })),
    })),
  })
}