'use client'

import Link from 'next/link'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'

export default function OwnerHeader() {
  const { data: session } = useSession()

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      signOut({ callbackUrl: '/login' })
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(7,9,14,0.72)] backdrop-blur-xl">
      <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 overflow-hidden rounded-lg ring-1 ring-white/10">
            <Image
              src="/icon-192.png"
              alt="더찰칵"
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-slate-500">사장</span>
            <span className="text-sm font-semibold text-slate-100">
              {session?.user?.name ?? '사장'}님
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/home" className="btn-ghost !py-1.5 !px-2.5 text-[11px]">
            직원 화면
          </Link>
          <button
            onClick={handleLogout}
            className="btn-ghost !py-1.5 !px-2.5 text-[11px]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}
