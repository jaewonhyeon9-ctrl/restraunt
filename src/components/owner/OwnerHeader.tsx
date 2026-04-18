'use client'

import { signOut, useSession } from 'next-auth/react'

export default function OwnerHeader() {
  const { data: session } = useSession()

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      signOut({ callbackUrl: '/login' })
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🍽️</span>
          <span className="text-sm font-bold text-gray-800">
            {session?.user?.name ?? '사장'}님
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
