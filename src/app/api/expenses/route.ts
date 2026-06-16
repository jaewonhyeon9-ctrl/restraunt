import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ExpenseCategory, ReceiptType } from '@prisma/client'
import {
  computeReceiptFingerprint,
  isFingerprintReliable,
  dedupeColumnAvailable,
} from '@/lib/receipt-dedup'

const VAT_DEDUCTIBLE_TYPES: ReceiptType[] = ['TAX_INVOICE', 'CARD', 'CASH_RECEIPT']

// GET: 지출 목록 조회 (날짜 또는 월 필터)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')   // YYYY-MM-DD
    const monthParam = searchParams.get('month') // YYYY-MM

    let startDate: Date
    let endDate: Date

    if (dateParam) {
      startDate = new Date(dateParam)
      endDate = new Date(dateParam)
      endDate.setDate(endDate.getDate() + 1)
    } else if (monthParam) {
      const [y, m] = monthParam.split('-').map(Number)
      startDate = new Date(y, m - 1, 1)
      endDate = new Date(y, m, 1)
    } else {
      // 기본: 오늘
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    const expenses = await prisma.expense.findMany({
      where: {
        restaurantId,
        expenseDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        receiptImage: { select: { id: true, imageUrl: true, status: true } },
      },
      orderBy: { expenseDate: 'desc' },
    })

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('GET /api/expenses error:', error)
    return NextResponse.json({ error: '지출 목록 조회 실패' }, { status: 500 })
  }
}

// POST: 지출 등록
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const userId = session.user.id
    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const {
      receiptId,
      supplierId,
      supplierName,
      category,
      receiptType,
      amount,
      expenseDate,
      description,
      autoInventory,
      items,
      force,
    } = body as {
      receiptId?: string
      supplierId?: string
      supplierName?: string
      category: ExpenseCategory
      receiptType?: ReceiptType
      amount: number
      expenseDate: string
      description?: string
      autoInventory?: boolean
      force?: boolean // 중복 경고에도 사용자가 강제 등록
      items?: Array<{
        name: string
        quantity: number
        unit: string
        unitPrice: number
        totalPrice: number
      }>
    }

    const resolvedReceiptType: ReceiptType = receiptType ?? 'NONE'
    const isVatDeductible = VAT_DEDUCTIBLE_TYPES.includes(resolvedReceiptType)

    if (!category || !amount || !expenseDate) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다' }, { status: 400 })
    }

    // 거래처 없이 이름만 입력된 경우 새로 생성하거나 조회
    let resolvedSupplierId = supplierId || null
    if (!resolvedSupplierId && supplierName) {
      const existing = await prisma.supplier.findFirst({
        where: { restaurantId, name: supplierName },
      })
      if (existing) {
        resolvedSupplierId = existing.id
      } else {
        const newSupplier = await prisma.supplier.create({
          data: { restaurantId, name: supplierName },
        })
        resolvedSupplierId = newSupplier.id
      }
    }

    // --- 중복 감지: 이미 확정된 동일 영수증/거래명세서가 있으면 차단 ---
    // 지문은 OCR 단계에서 영수증에 저장해 둔 값을 우선 사용(가장 정확), 없으면 입력값으로 계산.
    // dedupeHash 컬럼이 없는(마이그레이션 전) 환경에서는 중복검사를 건너뛴다.
    const hasDedupeCol = await dedupeColumnAvailable()
    let dedupeHash: string | null = null
    if (hasDedupeCol) {
      if (receiptId) {
        const r = await prisma.receiptImage.findUnique({
          where: { id: receiptId },
          select: { dedupeHash: true },
        })
        dedupeHash = r?.dedupeHash ?? null
      }
      if (!dedupeHash) {
        const fpInput = { supplierName, date: expenseDate, total: amount, items }
        if (isFingerprintReliable(fpInput)) {
          dedupeHash = computeReceiptFingerprint(fpInput)
        }
      }

      if (dedupeHash && !force) {
        const prior = await prisma.receiptImage.findFirst({
          where: {
            restaurantId,
            dedupeHash,
            status: 'CONFIRMED',
            expenses: { some: {} },
            ...(receiptId ? { id: { not: receiptId } } : {}),
          },
          include: {
            expenses: {
              select: { id: true, amount: true, expenseDate: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
        if (prior) {
          return NextResponse.json(
            {
              error: '이미 등록된 영수증/거래명세서입니다. 중복 등록을 막았습니다.',
              code: 'DUPLICATE',
              duplicate: {
                receiptId: prior.id,
                amount: prior.expenses[0]?.amount ?? null,
                expenseDate: prior.expenses[0]?.expenseDate ?? null,
              },
            },
            { status: 409 }
          )
        }
      }
    }

    // 지출 + 영수증 확정 + 재고 입고를 하나의 트랜잭션으로 (부분 실패 방지)
    const expense = await prisma.$transaction(async (tx) => {
      // 영수증 상태 확정 (없으면 updateMany가 0건 처리 — 에러 없이 진행)
      if (receiptId) {
        await tx.receiptImage.updateMany({
          where: { id: receiptId },
          data: {
            status: 'CONFIRMED',
            ...(dedupeHash ? { dedupeHash } : {}),
          },
        })
      }

      const created = await tx.expense.create({
        data: {
          restaurantId,
          userId,
          supplierId: resolvedSupplierId,
          receiptId: receiptId || null,
          category,
          receiptType: resolvedReceiptType,
          isVatDeductible,
          amount,
          expenseDate: new Date(expenseDate),
          description: description || null,
        },
        include: {
          supplier: { select: { id: true, name: true } },
        },
      })

      // 재고 자동 입고 처리
      if (autoInventory && items && items.length > 0) {
        for (const item of items) {
          if (!item.name || item.quantity <= 0) continue

          let inventoryItem = await tx.inventoryItem.findFirst({
            where: { restaurantId, name: item.name, isActive: true },
          })

          if (!inventoryItem) {
            inventoryItem = await tx.inventoryItem.create({
              data: {
                restaurantId,
                supplierId: resolvedSupplierId,
                name: item.name,
                unit: item.unit || '개',
                unitPrice: item.unitPrice || 0,
                currentStock: 0,
              },
            })
          }

          const beforeStock = inventoryItem.currentStock

          await tx.inventoryLog.create({
            data: {
              itemId: inventoryItem.id,
              restaurantId,
              userId,
              type: 'IN',
              quantity: item.quantity,
              beforeStock,
              afterStock: beforeStock + item.quantity,
              unitPrice: item.unitPrice || 0,
              totalPrice: item.totalPrice || 0,
              note: `영수증 자동 입고 (지출 ID: ${created.id})`,
              expenseId: created.id,
            },
          })

          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              currentStock: { increment: item.quantity },
              unitPrice: item.unitPrice || inventoryItem.unitPrice,
            },
          })
        }
      }

      return created
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('POST /api/expenses error:', error)
    return NextResponse.json({ error: '지출 등록 실패' }, { status: 500 })
  }
}
