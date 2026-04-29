import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'
import { buildDailySummary } from '@/lib/daily-report'
import { generateAiManagerReport } from '@/lib/ai-manager'

/** 현재 로그인 사용자에게 테스트 푸시 발송 (AI 점장 미리보기) */
export async function POST(req: Request) {
  const session = await auth()
  const u = session?.user as
    | { id?: string; restaurantId?: string; activeRestaurantId?: string }
    | undefined
  if (!u?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const restaurantId = u.activeRestaurantId ?? u.restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '매장 정보 없음' }, { status: 400 })
  }

  // 오늘 데이터로 AI 점장 분석 시도
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kst = new Date(now.getTime() + kstOffsetMs)
  const today = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  )

  let title = '🤖 AI 점장 알림 테스트'
  let body = '푸시 알림이 정상 작동합니다. 매일 22시 일일 리포트가 도착해요.'

  try {
    const summary = await buildDailySummary(restaurantId, today)
    if (summary) {
      const ai = await generateAiManagerReport(summary)
      if (ai) {
        title = '🤖 AI 점장 일일 리포트 (테스트)'
        body = ai.highlight
      } else {
        body = `오늘 매출 ${summary.sales.total.toLocaleString('ko-KR')}원 (테스트)`
      }
    }
  } catch (e) {
    console.error('test push summary fail', e)
  }

  const origin = new URL(req.url).origin
  const result = await sendPushToUser(u.id, {
    title,
    body,
    url: `${origin}/finance/daily/report`,
  })

  return NextResponse.json({ ok: true, ...result, title, body })
}
