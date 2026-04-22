'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const tabs = [
  { href: '/home', label: '홈', icon: '🏠' },
  { href: '/checklist', label: '체크리스트', icon: '✅' },
  { href: '/inventory/check', label: '재고파악', icon: '📦' },
  { href: '/inventory/order', label: '발주신청', icon: '📋' },
  { href: '/profile', label: '내정보', icon: '👤' },
]

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isOwnerPreviewing = (session?.user as { role?: string } | undefined)?.role === 'OWNER'

  return (
    <div className="flex flex-col min-h-screen">
      {isOwnerPreviewing && (
        <div className="border-b border-indigo-400/30 bg-indigo-500/10 backdrop-blur-xl">
          <div className="mx-auto max-w-md px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-indigo-200 font-medium">
              👁️ 사장님이 직원 화면을 보는 중
            </span>
            <Link
              href="/dashboard"
              className="text-xs text-indigo-100 hover:text-white px-2 py-1 rounded font-semibold"
            >
              사장 화면으로 ←
            </Link>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(7,9,14,0.72)] backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
          <span className="text-base font-bold text-slate-100">직원 메뉴</span>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString('ko-KR', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-[rgba(7,9,14,0.72)] backdrop-blur-xl">
        <div className="mx-auto max-w-md flex pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="group relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              >
                {isActive && (
                  <span className="absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400" />
                )}
                <span
                  className={`text-xl leading-none transition-transform ${
                    isActive ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    isActive
                      ? 'text-slate-100'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
