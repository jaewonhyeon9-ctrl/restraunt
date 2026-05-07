/**
 * 메뉴 기반 매출 등록 + 레시피 기반 다중 재고 자동 차감 + 원가 스냅샷
 *
 * 청구 #9 핵심 구현. 이 함수가 특허의 5단계를 수행한다.
 *  1) 매출 항목 분해 (메뉴 + 수량)
 *  2) 레시피 조회 및 차감량 계산
 *  3) 식자재 단가 스냅샷 캡처 (costAtSale)
 *  4) 다중 재고 원자적 감산 (단일 트랜잭션)
 *  5) 원가율 갱신 + 임계 초과 검출
 */

import { prisma } from '@/lib/prisma'

export interface MenuSaleItemInput {
  menuId: string
  qty: number
  /** 옵션: 메뉴 정가와 다른 가격으로 판매할 때 (할인 등) */
  customUnitPrice?: number
}

export interface RecordedSaleItem {
  saleItemId: string
  menuId: string
  menuName: string
  qty: number
  unitPrice: number
  subtotal: number
  /** 판매 시점 원가 (= 1메뉴당 원가 × 수량) */
  costAtSale: number
  /** 메뉴별 원가율 (%) */
  costRatio: number
  /** 임계 원가율 초과 시 메뉴 임계값, 정상이면 null */
  exceededThreshold: number | null
}

export interface SaleRecordResult {
  saleId: string
  saleDate: Date
  totalAmount: number
  totalCost: number
  costRatio: number
  items: RecordedSaleItem[]
  alerts: {
    type: 'menu' | 'global'
    menuId?: string
    menuName?: string
    ratio: number
    threshold: number
  }[]
}

