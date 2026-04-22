import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Period = 'today' | 'week' | 'month'

function getDateRange(period: Period): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  if (period === 'week') {
    // 지난 7일 (오늘 포함)
    start.setDate(start.getDate() - 6)
  } else if (period === 'month') {
    // 이번 달 1일부터
    start.setDate(1)
  }
  // today: start = today 00:00

  return { start, end }
}

function datesInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur <= endDay) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// GET: 직원별 체크리스트 완료율 (오늘/이번주/이번달)
// 응답: [{ userId, name, role, completed, total, percent, kitchen: {...}, hall: {...} }]
export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { error: '사장 권한이 필요합니다.' },
      { status: 403 }
    )
  }
  if (!user.restaurantId) {
    return NextResponse.json(
      { error: '사업장 정보가 없습니다.' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(req.url)
  const periodRaw = searchParams.get('period') ?? 'today'
  const period: Period = (['today', 'week', 'month'] as const).includes(
    periodRaw as Period
  )
    ? (periodRaw as Period)
    : 'today'

  const { start, end } = getDateRange(period)

  // 활성 직원 목록
  const employees = await prisma.user.findMany({
    where: {
      restaurantId: user.restaurantId,
      isActive: true,
      role: 'EMPLOYEE',
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  // 활성 템플릿
  const templates = await prisma.checklistTemplate.findMany({
    where: { restaurantId: user.restaurantId, isActive: true },
    select: { id: true, category: true },
  })
  const totalPerDay = templates.length
  const kitchenPerDay = templates.filter((t) => t.category === 'KITCHEN').length
  const hallPerDay = templates.filter((t) => t.category === 'HALL').length

  // 기간 일수
  const days = datesInRange(start, end).length

  // 모든 체크로그 한 번에 조회 (기간 내)
  const logs = await prisma.checklistLog.findMany({
    where: {
      restaurantId: user.restaurantId,
      date: { gte: start, lte: end },
      isChecked: true,
      userId: { in: employees.map((e) => e.id) },
    },
    include: {
      template: { select: { category: true } },
    },
  })

  // 직원별로 집계
  const stat = new Map<
    string,
    { total: number; kitchen: number; hall: number }
  >()
  employees.forEach((e) =>
    stat.set(e.id, { total: 0, kitchen: 0, hall: 0 })
  )
  for (const log of logs) {
    const s = stat.get(log.userId)
    if (!s) continue
    s.total += 1
    if (log.template?.category === 'KITCHEN') s.kitchen += 1
    else if (log.template?.category === 'HALL') s.hall += 1
  }

  const expectedTotal = totalPerDay * days
  const expectedKitchen = kitchenPerDay * days
  const expectedHall = hallPerDay * days

  const result = employees.map((e) => {
    const s = stat.get(e.id)!
    return {
      userId: e.id,
      name: e.name,
      role: e.role,
      completed: s.total,
      total: expectedTotal,
      percent:
        expectedTotal > 0 ? Math.round((s.total / expectedTotal) * 100) : 0,
      kitchen: {
        completed: s.kitchen,
        total: expectedKitchen,
        percent:
          expectedKitchen > 0
            ? Math.round((s.kitchen / expectedKitchen) * 100)
            : 0,
      },
      hall: {
        completed: s.hall,
        total: expectedHall,
        percent:
          expectedHall > 0 ? Math.round((s.hall / expectedHall) * 100) : 0,
      },
    }
  })

  // 정렬: percent 내림차순 (성과 높은 직원 우선)
  result.sort((a, b) => b.percent - a.percent)

  return NextResponse.json({
    period,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
      days,
    },
    templates: {
      total: totalPerDay,
      kitchen: kitchenPerDay,
      hall: hallPerDay,
    },
    employees: result,
  })
}
