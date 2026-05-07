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

/** 1개 메뉴의 레시피로부터 원가/원가율 계산 */
function computeCost(
  recipes: { qtyUsed: number; inventoryItem: { unitPrice: number | null } }[],
  price: number,
): { totalCost: number; costRatio: number | null; missingPriceCount: number } {
  let total = 0
  let missing = 0
  for (const r of recipes) {
    if (r.inventoryItem.unitPrice == null) {
      missing++
      continue
    }
    total += r.qtyUsed * r.inventoryItem.unitPrice
  }
  const ratio = price > 0 ? (total / price) * 100 : null
  return { totalCost: total, costRatio: ratio, missingPriceCount: missing }
}

// GET: 메뉴 목록 + 메뉴별 원가율
export async function GET() {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const menus = await prisma.menu.findMany({
    where: { restaurantId: ctx.restaurantId, isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      recipes: {
        include: {
          inventoryItem: {
            select: { id: true, name: true, unit: true, unitPrice: true },
          },
        },
      },
    },
  })

  const result = menus.map((m) => {
    const cost = computeCost(m.recipes, m.price)
    return {
      id: m.id,
      name: m.name,
      price: m.price,
      category: m.category,
      isActive: m.isActive,
      costRatioThreshold: m.costRatioThreshold,
      cookingSteps: m.cookingSteps,
      imageUrl: m.imageUrl,
      recipeCount: m.recipes.length,
      totalCost: cost.totalCost,
      costRatio: cost.costRatio,
      missingPriceCount: cost.missingPriceCount,
    }
  })

  return NextResponse.json(result)
}

// POST: 메뉴 생성
export async function POST(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  let body: { name?: string; price?: number; category?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const name = body.name?.trim()
  const price = Number(body.price)
  if (!name) {
    return NextResponse.json({ error: '메뉴 이름은 필수입니다.' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: '가격을 올바르게 입력해주세요.' }, { status: 400 })
  }

  const menu = await prisma.menu.create({
    data: {
      restaurantId: ctx.restaurantId,
      name,
      price,
      category: body.category?.trim() || null,
    },
  })

  return NextResponse.json(menu, { status: 201 })
}
