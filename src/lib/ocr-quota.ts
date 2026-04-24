/**
 * 플랜별 OCR 월 한도 체크 + 카운터 증가
 *
 * 사용법 (OCR 라우트에서):
 *   const check = await checkAndConsumeOcrQuota(restaurantId)
 *   if (!check.ok) return NextResponse.json({ error, ...check }, { status: 402 })
 *   // ... Gemini 호출 ...
 */

import { prisma } from '@/lib/prisma'
import type { Plan } from '@prisma/client'

export const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 30,
  STANDARD: 300,
  PRO: Infinity,
}

export const PLAN_LABEL: Record<Plan, string> = {
  FREE: '무료',
  STANDARD: 'Standard',
  PRO: 'Pro',
}

function currentYearMonth(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export interface QuotaCheck {
  ok: boolean
  plan: Plan
  limit: number
  used: number
  remaining: number
  yearMonth: string
}

/**
 * 현재 사용량 조회만 (증가 X) — 대시보드 위젯용
 */
export async function getOcrQuotaStatus(restaurantId: string): Promise<QuotaCheck> {
  const ym = currentYearMonth()
  const [restaurant, usage] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { plan: true },
    }),
    prisma.ocrUsage.findUnique({
      where: {
        restaurantId_yearMonth: { restaurantId, yearMonth: ym },
      },
      select: { count: true },
    }),
  ])

  const plan = restaurant?.plan ?? 'FREE'
  const limit = PLAN_LIMITS[plan]
  const used = usage?.count ?? 0
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)

  return {
    ok: remaining > 0,
    plan,
    limit,
    used,
    remaining,
    yearMonth: ym,
  }
}

/**
 * 쿼터 체크 + 카운터 1증가 (atomic).
 * 초과한 경우 증가 안 하고 ok: false 반환.
 */
export async function checkAndConsumeOcrQuota(
  restaurantId: string
): Promise<QuotaCheck> {
  const status = await getOcrQuotaStatus(restaurantId)
  if (!status.ok) return status

  // 증가 (upsert)
  await prisma.ocrUsage.upsert({
    where: {
      restaurantId_yearMonth: {
        restaurantId,
        yearMonth: status.yearMonth,
      },
    },
    update: { count: { increment: 1 } },
    create: {
      restaurantId,
      yearMonth: status.yearMonth,
      count: 1,
    },
  })

  return {
    ...status,
    used: status.used + 1,
    remaining:
      status.remaining === Infinity
        ? Infinity
        : Math.max(0, status.remaining - 1),
  }
}

/**
 * 실패 시 사용량 환불 (Gemini 호출 실패했을 때 호출)
 */
export async function refundOcrQuota(restaurantId: string): Promise<void> {
  const ym = currentYearMonth()
  await prisma.ocrUsage
    .update({
      where: {
        restaurantId_yearMonth: { restaurantId, yearMonth: ym },
      },
      data: { count: { decrement: 1 } },
    })
    .catch(() => {
      // row 없으면 무시
    })
}
