import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  exchangeCodeForToken,
  fetchKakaoUserId,
  isKakaoConfigured,
} from '@/lib/kakao'

// GET: 카카오 OAuth 콜백 — code 받아서 토큰 교환, DB 저장
export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { id?: string } | undefined

  const appUrl = new URL(req.url).origin
  const dashboardRedirect = (params: Record<string, string>) => {
    const u = new URL('/dashboard', appUrl)
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
    return NextResponse.redirect(u)
  }

  if (!user?.id) {
    return dashboardRedirect({ kakao: 'unauthenticated' })
  }
  if (!isKakaoConfigured()) {
    return dashboardRedirect({ kakao: 'not_configured' })
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return dashboardRedirect({ kakao: 'denied', detail: error })
  }
  if (!code || !state) {
    return dashboardRedirect({ kakao: 'invalid_request' })
  }

  // state 검증
  const cookieState = req.cookies.get('kakao_oauth_state')?.value
  if (!cookieState || cookieState !== state) {
    return dashboardRedirect({ kakao: 'state_mismatch' })
  }
  const [stateUserId] = state.split('.')
  if (stateUserId !== user.id) {
    return dashboardRedirect({ kakao: 'user_mismatch' })
  }

  try {
    const tokenRes = await exchangeCodeForToken(code)
    const kakaoId = await fetchKakaoUserId(tokenRes.access_token)
    const expiresAt = new Date(Date.now() + tokenRes.expires_in * 1000)

    await prisma.kakaoIntegration.upsert({
      where: { userId: user.id },
      update: {
        kakaoId,
        accessToken: tokenRes.access_token,
        refreshToken: tokenRes.refresh_token,
        expiresAt,
      },
      create: {
        userId: user.id,
        kakaoId,
        accessToken: tokenRes.access_token,
        refreshToken: tokenRes.refresh_token,
        expiresAt,
      },
    })

    const res = dashboardRedirect({ kakao: 'connected' })
    res.cookies.delete('kakao_oauth_state')
    return res
  } catch (e) {
    console.error('[kakao/callback] error:', e)
    return dashboardRedirect({ kakao: 'failed' })
  }
}
