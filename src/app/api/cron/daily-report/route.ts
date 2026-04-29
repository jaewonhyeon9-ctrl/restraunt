import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, sendToSelf } from '@/lib/kakao'
import { buildDailySummary } from '@/lib/daily-report'
import { buildKakaoSummary } from '@/lib/report-formatter'
import { generateAiManagerReport } from '@/lib/ai-manager'
import { sendPushToUser } from '@/lib/push'

const PUSH_DEFAULT_HOUR = 23 // 푸시는 23시 KST 고정 발송

/**
 * Vercel Cron (매시 정각에 실행 권장):
 * vercel.json → "schedule": "0 * * * *"
 *
 * 매시간 실행해서, 각 OWNER의 sendHour(한국 기준)와 일치하는 경우에만 발송.
 * 동일 날짜 중복 발송 방지: lastSentAt이 오늘이면 skip.
 */

// KST = UTC+9. process 환경 TZ 의존 안 함.
function kstHour(now: Date = new Date()): number {
  return (now.getUTCHours() + 9) % 24
}

function kstDayStart(now: Date = new Date()): Date {
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kst = new Date(now.getTime() + kstOffsetMs)
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  )
}

function sameKstDay(a: Date, b: Date): boolean {
  const offset = 9 * 60 * 60 * 1000
  const ka = new Date(a.getTime() + offset)
  const kb = new Date(b.getTime() + offset)
  return (
    ka.getUTCFullYear() === kb.getUTCFullYear() &&
    ka.getUTCMonth() === kb.getUTCMonth() &&
    ka.getUTCDate() === kb.getUTCDate()
  )
}

export async function GET(req: NextRequest) {
  // Vercel Cron은 헤더 `x-vercel-cron: 1` 과 Authorization Bearer CRON_SECRET 을 포함
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      // Vercel 자체 호출도 이 헤더로 옴
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const hour = kstHour(now)
  const today = kstDayStart(now)

  // 이 시간대에 발송해야 할 integration들
  const targets = await prisma.kakaoIntegration.findMany({
    where: {
      dailyReportEnabled: true,
      sendHour: hour,
    },
    include: {
      user: {
        select: { id: true, name: true, role: true, restaurantId: true },
      },
    },
  })

  const results: Array<{
    userId: string
    ok: boolean
    reason?: string
  }> = []

  const origin = new URL(req.url).origin
  const linkUrl = `${origin}/finance/daily/report`

  for (const t of targets) {
    if (t.user.role !== 'OWNER') {
      results.push({ userId: t.userId, ok: false, reason: 'not_owner' })
      continue
    }
    if (!t.user.restaurantId) {
      results.push({ userId: t.userId, ok: false, reason: 'no_restaurant' })
      continue
    }
    if (t.lastSentAt && sameKstDay(t.lastSentAt, now)) {
      results.push({ userId: t.userId, ok: false, reason: 'already_sent' })
      continue
    }

    try {
      const summary = await buildDailySummary(t.user.restaurantId, today)
      if (!summary) {
        results.push({ userId: t.userId, ok: false, reason: 'no_summary' })
        continue
      }
      const text = buildKakaoSummary(summary)
      const token = await getValidAccessToken(t.userId)
      await sendToSelf(token, {
        text,
        linkUrl,
        buttonTitle: '상세 리포트 열기',
      })
      await prisma.kakaoIntegration.update({
        where: { userId: t.userId },
        data: { lastSentAt: new Date() },
      })
      results.push({ userId: t.userId, ok: true })
    } catch (e) {
      console.error('[cron/daily-report]', t.userId, e)
      results.push({
        userId: t.userId,
        ok: false,
        reason: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  // === Web Push 발송 (PWA 알림, 23시 KST 고정) ===
  let pushSent = 0
  let pushSkipped = 0
  if (hour === PUSH_DEFAULT_HOUR) {
    const pushOwners = await prisma.user.findMany({
      where: {
        role: 'OWNER',
        pushSubscriptions: { some: {} },
      },
      select: { id: true, name: true, restaurantId: true, activeRestaurantId: true },
    })

    const origin = new URL(req.url).origin

    for (const owner of pushOwners) {
      const restaurantId = owner.activeRestaurantId ?? owner.restaurantId
      if (!restaurantId) {
        pushSkipped++
        continue
      }
      try {
        const summary = await buildDailySummary(restaurantId, today)
        if (!summary) {
          pushSkipped++
          continue
        }

        // AI 점장 분석 시도
        const ai = await generateAiManagerReport(summary)
        const title = ai
          ? `🤖 AI 점장 일일 리포트`
          : `📊 일일 리포트`
        const body = ai?.highlight
          ? ai.highlight
          : `오늘 매출 ${summary.sales.total.toLocaleString('ko-KR')}원`

        await sendPushToUser(owner.id, {
          title,
          body,
          url: `${origin}/finance/daily/report`,
        })
        pushSent++
      } catch (e) {
        console.error('[cron/daily-report] push fail', owner.id, e)
        pushSkipped++
      }
    }
  }

  return NextResponse.json({
    kstHour: hour,
    targets: targets.length,
    sent: results.filter((r) => r.ok).length,
    pushSent,
    pushSkipped,
    results,
  })
}