export async function recordMenuSale(args: {
  restaurantId: string
  userId: string
  saleDate: Date
  items: MenuSaleItemInput[]
  cashAmount?: number
  cardAmount?: number
  deliveryAmount?: number
  note?: string | null
}): Promise<SaleRecordResult> {
  if (args.items.length === 0) {
    throw new Error('판매 항목이 비어있습니다.')
  }

  // 1) 메뉴 + 레시피 + 식자재 단가 일괄 조회 (read-only, 트랜잭션 외부)
  const menuIds = Array.from(new Set(args.items.map((i) => i.menuId)))
  const menus = await prisma.menu.findMany({
    where: { id: { in: menuIds }, restaurantId: args.restaurantId, isActive: true },
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
  const menuMap = new Map(menus.map((m) => [m.id, m]))
  for (const it of args.items) {
    if (!menuMap.has(it.menuId)) {
      throw new Error(`메뉴를 찾을 수 없습니다 (id: ${it.menuId})`)
    }
    if (!Number.isFinite(it.qty) || it.qty <= 0 || !Number.isInteger(it.qty)) {
      throw new Error('수량은 1 이상의 정수여야 합니다.')
    }
  }

  // 2) 식당 전체 임계값 조회
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: args.restaurantId },
    select: { globalCostRatioThreshold: true },
  })

  // 3) 사전 계산: 각 SaleItem의 원가/원가율과 재고 차감 계획
  type Computed = {
    input: MenuSaleItemInput
    menu: (typeof menus)[number]
    unitPrice: number
    subtotal: number
    oneMenuCost: number
    itemCostAtSale: number
    itemRatio: number
    deductions: { inventoryItemId: string; qtyToDeduct: number; itemName: string }[]
  }
  const computed: Computed[] = args.items.map((input) => {
    const menu = menuMap.get(input.menuId)!
    const unitPrice = input.customUnitPrice ?? menu.price
    const subtotal = unitPrice * input.qty
    let oneMenuCost = 0
    const deductions: Computed['deductions'] = []
    for (const recipe of menu.recipes) {
      const inv = recipe.inventoryItem
      oneMenuCost += (inv.unitPrice ?? 0) * recipe.qtyUsed
      deductions.push({
        inventoryItemId: inv.id,
        qtyToDeduct: recipe.qtyUsed * input.qty,
        itemName: inv.name,
      })
    }
    const itemCostAtSale = oneMenuCost * input.qty
    const itemRatio = unitPrice > 0 ? (oneMenuCost / unitPrice) * 100 : 0
    return { input, menu, unitPrice, subtotal, oneMenuCost, itemCostAtSale, itemRatio, deductions }
  })

  const totalAmount = computed.reduce((s, c) => s + c.subtotal, 0)
  const totalCost = computed.reduce((s, c) => s + c.itemCostAtSale, 0)
  const totalRatio = totalAmount > 0 ? (totalCost / totalAmount) * 100 : 0

  // 4) 트랜잭션: Sale upsert + SaleItem 생성 + 다중 재고 감산 + InventoryLog
  const dayStart = new Date(args.saleDate)
  dayStart.setHours(0, 0, 0, 0)

  const sale = await prisma.$transaction(async (tx) => {
    // Sale upsert (같은 날짜는 누적)
    const existing = await tx.sale.findUnique({
      where: {
        restaurantId_saleDate: { restaurantId: args.restaurantId, saleDate: dayStart },
      },
    })
    let saleRow: { id: string; saleDate: Date }
    if (existing) {
      const updated = await tx.sale.update({
        where: { id: existing.id },
        data: {
          amount: existing.amount + totalAmount,
          cashAmount: existing.cashAmount + (args.cashAmount ?? 0),
          cardAmount: existing.cardAmount + (args.cardAmount ?? 0),
          deliveryAmount: existing.deliveryAmount + (args.deliveryAmount ?? 0),
          ...(args.note != null && { note: args.note }),
        },
      })
      saleRow = { id: updated.id, saleDate: updated.saleDate }
    } else {
      const created = await tx.sale.create({
        data: {
          restaurantId: args.restaurantId,
          userId: args.userId,
          saleDate: dayStart,
          amount: totalAmount,
          cashAmount: args.cashAmount ?? 0,
          cardAmount: args.cardAmount ?? 0,
          deliveryAmount: args.deliveryAmount ?? 0,
          note: args.note ?? null,
        },
      })
      saleRow = { id: created.id, saleDate: created.saleDate }
    }

    // 각 항목별: SaleItem 생성 + 다중 재고 감산 + InventoryLog
    const recorded: RecordedSaleItem[] = []
    for (const c of computed) {
      const item = await tx.saleItem.create({
        data: {
          saleId: saleRow.id,
          menuId: c.menu.id,
          rawName: c.menu.name,
          qty: c.input.qty,
          unitPrice: c.unitPrice,
          subtotal: c.subtotal,
          costAtSale: c.itemCostAtSale, // ★ 판매 시점 원가 스냅샷
        },
      })

      // 다중 재고 동시 감산 (트랜잭션 원자성)
      for (const d of c.deductions) {
        await tx.inventoryItem.update({
          where: { id: d.inventoryItemId },
          data: { currentStock: { decrement: d.qtyToDeduct } },
        })
        await tx.inventoryLog.create({
          data: {
            itemId: d.inventoryItemId,
            restaurantId: args.restaurantId,
            userId: args.userId,
            type: 'OUT',
            quantity: d.qtyToDeduct,
            note: `메뉴 판매 차감: ${c.menu.name} × ${c.input.qty}`,
          },
        })
      }

      recorded.push({
        saleItemId: item.id,
        menuId: c.menu.id,
        menuName: c.menu.name,
        qty: c.input.qty,
        unitPrice: c.unitPrice,
        subtotal: c.subtotal,
        costAtSale: c.itemCostAtSale,
        costRatio: c.itemRatio,
        exceededThreshold:
          c.menu.costRatioThreshold != null && c.itemRatio > c.menu.costRatioThreshold
            ? c.menu.costRatioThreshold
            : null,
      })
    }

    return { saleRow, recorded }
  })

  // 5) 임계 초과 검출
  const alerts: SaleRecordResult['alerts'] = []
  for (const r of sale.recorded) {
    if (r.exceededThreshold != null) {
      alerts.push({
        type: 'menu',
        menuId: r.menuId,
        menuName: r.menuName,
        ratio: r.costRatio,
        threshold: r.exceededThreshold,
      })
    }
  }
  if (
    restaurant?.globalCostRatioThreshold != null &&
    totalRatio > restaurant.globalCostRatioThreshold
  ) {
    alerts.push({
      type: 'global',
      ratio: totalRatio,
      threshold: restaurant.globalCostRatioThreshold,
    })
  }

  return {
    saleId: sale.saleRow.id,
    saleDate: sale.saleRow.saleDate,
    totalAmount,
    totalCost,
    costRatio: totalRatio,
    items: sale.recorded,
    alerts,
  }
}
