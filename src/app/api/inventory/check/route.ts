import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST: 재고 파악 입력 (직원)
// body: { items: [{ itemId, quantity }] }
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id as string
  const restaurantId = (session.user as any).restaurantId as string

  const body = await request.json()
  const { items } = body as { items: { itemId: string; quantity: number }[] }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '재고 항목이 없습니다.' }, { status: 400 })
  }

  const results = await prisma.$transaction(async (tx) => {
    const logs = []
    const lowStockItems: string[] = []

    for (const { itemId, quantity } of items) {
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, restaurantId, isActive: true },
      })
      if (!item) continue

      const beforeStock = item.currentStock
      const afterStock = Number(quantity)

      // 재고 업데이트
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: afterStock },
      })

      // ADJUST 로그 기록
      const log = await tx.inventoryLog.create({
        data: {
          itemId,
          restaurantId,
          userId,
          type: 'ADJUST',
          quantity: afterStock - beforeStock,
          beforeStock,
          afterStock,
          note: '재고 파악',
        },
      })
      logs.push(log)

      // 안전재고 이하 체크
      if (item.safetyStock !== null && afterStock <= item.safetyStock) {
        lowStockItems.push(item.name)
      }
    }

    // 안전재고 이하 품목 알림 생성 (사장에게)
    if (lowStockItems.length > 0) {
      const owner = await tx.user.findFirst({
        where: { restaurantId, role: 'OWNER', isActive: true },
      })

      await tx.notification.create({
        data: {
          restaurantId,
          userId: owner?.id ?? null,
          type: 'LOW_STOCK',
          title: '안전재고 이하 품목 알림',
          message: `재고 파악 후 안전재고 이하 품목: ${lowStockItems.join(', ')}`,
          referenceType: 'INVENTORY',
        },
      })
    }

    return { logs, lowStockCount: lowStockItems.length }
  })

  return NextResponse.json({
    success: true,
    logCount: results.logs.length,
    lowStockCount: results.lowStockCount,
  })
}
