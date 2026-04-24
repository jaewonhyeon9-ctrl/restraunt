import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildAuthorizeUrl, isKakaoConfigured } from '@/lib/kakao'
import crypto from 'crypto'

// GET: 카카오 OAuth 시작 — 카카오 로그인 페이지로 리다이렉트
export async function GET() {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { error: '사장 계정에서만 연결할 수 있습니다.' },
      { status: 403 }
    )
  }
  if (!isKakaoConfigured()) {
    return NextResponse.json(
      {
        error: '카카오 연동이 아직 설정되지 않았습니다.',
        detail: '관리자에게 KAKAO_REST_API_KEY 설정을 요청하세요.',
      },
      { status: 503 }
    )
  }

  // CSRF 방지용 state (userId 포함 → callback에서 검증)
  const nonce = crypto.randomBytes(16).toString('hex')
  const state = `${user.id}.${nonce}`

  const url = buildAuthorizeUrl(state)

  const res = NextResponse.redirect(url)
  // state를 쿠키에 저장 (httpOnly, sameSite=lax)
  res.cookies.set('kakao_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300,
    path: '/',
  })
  return res
}
