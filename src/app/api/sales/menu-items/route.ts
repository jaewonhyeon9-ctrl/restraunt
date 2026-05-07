import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordMenuSale, type MenuSaleItemInput } from '@/lib/sale-with-items'
import { sendPushToUser } from '@/lib/push'

/**
 * GET /api/sales/menu-items?date=YYYY-MM-DD
 *
 * 특정 날짜에 기록된 메뉴 매출 항목 목록 (최신순).
 * 취소 버튼 노출용.
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
  const dateParam = searchParams.get('date')
  const day = dateParam ? new Date(dateParam) : new Date()
  day.setHours(0, 0, 0, 0)
  const next = new Date(day)
  next.setDate(next.getDate() + 1)

  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        restaurantId,
        saleDate: { gte: day, lt: next },
      },
    },
    include: {
      sale: { select: { saleDate: true } },
      menu: { select: { id: true, name: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    items: items.map((it) => ({
      id: it.id,
      menuId: it.menuId,
      menuName: it.menu?.name ?? it.rawName,
      category: it.menu?.category ?? null,
      qty: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
      costAtSale: it.costAtSale,
      createdAt: it.createdAt.toISOString(),
    })),
  })
}

/**
 * POST /api/sales/menu-items — 청구 #9 핵심 API.
 * (자세한 동작은 lib/sale-with-items.ts 주석 참고)
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const userId = session.user.id
  const role = (session.user as { role?: string }).role
  if (role !== 'OWNER' && role !== 'MANAGER') {
    return NextResponse.json({ error: '사장·점장만 매출 등록 가능' }, { status: 403 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  let body: {
    saleDate?: string
    items?: MenuSaleItemInput[]
    cashAmount?: number
    cardAmount?: number
    deliveryAmount?: number
    note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  if (!body.saleDate) {
    return NextResponse.json({ error: '판매 날짜는 필수입니다.' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: '판매 항목은 1개 이상이어야 합니다.' }, { status: 400 })
  }

  let result
  try {
    result = await recordMenuSale({
      restaurantId,
      userId,
      saleDate: new Date(body.saleDate),
      items: body.items,
      cashAmount: body.cashAmount,
      cardAmount: body.cardAmount,
      deliveryAmount: body.deliveryAmount,
      note: body.note ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '매출 등록 실패' },
      { status: 400 },
    )
  }

  if (result.alerts.length > 0) {
    const owners = await prisma.userRestaurant.findMany({
      where: { restaurantId, role: { in: ['OWNER', 'MANAGER'] } },
      select: { userId: true },
    })
    const summary = result.alerts
      .map((a) =>
        a.type === 'menu'
          ? `${a.menuName} ${a.ratio.toFixed(1)}% (임계 ${a.threshold}%)`
          : `식당 전체 ${a.ratio.toFixed(1)}% (임계 ${a.threshold}%)`,
      )
      .join(', ')
    await Promise.all(
      owners.map((o) =>
        sendPushToUser(o.userId, {
          title: '⚠️ 원가율 임계 초과',
          body: `원가율이 임계값을 초과했습니다: ${summary}`,
          url: '/menu',
        }).catch(() => undefined),
      ),
    )
  }

  return NextResponse.json(result, { status: 201 })
}