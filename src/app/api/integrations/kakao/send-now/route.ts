import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, sendToSelf } from '@/lib/kakao'
import { buildDailySummary } from '@/lib/daily-report'
import { buildKakaoSummary } from '@/lib/report-formatter'

// POST: 즉시 오늘 리포트를 본인 카카오톡으로 발송 (테스트/수동)
export async function POST(req: NextRequest) {
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

  const integration = await prisma.kakaoIntegration.findUnique({
    where: { userId: user.id },
  })
  if (!integration) {
    return NextResponse.json({ error: '카카오 연동이 필요합니다.' }, { status: 400 })
  }

  const today = new Date()
  const dayStart = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  )

  const summary = await buildDailySummary(user.restaurantId, dayStart)
  if (!summary) {
    return NextResponse.json({ error: '리포트 데이터를 만들 수 없습니다.' }, { status: 500 })
  }

  const text = buildKakaoSummary(summary)

  const origin = new URL(req.url).origin
  const linkUrl = `${origin}/finance/daily/report`

  try {
    const token = await getValidAccessToken(user.id)
    await sendToSelf(token, {
      text,
      linkUrl,
      buttonTitle: '상세 리포트 열기',
    })
  } catch (e) {
    console.error('[kakao/send-now] error:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: '카카오톡 발송 실패', detail: msg },
      { status: 500 }
    )
  }

  await prisma.kakaoIntegration.update({
    where: { userId: user.id },
    data: { lastSentAt: new Date() },
  })

  return NextResponse.json({ success: true, sentAt: new Date().toISOString() })
}
