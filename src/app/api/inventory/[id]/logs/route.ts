import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inventory/[id]/logs?limit=50
 *
 * 특정 재고 항목의 변동 이력 (입고/출고/조정).
 * 메뉴 판매로 인한 자동 차감, 거래명세서 OCR 입고, 수동 조정 등이 모두 시간순 기록됨.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }
  const { id } = await params

  const item = await prisma.inventoryItem.findFirst({
    where: { id, restaurantId },
    select: { id: true },
  })
  if (!item) {
    return NextResponse.json({ error: '품목을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100), 1), 500)

  const logs = await prisma.inventoryLog.findMany({
    where: { itemId: id, restaurantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      quantity: l.quantity,
      beforeStock: l.beforeStock,
      afterStock: l.afterStock,
      note: l.note,
      userName: l.user?.name ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  })
}