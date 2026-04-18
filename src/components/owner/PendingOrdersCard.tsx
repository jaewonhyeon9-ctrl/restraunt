'use client'

import Link from 'next/link'

interface PendingOrdersCardProps {
  count: number
  loading?: boolean
}

export default function PendingOrdersCard({ count, loading = false }: PendingOrdersCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  if (count <= 0) return null

  return (
    <Link
      href="/inventory/orders?status=PENDING"
      className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 shadow-sm active:bg-indigo-100 transition-colors"
    >
      <span className="text-2xl">🛒</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-indigo-800">
          대기 중 발주 요청 {count}건
        </p>
        <p className="text-xs text-indigo-600 mt-0.5">승인/거절 처리가 필요합니다</p>
      </div>
      <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
        확인 필요
      </span>
    </Link>
  )
}
