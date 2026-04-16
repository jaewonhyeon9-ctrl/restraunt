import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  // ── 인증 확인 ──────────────────────────────────
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const restaurantId = (session.user as any).restaurantId as string | undefined
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 403 })
  }

  // ── 날짜 범위 계산 ──────────────────────────────
  const now = new Date()

  // 오늘 00:00:00 (UTC)
  const todayStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  )
  // 오늘 23:59:59.999 (UTC)
  const todayEnd = new Date(todayStart.getTime() + 86400000 - 1)

  // 이번 달 1일 00:00:00 (UTC)
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  // 이번 달 말일 23:59:59.999 (UTC)
  const monthEnd = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  )

  // ── 병렬 쿼리 ──────────────────────────────────
  const [
    todaySale,
    todayExpenses,
    monthlySales,
    monthlyExpenses,
    lowStockItems,
    todayAttendance,
  ] = await Promise.all([
    // 오늘 매출 (Sale 테이블은 날짜별 unique 레코드)
    prisma.sale.findFirst({
      where: {
        restaurantId,
        saleDate: todayStart,
      },
      select: { amount: true },
    }),

    // 오늘 지출 합계
    prisma.expense.aggregate({
      where: {
        restaurantId,
        expenseDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: { amount: true },
    }),

    // 이번 달 매출 합계
    prisma.sale.aggregate({
      where: {
        restaurantId,
        saleDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
    }),

    // 이번 달 지출 합계
    prisma.expense.aggregate({
      where: {
        restaurantId,
        expenseDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
    }),

    // 안전재고 이하 품목 수 (같은 테이블 내 컬럼 비교 → raw SQL)
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "InventoryItem"
      WHERE "restaurantId" = ${restaurantId}
        AND "safetyStock" IS NOT NULL
        AND "currentStock" <= "safetyStock"
    `.then((rows) => Number(rows[0]?.count ?? 0)),

    // 오늘 출퇴근 직원 목록
    prisma.attendance.findMany({
      where: {
        restaurantId,
        date: todayStart,
      },
      select: {
        userId: true,
        clockIn: true,
        clockOut: true,
        user: { select: { name: true } },
      },
      orderBy: { clockIn: 'asc' },
    }),
  ])

  // ── 집계 ──────────────────────────────────────
  const todaySalesAmt = todaySale?.amount ?? 0
  const todayExpensesAmt = todayExpenses._sum.amount ?? 0
  const monthlySalesAmt = monthlySales._sum.amount ?? 0
  const monthlyExpensesAmt = monthlyExpenses._sum.amount ?? 0

  const lowStockCount = lowStockItems as number

  const attendanceList = todayAttendance.map((a) => ({
    userId: a.userId,
    name: a.user.name,
    clockIn: a.clockIn?.toISOString() ?? null,
    clockOut: a.clockOut?.toISOString() ?? null,
  }))

  return NextResponse.json({
    today: {
      sales: todaySalesAmt,
      expenses: todayExpensesAmt,
      netProfit: todaySalesAmt - todayExpensesAmt,
    },
    monthly: {
      sales: monthlySalesAmt,
      expenses: monthlyExpensesAmt,
      netProfit: monthlySalesAmt - monthlyExpensesAmt,
    },
    lowStockCount,
    todayAttendance: attendanceList,
  })
}
