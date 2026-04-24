import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 최근 N일 일별 매출/지출 추이
// query: ?days=7|30 (default 7, max 90)
export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: '사장 권한이 필요합니다.' }, { status: 403 })
  }
  if (!user.restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const daysRaw = Number(searchParams.get('days') ?? 7)
  const days = Math.min(90, Math.max(1, Math.floor(daysRaw || 7)))

  // 범위: (오늘 - days + 1) 00:00 ~ 오늘 23:59:59
  const now = new Date()
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  )
  const startUtc = new Date(todayUtc)
  startUtc.setUTCDate(startUtc.getUTCDate() - (days - 1))
  const endUtc = new Date(todayUtc.getTime() + 86400000 - 1)

  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        restaurantId: user.restaurantId,
        saleDate: { gte: startUtc, lte: endUtc },
      },
      select: {
        saleDate: true,
        amount: true,
        cashAmount: true,
        cardAmount: true,
        deliveryAmount: true,
      },
      orderBy: { saleDate: 'asc' },
    }),
    prisma.expense.groupBy({
      by: ['expenseDate'],
      where: {
        restaurantId: user.restaurantId,
        expenseDate: { gte: startUtc, lte: endUtc },
      },
      _sum: { amount: true },
    }),
  ])

  // 일별 매출 맵
  const salesMap = new Map<
    string,
    { total: number; cash: number; card: number; delivery: number }
  >()
  for (const s of sales) {
    const key = s.saleDate.toISOString().slice(0, 10)
    salesMap.set(key, {
      total: s.amount,
      cash: s.cashAmount ?? 0,
      card: s.cardAmount ?? 0,
      delivery: s.deliveryAmount ?? 0,
    })
  }

  // 일별 지출 맵
  const expensesMap = new Map<string, number>()
  for (const e of expenses) {
    const key = new Date(e.expenseDate).toISOString().slice(0, 10)
    expensesMap.set(key, (expensesMap.get(key) ?? 0) + (e._sum.amount ?? 0))
  }

  // 일자별 row 생성 (빈 날짜도 0원)
  const points: {
    date: string
    label: string
    sales: number
    expenses: number
    netProfit: number
    cash: number
    card: number
    delivery: number
  }[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(startUtc)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    const s = salesMap.get(key)
    const exp = expensesMap.get(key) ?? 0
    const sales = s?.total ?? 0

    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const weekday = '일월화수목금토'[d.getUTCDay()]
    points.push({
      date: key,
      label: days <= 14 ? `${m}/${day}(${weekday})` : `${m}/${day}`,
      sales,
      expenses: exp,
      netProfit: sales - exp,
      cash: s?.cash ?? 0,
      card: s?.card ?? 0,
      delivery: s?.delivery ?? 0,
    })
  }

  const totalSales = points.reduce((s, p) => s + p.sales, 0)
  const totalExpenses = points.reduce((s, p) => s + p.expenses, 0)
  const avgSales = points.length > 0 ? Math.round(totalSales / points.length) : 0

  return NextResponse.json({
    days,
    points,
    totalSales,
    totalExpenses,
    avgSales,
  })
}
