import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isKakaoConfigured } from '@/lib/kakao'

// GET: 현재 로그인 유저의 카카오 연동 상태
export async function GET() {
  const session = await auth()
  const user = session?.user as { id?: string } | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const integration = await prisma.kakaoIntegration.findUnique({
    where: { userId: user.id },
    select: {
      kakaoId: true,
      dailyReportEnabled: true,
      sendHour: true,
      lastSentAt: true,
      expiresAt: true,
    },
  })

  return NextResponse.json({
    configured: isKakaoConfigured(),
    connected: !!integration,
    dailyReportEnabled: integration?.dailyReportEnabled ?? false,
    sendHour: integration?.sendHour ?? 23,
    lastSentAt: integration?.lastSentAt?.toISOString() ?? null,
    tokenValid: integration ? integration.expiresAt.getTime() > Date.now() : false,
  })
}
