import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/sales/menu-items/[saleItemId]
 *
 * 잘못 입력한 매출 항목 취소 — 트랜잭션으로 되돌림.
 *  1) SaleItem 삭제
 *  2) 메뉴 레시피로 차감했던 재고 원복 (currentStock 가산)
 *  3) 해당 차감의 InventoryLog 가산형 보정 기록
 *  4) Sale.amount 에서 SaleItem.subtotal 차감
 *  5) Sale에 남은 SaleItem 없으면 Sale도 삭제
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ saleItemId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const userId = session.user.id
  const role = (session.user as { role?: string }).role
  if (role !== 'OWNER' && role !== 'MANAGER') {
    return NextResponse.json({ error: '사장·점장만 취소 가능' }, { status: 403 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const { saleItemId } = await params

  // 검증 + 레시피 조회 (트랜잭션 외부 read)
  const item = await prisma.saleItem.findFirst({
    where: { id: saleItemId, sale: { restaurantId } },
    include: {
      sale: { select: { id: true, amount: true } },
      menu: {
        include: {
          recipes: {
            include: { inventoryItem: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })
  if (!item) {
    return NextResponse.json({ error: '매출 항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    // 재고 원복
    if (item.menu) {
      for (const recipe of item.menu.recipes) {
        const qtyToRestore = recipe.qtyUsed * item.qty
        await tx.inventoryItem.update({
          where: { id: recipe.inventoryItemId },
          data: { currentStock: { increment: qtyToRestore } },
        })
        await tx.inventoryLog.create({
          data: {
            itemId: recipe.inventoryItemId,
            restaurantId,
            userId,
            type: 'IN',
            quantity: qtyToRestore,
            note: `매출 항목 취소: ${item.menu.name} × ${item.qty}`,
          },
        })
      }
    }

    // SaleItem 삭제
    await tx.saleItem.delete({ where: { id: saleItemId } })

    // Sale.amount 감산
    const newAmount = Math.max(0, item.sale.amount - item.subtotal)
    const remainingItems = await tx.saleItem.count({ where: { saleId: item.sale.id } })
    if (remainingItems === 0) {
      // 항목이 모두 삭제되면 Sale 자체도 삭제
      await tx.sale.delete({ where: { id: item.sale.id } })
    } else {
      await tx.sale.update({
        where: { id: item.sale.id },
        data: { amount: newAmount },
      })
    }
  })

  return NextResponse.json({ ok: true })
}