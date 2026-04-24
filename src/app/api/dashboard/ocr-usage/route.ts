import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getOcrQuotaStatus, PLAN_LABEL } from '@/lib/ocr-quota'

// GET: 현재 사업장의 이번달 OCR 사용 현황
export async function GET() {
  const session = await auth()
  const user = session?.user as { id?: string; restaurantId?: string } | undefined
  if (!user?.id || !user.restaurantId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const status = await getOcrQuotaStatus(user.restaurantId)
  const isInfinite = status.limit === Infinity

  return NextResponse.json({
    plan: status.plan,
    planLabel: PLAN_LABEL[status.plan],
    used: status.used,
    limit: isInfinite ? null : status.limit,
    remaining: isInfinite ? null : status.remaining,
    percent: isInfinite ? 0 : Math.round((status.used / status.limit) * 100),
    yearMonth: status.yearMonth,
    unlimited: isInfinite,
  })
}
