'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-800">직원 메뉴</span>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString('ko-KR', {
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </span>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 max-w-md mx-auto w-full pb-20">
        {children}
      </main>

      {/* 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : ''}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 w-10 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
