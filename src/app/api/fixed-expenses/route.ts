import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ExpenseCategory } from '@prisma/client'

// GET: 고정비용 목록 조회
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ fixedExpenses })
  } catch (error) {
    console.error('GET /api/fixed-expenses error:', error)
    return NextResponse.json({ error: '고정비용 목록 조회 실패' }, { status: 500 })
  }
}

// POST: 고정비용 등록
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { name, category, amount, billingDay, isDailyCalc } = body as {
      name: string
      category: ExpenseCategory
      amount: number
      billingDay?: number
      isDailyCalc?: boolean
    }

    if (!name?.trim() || !category || !amount) {
      return NextResponse.json({ error: '이름, 카테고리, 금액은 필수입니다' }, { status: 400 })
    }

    if (billingDay !== undefined && billingDay !== null && (billingDay < 1 || billingDay > 31)) {
      return NextResponse.json({ error: '납부일은 1~31 사이여야 합니다' }, { status: 400 })
    }

    const fixedExpense = await prisma.fixedExpense.create({
      data: {
        restaurantId,
        userId: session.user.id,
        name: name.trim(),
        category,
        amount,
        billingDay: billingDay ?? null,
        isDailyCalc: isDailyCalc ?? true,
      },
    })

    return NextResponse.json({ fixedExpense }, { status: 201 })
  } catch (error) {
    console.error('POST /api/fixed-expenses error:', error)
    return NextResponse.json({ error: '고정비용 등록 실패' }, { status: 500 })
  }
}
