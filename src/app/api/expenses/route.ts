import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ExpenseCategory, ReceiptType } from '@prisma/client'

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

    // 영수증 상태 업데이트
    if (receiptId) {
      await prisma.receiptImage.update({
        where: { id: receiptId },
        data: { status: 'CONFIRMED' },
      }).catch(() => {}) // 영수증 없어도 계속 진행
    }

    // 지출 생성
    const expense = await prisma.expense.create({
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

        // 재고 아이템 조회 또는 생성
        let inventoryItem = await prisma.inventoryItem.findFirst({
          where: {
            restaurantId,
            name: item.name,
            isActive: true,
          },
        })

        if (!inventoryItem) {
          inventoryItem = await prisma.inventoryItem.create({
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

        // 재고 로그 생성
        await prisma.inventoryLog.create({
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
            note: `영수증 자동 입고 (지출 ID: ${expense.id})`,
            expenseId: expense.id,
          },
        })

        // 재고 수량 업데이트
        await prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            currentStock: { increment: item.quantity },
            unitPrice: item.unitPrice || inventoryItem.unitPrice,
          },
        })
      }
    }

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('POST /api/expenses error:', error)
    return NextResponse.json({ error: '지출 등록 실패' }, { status: 500 })
  }
}
