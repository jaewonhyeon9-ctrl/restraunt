import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 발주 목록
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const restaurantId = (session.user as any).restaurantId as string
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      restaurantId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

// POST: 발주 신청 (직원)
// body: { supplierId, items: [{ itemId, itemName, quantity, unit, unitPrice }], note }
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id as string
  const restaurantId = (session.user as any).restaurantId as string

  const body = await request.json()
  const { supplierId, items, note } = body as {
    supplierId?: string
    items: {
      itemId?: string
      itemName: string
      quantity: number
      unit: string
      unitPrice?: number
    }[]
    note?: string
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '발주 항목이 없습니다.' }, { status: 400 })
  }

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.unitPrice ?? 0) * item.quantity
  }, 0)

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.purchaseOrder.create({
      data: {
        restaurantId,
        supplierId: supplierId || null,
        requestedById: userId,
        orderDate: new Date(),
        status: 'PENDING',
        totalAmount,
        note: note || null,
        items: {
          create: items.map((item) => ({
            itemId: item.itemId || null,
            itemName: item.itemName,
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
            totalPrice: item.unitPrice
              ? Number(item.unitPrice) * Number(item.quantity)
              : null,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    })

    // 사장에게 발주 신청 알림
    const owner = await tx.user.findFirst({
      where: { restaurantId, role: 'OWNER', isActive: true },
    })

    const requester = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    await tx.notification.create({
      data: {
        restaurantId,
        userId: owner?.id ?? null,
        type: 'ORDER_REQUEST',
        title: '발주 신청 알림',
        message: `${requester?.name ?? '직원'}이 발주를 신청했습니다. (${items.length}개 품목, 합계 ${totalAmount.toLocaleString()}원)`,
        referenceId: newOrder.id,
        referenceType: 'PURCHASE_ORDER',
      },
    })

    return newOrder
  })

  return NextResponse.json(order, { status: 201 })
}

// PATCH: 발주 승인/거절 (사장)
// body: { orderId, action: 'APPROVED' | 'CANCELLED', note }
export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'OWNER') {
    return NextResponse.json({ error: '사장만 발주를 승인/거절할 수 있습니다.' }, { status: 403 })
  }

  const userId = session.user.id as string
  const restaurantId = (session.user as any).restaurantId as string

  const body = await request.json()
  const { orderId, action, note } = body as {
    orderId: string
    action: 'APPROVED' | 'CANCELLED'
    note?: string
  }

  if (!orderId || !action) {
    return NextResponse.json({ error: 'orderId와 action이 필요합니다.' }, { status: 400 })
  }

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
  })
  if (!existing) {
    return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: '대기 중인 발주만 처리할 수 있습니다.' }, { status: 400 })
  }

  const updated = await prisma.purchaseOrder.update({
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

  // 신청자에게 결과 알림
  await prisma.notification.create({
    data: {
      restaurantId,
      userId: existing.requestedById,
      type: action === 'APPROVED' ? 'ORDER_APPROVED' : 'ORDER_CANCELLED',
      title: action === 'APPROVED' ? '발주 승인됨' : '발주 거절됨',
      message:
        action === 'APPROVED'
          ? '신청하신 발주가 승인되었습니다.'
          : `신청하신 발주가 거절되었습니다.${note ? ` 사유: ${note}` : ''}`,
      referenceId: orderId,
      referenceType: 'PURCHASE_ORDER',
    },
  })

  return NextResponse.json(updated)
}
