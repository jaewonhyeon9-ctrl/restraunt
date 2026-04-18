import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type OrderStatus = 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'OWNER') {
    return NextResponse.json({ error: '사장만 발주 상태를 변경할 수 있습니다.' }, { status: 403 })
  }

  const userId = session.user.id as string
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const { id: orderId } = await params

  let body: { action: OrderStatus; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { action, note } = body
  if (!action || !['APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(action)) {
    return NextResponse.json({ error: '유효한 action이 필요합니다.' }, { status: 400 })
  }

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
    include: { items: true },
  })
  if (!existing) {
    return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status as OrderStatus] ?? []
  if (!allowed.includes(action)) {
    return NextResponse.json(
      { error: `${existing.status} 상태에서는 ${action}(으)로 변경할 수 없습니다.` },
      { status: 400 }
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        status: action,
        approvedById: userId,
        note: note ?? existing.note,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
        requestedBy: { select: { id: true, name: true } },
      },
    })

    // RECEIVED 전이: 재고 자동 증가 + 입고 로그
    if (action === 'RECEIVED') {
      for (const item of existing.items) {
        if (!item.itemId) continue
        const inv = await tx.inventoryItem.findUnique({
          where: { id: item.itemId },
          select: { currentStock: true },
        })
        if (!inv) continue
        const before = inv.currentStock
        const after = before + item.quantity

        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data: { currentStock: after },
        })

        await tx.inventoryLog.create({
          data: {
            itemId: item.itemId,
            restaurantId,
            userId,
            type: 'ORDER_IN',
            quantity: item.quantity,
            beforeStock: before,
            afterStock: after,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            note: `발주 입고 (발주 #${orderId.slice(-6)})`,
          },
        })
      }
    }

    await tx.notification.create({
      data: {
        restaurantId,
        userId: existing.requestedById,
        type: `ORDER_${action}`,
        title:
          action === 'APPROVED' ? '발주 승인됨'
          : action === 'ORDERED' ? '발주 주문 완료'
          : action === 'RECEIVED' ? '발주 입고 완료'
          : '발주 취소됨',
        message:
          action === 'APPROVED' ? '신청하신 발주가 승인되었습니다.'
          : action === 'ORDERED' ? '발주가 거래처에 주문되었습니다.'
          : action === 'RECEIVED' ? '발주 품목이 입고되어 재고에 반영되었습니다.'
          : `발주가 취소되었습니다.${note ? ` 사유: ${note}` : ''}`,
        referenceId: orderId,
        referenceType: 'PURCHASE_ORDER',
      },
    })

    return order
  })

  return NextResponse.json(updated)
}
