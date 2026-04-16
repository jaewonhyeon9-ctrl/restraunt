import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 재고 목록 (안전재고 이하 필터 옵션)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const restaurantId = (session.user as any).restaurantId as string
  const { searchParams } = new URL(request.url)
  const lowStockOnly = searchParams.get('lowStock') === 'true'

  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId,
      isActive: true,
      ...(lowStockOnly
        ? {
            safetyStock: { not: null },
          }
        : {}),
    },
    include: {
      supplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = lowStockOnly
    ? items.filter(
        (item) =>
          item.safetyStock !== null && item.currentStock <= item.safetyStock
      )
    : items

  return NextResponse.json(result)
}

// POST: 재고 품목 등록
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'OWNER') {
    return NextResponse.json({ error: '사장만 재고를 등록할 수 있습니다.' }, { status: 403 })
  }

  const restaurantId = (session.user as any).restaurantId as string

  const body = await request.json()
  const { name, unit, unitPrice, safetyStock, currentStock, category, supplierId } = body

  if (!name || !unit) {
    return NextResponse.json({ error: '품목명과 단위는 필수입니다.' }, { status: 400 })
  }

  const item = await prisma.inventoryItem.create({
    data: {
      restaurantId,
      name,
      unit,
      unitPrice: unitPrice ? Number(unitPrice) : null,
      safetyStock: safetyStock ? Number(safetyStock) : null,
      currentStock: currentStock ? Number(currentStock) : 0,
      category: category || null,
      supplierId: supplierId || null,
    },
    include: {
      supplier: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(item, { status: 201 })
}
