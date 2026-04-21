import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  calculateDailyVat,
  calculateMonthlyVat,
  calculateQuarterlyVat,
  calculateEstimatedIncomeTax,
  calculateVat,
  nextVatFilingDate,
} from '@/lib/tax-calculator'

// GET /api/tax - 오늘/이번달/이번분기/연누적 세무 요약
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
    const dateParam = searchParams.get('date')
    const target = dateParam ? new Date(dateParam) : new Date()

    const year = target.getFullYear()
    const month = target.getMonth() + 1
    const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4

    // 연 누적 카드매출세액공제 사용액 계산을 위해 연초부터 타겟 월 이전까지 미리 집계
    const ytdStart = new Date(year, 0, 1)
    const currentMonthStart = new Date(year, month - 1, 1)
    const priorYtd =
      currentMonthStart > ytdStart
        ? await calculateVat(restaurantId, ytdStart, currentMonthStart)
        : null
    const cardUsedPriorYtd = priorYtd?.cardDeduction ?? 0

    const [daily, monthly, quarterly, incomeTax] = await Promise.all([
      calculateDailyVat(restaurantId, target),
      calculateMonthlyVat(restaurantId, year, month),
      calculateQuarterlyVat(restaurantId, year, quarter),
      calculateEstimatedIncomeTax(restaurantId, year),
    ])

    // 월별 부가세는 연 누적 한도 감안
    const monthlyAdjusted = await calculateVat(
      restaurantId,
      currentMonthStart,
      new Date(year, month, 1),
      { cardDeductionUsedThisYear: cardUsedPriorYtd }
    )

    const filing = nextVatFilingDate(target)

    return NextResponse.json({
      date: target.toISOString().slice(0, 10),
      year,
      month,
      quarter,
      daily,
      monthly: monthlyAdjusted,
      quarterly,
      incomeTax,
      filing: {
        label: filing.label,
        date: filing.date.toISOString().slice(0, 10),
        daysLeft: filing.daysLeft,
      },
    })
  } catch (error) {
    console.error('GET /api/tax error:', error)
    return NextResponse.json({ error: '세무 계산 실패' }, { status: 500 })
  }
}
