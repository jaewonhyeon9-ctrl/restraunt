import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 매출 조회 (날짜 또는 월 필터)
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

    const sales = await prisma.sale.findMany({
      where: {
        restaurantId,
        saleDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { saleDate: 'desc' },
    })

    // 월별 집계 합산 (월 조회 시 summary 추가)
    if (monthParam) {
      const totalSales = sales.reduce((sum, s) => sum + s.amount, 0)
      const totalCash = sales.reduce((sum, s) => sum + s.cashAmount, 0)
      const totalCard = sales.reduce((sum, s) => sum + s.cardAmount, 0)
      const totalDelivery = sales.reduce((sum, s) => sum + s.deliveryAmount, 0)

      return NextResponse.json({
        sales,
        summary: { totalSales, totalCash, totalCard, totalDelivery },
      })
    }

    return NextResponse.json({ sales })
  } catch (error) {
    console.error('GET /api/sales error:', error)
    return NextResponse.json({ error: '매출 조회 실패' }, { status: 500 })
  }
}

// POST: 매출 등록 또는 수정 (upsert - 날짜당 하나)
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
      saleDate,
      amount,
      cashAmount = 0,
      cardAmount = 0,
      deliveryAmount = 0,
      note,
    } = body as {
      saleDate: string
      amount: number
      cashAmount?: number
      cardAmount?: number
      deliveryAmount?: number
      note?: string
    }

    if (!saleDate || amount == null) {
      return NextResponse.json({ error: '날짜와 매출액은 필수입니다' }, { status: 400 })
    }

    if (amount < 0) {
      return NextResponse.json({ error: '매출액은 0 이상이어야 합니다' }, { status: 400 })
    }

    const saleDateObj = new Date(saleDate)

    // upsert: 같은 날짜의 매출은 하나만 (수정 지원)
    const sale = await prisma.sale.upsert({
      where: {
        restaurantId_saleDate: {
          restaurantId,
          saleDate: saleDateObj,
        },
      },
      update: {
        userId,
        amount,
        cashAmount,
        cardAmount,
        deliveryAmount,
        note: note ?? null,
      },
      create: {
        restaurantId,
        userId,
        saleDate: saleDateObj,
        amount,
        cashAmount,
        cardAmount,
        deliveryAmount,
        note: note ?? null,
      },
    })

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('POST /api/sales error:', error)
    return NextResponse.json({ error: '매출 등록 실패' }, { status: 500 })
  }
}
