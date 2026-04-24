import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// 사장 전용 경로
const OWNER_ONLY = ['/dashboard', '/finance', '/suppliers', '/employees', '/checklist-admin']
// 직원 전용 경로
const EMPLOYEE_ONLY = ['/home', '/checklist', '/profile', '/inventory/check', '/inventory/order']

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const user = req.auth?.user as { role?: string } | undefined

  // 공개 경로 (로그인 없이 접근 가능)
  const PUBLIC_PATHS = [
    '/login',
    '/signup',
    '/guide',
    '/api/auth',
    '/privacy',
    '/terms',
    '/offline',
  ]
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // 인증 안 된 경우
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (user) {
    const role = user.role

    // 로그인 상태에서 /login, /signup, 루트 접근 시 역할별 홈으로
    if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
      return NextResponse.redirect(new URL(role === 'OWNER' ? '/dashboard' : '/home', req.url))
    }

    // 직원이 사장 전용 페이지 접근 시
    const isOwnerPath =
      OWNER_ONLY.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
      pathname === '/inventory' ||
      pathname.startsWith('/inventory/orders')
    if (role === 'EMPLOYEE' && isOwnerPath) {
      return NextResponse.redirect(new URL('/home', req.url))
    }

    // 사장은 직원 전용 페이지도 미리보기 가능 (관리 목적)
    // EMPLOYEE_ONLY 경로 접근 차단 안 함
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icons|sw\\.js|manifest\\.webmanifest|offline|apple-icon\\.png|icon-192\\.png|icon-512\\.png|icon-maskable-512\\.png|feature-graphic-1024x500\\.png|\\.well-known).*)',
  ],
}
