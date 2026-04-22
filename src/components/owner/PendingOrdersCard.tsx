'use client'

import Link from 'next/link'

interface PendingOrdersCardProps {
  count: number
  loading?: boolean
}

export default function PendingOrdersCard({ count, loading = false }: PendingOrdersCardProps) {
  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="h-5 w-40 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  if (count <= 0) return null

  return (
    <Link
      href="/inventory/orders?status=PENDING"
      className="flex items-center gap-3 rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 px-4 py-3 transition active:scale-[0.99] hover:border-indigo-400/50"
    >
      <span className="text-2xl">🛒</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-indigo-200">
          대기 중 발주 요청 {count}건
        </p>
        <p className="text-xs text-indigo-300/80 mt-0.5">
          승인/거절 처리가 필요합니다
        </p>
      </div>
      <span className="rounded-full bg-indigo-500 text-white text-xs font-bold px-2.5 py-1">
        확인 필요
      </span>
    </Link>
  )
}
