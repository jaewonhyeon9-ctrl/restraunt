'use client'

import Link from 'next/link'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { RestaurantSwitcher } from './RestaurantSwitcher'

export default function OwnerHeader() {
  const { data: session } = useSession()

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      signOut({ callbackUrl: '/login' })
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(7,9,14,0.72)] backdrop-blur-xl">
      <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 overflow-hidden rounded-lg ring-1 ring-white/10 flex-shrink-0">
            <Image
              src="/icon-192.png"
              alt="오토드림"
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[10px] text-slate-500">
              {session?.user?.name ?? '사장'}님
            </span>
            <RestaurantSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link href="/home" className="btn-ghost !py-1.5 !px-2 text-[11px]">
            직원
          </Link>
          <button
            onClick={handleLogout}
            className="btn-ghost !py-1.5 !px-2 text-[11px]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}
