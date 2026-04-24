import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDate(raw: string | null): Date {
  const d = raw ? new Date(raw) : new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

// GET: 마감 리포트 종합
// query: ?date=YYYY-MM-DD (default: today, UTC 기준 00:00)
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
  const dayStart = parseDate(searchParams.get('date'))
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1)

  const [
    restaurant,
    sale,
    expenses,
    attendance,
    orders,
    notes,
    templates,
    logs,
    fixedExpenses,
    wageAgg,
  ] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: user.restaurantId },
      select: { name: true },
    }),
    prisma.sale.findFirst({
      where: { restaurantId: user.restaurantId, saleDate: dayStart },
      select: {
        amount: true,
        cashAmount: true,
        cardAmount: true,
        deliveryAmount: true,
        note: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        restaurantId: user.restaurantId,
        expenseDate: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        category: true,
        amount: true,
        description: true,
        supplier: { select: { name: true } },
      },
      orderBy: { amount: 'desc' },
    }),
    prisma.attendance.findMany({
      where: { restaurantId: user.restaurantId, date: dayStart },
      select: {
        id: true,
        userId: true,
        clockIn: true,
        clockOut: true,
        workMinutes: true,
        dailyWage: true,
        user: { select: { name: true } },
      },
      orderBy: { clockIn: 'asc' },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        restaurantId: user.restaurantId,
        orderDate: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        supplier: { select: { name: true } },
        requestedBy: { select: { name: true } },
        items: { select: { id: true, itemName: true, quantity: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dailyNote.findMany({
      where: {
        restaurantId: user.restaurantId,
        date: dayStart,
      },
      select: {
        id: true,
        type: true,
        category: true,
        content: true,
        user: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.checklistTemplate.findMany({
      where: { restaurantId: user.restaurantId, isActive: true },
      select: { id: true, category: true },
    }),
    prisma.checklistLog.findMany({
      where: {
        restaurantId: user.restaurantId,
        isChecked: true,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: {
        userId: true,
        template: { select: { category: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.fixedExpense.findMany({
      where: { restaurantId: user.restaurantId, isActive: true },
      select: { amount: true },
    }),
    prisma.user.aggregate({
      where: {
        restaurantId: user.restaurantId,
        isActive: true,
        monthlyWage: { not: null },
      },
      _sum: { monthlyWage: true },
    }),
  ])

  // 고정비용 일할
  const daysInMonth = new Date(
    dayStart.getUTCFullYear(),
    dayStart.getUTCMonth() + 1,
    0
  ).getDate()
  const totalFixedMonthly =
    fixedExpenses.reduce((s, f) => s + f.amount, 0) +
    (wageAgg._sum.monthlyWage ?? 0)
  const fixedDaily = Math.round(totalFixedMonthly / daysInMonth)

  // 매출
  const salesAmt = sale?.amount ?? 0
  const variableExpAmt = expenses.reduce((s, e) => s + e.amount, 0)
  const totalExpAmt = variableExpAmt + fixedDaily
  const netProfit = salesAmt - totalExpAmt

  // 지출 카테고리별 합계
  const expByCategory: Record<string, number> = {}
  expenses.forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount
  })

  // 출퇴근 집계
  const attendanceSummary = {
    workers: attendance.length,
    totalMinutes: attendance.reduce((s, a) => s + (a.workMinutes ?? 0), 0),
    totalWage: attendance.reduce((s, a) => s + (a.dailyWage ?? 0), 0),
  }

  // 발주 상태별 집계
  const orderSummary = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    approved: orders.filter((o) => o.status === 'APPROVED').length,
    ordered: orders.filter((o) => o.status === 'ORDERED').length,
    received: orders.filter((o) => o.status === 'RECEIVED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    totalAmount: orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0),
  }

  // 체크리스트 달성률 (직원별)
  const totalTemplates = templates.length
  const kitchenCount = templates.filter((t) => t.category === 'KITCHEN').length
  const hallCount = templates.filter((t) => t.category === 'HALL').length

  const byUser = new Map<string, { name: string; done: number }>()
  for (const log of logs) {
    const prev = byUser.get(log.userId)
    if (prev) prev.done += 1
    else byUser.set(log.userId, { name: log.user?.name ?? '-', done: 1 })
  }
  const checklistByEmployee = Array.from(byUser.entries())
    .map(([userId, v]) => ({
      userId,
      name: v.name,
      done: v.done,
      total: totalTemplates,
      percent: totalTemplates > 0 ? Math.round((v.done / totalTemplates) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent)

  const totalLogs = logs.length
  const kitchenLogs = logs.filter((l) => l.template?.category === 'KITCHEN').length
  const hallLogs = logs.filter((l) => l.template?.category === 'HALL').length

  return NextResponse.json({
    restaurant: { name: restaurant?.name ?? '식당' },
    date: dayStart.toISOString(),
    finance: {
      sales: {
        total: salesAmt,
        cash: sale?.cashAmount ?? 0,
        card: sale?.cardAmount ?? 0,
        delivery: sale?.deliveryAmount ?? 0,
        note: sale?.note ?? null,
      },
      expenses: {
        variable: variableExpAmt,
        fixedDaily,
        total: totalExpAmt,
        byCategory: expByCategory,
        items: expenses.map((e) => ({
          id: e.id,
          category: e.category,
          amount: e.amount,
          description: e.description,
          supplier: e.supplier?.name ?? null,
        })),
      },
      netProfit,
    },
    attendance: {
      summary: attendanceSummary,
      list: attendance.map((a) => ({
        userId: a.userId,
        name: a.user.name,
        clockIn: a.clockIn?.toISOString() ?? null,
        clockOut: a.clockOut?.toISOString() ?? null,
        workMinutes: a.workMinutes ?? 0,
        dailyWage: a.dailyWage ?? 0,
      })),
    },
    orders: {
      summary: orderSummary,
      list: orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount ?? 0,
        supplier: o.supplier?.name ?? null,
        requestedBy: o.requestedBy?.name ?? null,
        itemCount: o.items.length,
        itemsPreview: o.items
          .slice(0, 3)
          .map((i) => `${i.itemName} ${i.quantity}${i.unit}`),
      })),
    },
    notes: notes.map((n) => ({
      id: n.id,
      type: n.type,
      category: n.category,
      content: n.content,
      author: n.user?.name ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    checklist: {
      totalTemplates,
      kitchenTemplates: kitchenCount,
      hallTemplates: hallCount,
      totalCompleted: totalLogs,
      kitchenCompleted: kitchenLogs,
      hallCompleted: hallLogs,
      byEmployee: checklistByEmployee,
    },
  })
}
