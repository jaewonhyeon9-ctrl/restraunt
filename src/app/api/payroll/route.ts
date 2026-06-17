import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeRole } from '@/lib/permissions'

export const runtime = 'nodejs'

const EMPLOYEE_ROLES = ['MANAGER', 'DEPUTY', 'STAFF', 'EMPLOYEE'] as const

// 급여 지출(Expense)의 식별 마커 — 중복 등록 방지에 사용.
// 같은 직원·같은 달은 한 번만 등록되도록 description을 결정적으로 생성.
function wageMarker(yearMonth: string, name: string) {
  return `[급여] ${yearMonth} ${name}`
}

function monthRange(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  const lastDay = new Date(y, m, 0) // 해당 월 마지막 날 (지출일자용)
  return { start, end, lastDay }
}

function currentYearMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

interface PayrollRow {
  userId: string
  name: string
  role: string
  hourlyWage: number | null
  monthlyWage: number | null
  workDays: number
  totalMinutes: number
  totalWage: number
  registered: boolean
  expenseId: string | null
}

// 월별 직원 급여 집계 (출퇴근 dailyWage 합산) + 지출 등록 여부
async function aggregate(restaurantId: string, yearMonth: string) {
  const { start, end } = monthRange(yearMonth)

  const employees = await prisma.user.findMany({
    where: {
      restaurantId,
      role: { in: [...EMPLOYEE_ROLES] },
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      attendance: {
        where: { date: { gte: start, lt: end } },
        select: { workMinutes: true, dailyWage: true, clockOut: true },
      },
    },
  })

  // 이번 달 급여 지출(마커) 조회 — 등록 여부 판정
  const wageExpenses = await prisma.expense.findMany({
    where: {
      restaurantId,
      category: 'WAGE',
      expenseDate: { gte: start, lt: end },
      description: { startsWith: '[급여]' },
    },
    select: { id: true, description: true },
  })
  const byMarker = new Map(wageExpenses.map((e) => [e.description ?? '', e.id]))

  const rows: PayrollRow[] = employees.map((emp) => {
    const totalMinutes = emp.attendance.reduce((s, a) => s + (a.workMinutes ?? 0), 0)
    const totalWage = emp.attendance.reduce((s, a) => s + (a.dailyWage ?? 0), 0)
    const workDays = emp.attendance.filter((a) => a.clockOut != null).length
    const marker = wageMarker(yearMonth, emp.name)
    const expenseId = byMarker.get(marker) ?? null
    return {
      userId: emp.id,
      name: emp.name,
      role: normalizeRole(emp.role),
      hourlyWage: emp.hourlyWage,
      monthlyWage: emp.monthlyWage,
      workDays,
      totalMinutes,
      totalWage,
      registered: expenseId != null,
      expenseId,
    }
  })

  return rows
}

// GET ?month=YYYY-MM — 직원별 급여 현황
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

    const yearMonth = req.nextUrl.searchParams.get('month') || currentYearMonth()
    const rows = await aggregate(restaurantId, yearMonth)

    return NextResponse.json({
      yearMonth,
      rows,
      totalWage: rows.reduce((s, r) => s + r.totalWage, 0),
      totalRegistered: rows.filter((r) => r.registered).length,
    })
  } catch (e) {
    console.error('GET /api/payroll error:', e)
    return NextResponse.json({ error: '급여 조회 실패' }, { status: 500 })
  }
}

// POST { month, userId?, all? } — 급여를 WAGE 지출로 등록 (중복 시 건너뜀)
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

    const body = await req.json().catch(() => ({}))
    const yearMonth: string = body.month || currentYearMonth()
    const targetUserId: string | undefined = body.userId
    const all: boolean = !!body.all

    const { lastDay } = monthRange(yearMonth)
    const rows = await aggregate(restaurantId, yearMonth)

    // 대상 선별: 특정 직원 또는 전체. 급여 0원·이미 등록된 건 제외.
    const targets = rows.filter((r) => {
      if (r.totalWage <= 0 || r.registered) return false
      if (all) return true
      return r.userId === targetUserId
    })

    let registered = 0
    const created: { name: string; amount: number }[] = []
    for (const r of targets) {
      await prisma.expense.create({
        data: {
          restaurantId,
          userId,
          category: 'WAGE',
          receiptType: 'NONE',
          isVatDeductible: false, // 급여는 매입세액 공제 대상 아님
          amount: r.totalWage,
          expenseDate: lastDay,
          description: wageMarker(yearMonth, r.name),
        },
      })
      registered += 1
      created.push({ name: r.name, amount: r.totalWage })
    }

    const skipped = (all
      ? rows.filter((r) => r.totalWage > 0 && r.registered).length
      : rows.filter((r) => r.userId === targetUserId && r.registered).length)

    return NextResponse.json({ ok: true, registered, skipped, created })
  } catch (e) {
    console.error('POST /api/payroll error:', e)
    return NextResponse.json({ error: '급여 등록 실패' }, { status: 500 })
  }
}
