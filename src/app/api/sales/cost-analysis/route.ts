import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/sales/cost-analysis?month=YYYY-MM
 *
 * SaleItem.costAtSale 스냅샷 기반 실제 원가율 분석.
 * 청구 #9의 핵심 효과 — "단가 변동 후에도 과거 매출의 원가는 보존" 을 데이터로 증명.
 *
 * 응답:
 *  - byMenu: 메뉴별 합산 원가율 (실제 판매된 데이터 기준)
 *  - byCategory: 카테고리별 원가율
 *  - overall: 식당 전체 원가율
 *  - timeline: 일자별 원가율 추이 (당월)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month') // YYYY-MM
  const now = new Date()
  const [y, m] = monthParam
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1]
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)

  // 해당 월의 SaleItem 전체 (costAtSale 보존된 스냅샷)
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        restaurantId,
        saleDate: { gte: start, lt: end },
      },
      costAtSale: { not: null },
    },
    include: {
      sale: { select: { saleDate: true } },
      menu: { select: { id: true, name: true, category: true, price: true } },
    },
  })

  // 메뉴별 집계
  const menuMap = new Map<
    string,
    {
      menuId: string
      menuName: string
      category: string | null
      qty: number
      revenue: number
      cost: number
    }
  >()

  // 카테고리별 집계
  const catMap = new Map<string, { revenue: number; cost: number; qty: number }>()

  // 일자별 집계
  const dayMap = new Map<string, { revenue: number; cost: number }>()

  let totalRevenue = 0
  let totalCost = 0
  let totalSnapshots = 0

  for (const it of saleItems) {
    const cost = it.costAtSale ?? 0
    const revenue = it.subtotal
    totalRevenue += revenue
    totalCost += cost
    totalSnapshots += 1

    const menuId = it.menuId ?? 'unmapped'
    const menuName = it.menu?.name ?? it.rawName
    const category = it.menu?.category ?? null

    const m = menuMap.get(menuId) ?? {
      menuId,
      menuName,
      category,
      qty: 0,
      revenue: 0,
      cost: 0,
    }
    m.qty += it.qty
    m.revenue += revenue
    m.cost += cost
    menuMap.set(menuId, m)

    const catKey = category ?? '미분류'
    const c = catMap.get(catKey) ?? { revenue: 0, cost: 0, qty: 0 }
    c.revenue += revenue
    c.cost += cost
    c.qty += it.qty
    catMap.set(catKey, c)

    const dayKey = it.sale.saleDate.toISOString().slice(0, 10)
    const d = dayMap.get(dayKey) ?? { revenue: 0, cost: 0 }
    d.revenue += revenue
    d.cost += cost
    dayMap.set(dayKey, d)
  }

  const byMenu = Array.from(menuMap.values())
    .map((m) => ({
      ...m,
      costRatio: m.revenue > 0 ? (m.cost / m.revenue) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({
      category,
      ...v,
      costRatio: v.revenue > 0 ? (v.cost / v.revenue) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const timeline = Array.from(dayMap.entries())
    .map(([date, v]) => ({
      date,
      ...v,
      costRatio: v.revenue > 0 ? (v.cost / v.revenue) * 100 : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    month: `${y}-${String(m).padStart(2, '0')}`,
    overall: {
      revenue: totalRevenue,
      cost: totalCost,
      costRatio: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : null,
      itemCount: totalSnapshots,
    },
    byMenu,
    byCategory,
    timeline,
  })
}