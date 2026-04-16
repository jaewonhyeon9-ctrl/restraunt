import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id

  // month 쿼리 파라미터 파싱 (예: 2026-04)
  const { searchParams } = request.nextUrl
  const monthParam = searchParams.get('month')

  let year: number
  let month: number // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    year = y
    month = m - 1
  } else {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth()
  }

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 1)

  const attendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      clockIn: true,
      clockOut: true,
      workMinutes: true,
      dailyWage: true,
    },
  })

  const records = attendances.map((a) => ({
    date: a.date.toISOString().split('T')[0],
    clockIn: a.clockIn?.toISOString() ?? null,
    clockOut: a.clockOut?.toISOString() ?? null,
    workMinutes: a.workMinutes ?? null,
    dailyWage: a.dailyWage ?? null,
  }))

  const totalDays = records.filter((r) => r.clockIn !== null).length
  const totalMinutes = records.reduce((sum, r) => sum + (r.workMinutes ?? 0), 0)
  const totalWage = records.reduce((sum, r) => sum + (r.dailyWage ?? 0), 0)

  return NextResponse.json({
    records,
    summary: {
      totalDays,
      totalMinutes,
      totalWage,
    },
  })
}
