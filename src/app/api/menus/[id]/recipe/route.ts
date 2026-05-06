import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireOwner() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'OWNER' && user.role !== 'MANAGER')
    return { error: '권한이 부족합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { restaurantId: user.restaurantId }
}

/** PUT: 메뉴의 레시피 전체 교체 (배열 통째로 갈아끼움) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id: menuId } = await params

  const menu = await prisma.menu.findFirst({
    where: { id: menuId, restaurantId: ctx.restaurantId },
    select: { id: true },
  })
  if (!menu) {
    return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    recipes?: { inventoryItemId: string; qtyUsed: number }[]
  }
  const recipes = Array.isArray(body.recipes) ? body.recipes : []

  // 같은 매장의 재고만 허용
  const itemIds = recipes.map((r) => r.inventoryItemId)
  if (itemIds.length > 0) {
    const validItems = await prisma.inventoryItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId: ctx.restaurantId,
        isActive: true,
      },
      select: { id: true },
    })
    if (validItems.length !== new Set(itemIds).size) {
      return NextResponse.json(
        { error: '유효하지 않은 재고 항목이 포함되어 있습니다.' },
        { status: 400 },
      )
    }
  }

  // qty 검증
  for (const r of recipes) {
    if (!Number.isFinite(r.qtyUsed) || r.qtyUsed <= 0) {
      return NextResponse.json(
        { error: '레시피 수량은 0보다 커야 합니다.' },
        { status: 400 },
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.menuRecipe.deleteMany({ where: { menuId } })
    if (recipes.length > 0) {
      await tx.menuRecipe.createMany({
        data: recipes.map((r) => ({
          menuId,
          inventoryItemId: r.inventoryItemId,
          qtyUsed: r.qtyUsed,
        })),
      })
    }
  })

  return NextResponse.json({ ok: true, count: recipes.length })
}
