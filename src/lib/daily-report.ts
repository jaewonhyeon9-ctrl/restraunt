/**
 * 오늘 마감 리포트 요약 집계 (서버 전용)
 * - /api/reports/daily 와 /api/cron/daily-report 둘 다에서 재사용
 */

import { prisma } from '@/lib/prisma'
import type { ReportSummaryInput } from '@/lib/report-formatter'

export async function buildDailySummary(
  restaurantId: string,
  dayStart: Date
): Promise<ReportSummaryInput | null> {
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1)

  const [
    restaurant,
    sale,
    expenses,
    attendance,
    templates,
    logs,
    notes,
    pendingOrdersCount,
    fixedExpenses,
    wageAgg,
  ] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    }),
    prisma.sale.findFirst({
      where: { restaurantId, saleDate: dayStart },
      select: {
        amount: true,
        cashAmount: true,
        cardAmount: true,
        deliveryAmount: true,
      },
    }),
    prisma.expense.aggregate({
      where: {
        restaurantId,
        expenseDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    }),
    prisma.attendance.findMany({
      where: { restaurantId, date: dayStart },
      select: { workMinutes: true },
    }),
    prisma.checklistTemplate.count({
      where: { restaurantId, isActive: true },
    }),
    prisma.checklistLog.count({
      where: {
        restaurantId,
        isChecked: true,
        date: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.dailyNote.count({
      where: { restaurantId, date: dayStart },
    }),
    prisma.purchaseOrder.count({
      where: { restaurantId, status: 'PENDING' },
    }),
    prisma.fixedExpense.findMany({
      where: { restaurantId, isActive: true },
      select: { amount: true },
    }),
    prisma.user.aggregate({
      where: { restaurantId, isActive: true, monthlyWage: { not: null } },
      _sum: { monthlyWage: true },
    }),
  ])

  if (!restaurant) return null

  const daysInMonth = new Date(
    dayStart.getUTCFullYear(),
    dayStart.getUTCMonth() + 1,
    0
  ).getDate()
  const totalFixedMonthly =
    fixedExpenses.reduce((s, f) => s + f.amount, 0) +
    (wageAgg._sum.monthlyWage ?? 0)
  const fixedDaily = Math.round(totalFixedMonthly / daysInMonth)

  const salesTotal = sale?.amount ?? 0
  const variableExp = expenses._sum.amount ?? 0
  const totalExp = variableExp + fixedDaily

  const activeEmployees = await prisma.user.count({
    where: { restaurantId, role: 'EMPLOYEE', isActive: true },
  })
  const totalExpected = templates * Math.max(1, activeEmployees)

  return {
    restaurantName: restaurant.name,
    date: dayStart,
    sales: {
      total: salesTotal,
      cash: sale?.cashAmount ?? 0,
      card: sale?.cardAmount ?? 0,
      delivery: sale?.deliveryAmount ?? 0,
    },
    expenses: {
      variable: variableExp,
      fixedDaily,
      total: totalExp,
    },
    netProfit: salesTotal - totalExp,
    attendance: {
      workers: attendance.length,
      totalMinutes: attendance.reduce((s, a) => s + (a.workMinutes ?? 0), 0),
    },
    checklist: {
      totalCompleted: logs,
      totalExpected,
    },
    pendingOrders: pendingOrdersCount,
    noteCount: notes,
  }
}
