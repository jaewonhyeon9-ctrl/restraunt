'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface PendingOrderItem {
  id: string
  itemName: string
  quantity: number
  unit: string
  unitPrice: number | null
  totalPrice: number | null
}

interface PendingOrder {
  id: string
  orderDate: string
  totalAmount: number
  note: string | null
  supplier: { id: string; name: string } | null
  requestedBy: { id: string; name: string } | null
  items: PendingOrderItem[]
}

function formatKRW(amount: number | null | undefined) {
  if (!amount) return '-'
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원'
}

export default function PendingOrdersCard() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  async function refresh() {
    try {
      const res = await fetch('/api/orders?status=PENDING')
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json)) setOrders(json)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAction(
    orderId: string,
    action: 'APPROVED' | 'CANCELLED'
  ) {
    if (action === 'CANCELLED' && !confirm('이 발주를 거절하시겠습니까?')) return
    setProcessing(orderId)
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      })
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        const err = await res.json()
        alert(err.error ?? '처리 실패')
      }
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="h-5 w-40 bg-white/5 rounded animate-pulse mb-2" />
        <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  if (orders.length === 0) return null

  return (
    <section className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <h2 className="text-sm font-semibold text-indigo-100">
            대기 중 발주 요청
          </h2>
          <span className="rounded-full bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5">
            {orders.length}건
          </span>
        </div>
        <Link
          href="/inventory/orders?status=PENDING"
          className="text-[11px] text-indigo-300 hover:text-indigo-200"
        >
          전체 ›
        </Link>
      </div>

      <ul className="space-y-2">
        {orders.map((order) => {
          const isOpen = expandedId === order.id
          return (
            <li
              key={order.id}
              className="rounded-xl bg-black/20 ring-1 ring-white/5 overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isOpen ? null : order.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left active:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    <span className="truncate">
                      {order.supplier?.name ?? '거래처 미지정'}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      · {order.items.length}품목
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>{order.requestedBy?.name ?? '직원'} 신청</span>
                    {order.totalAmount > 0 && (
                      <span className="text-indigo-300 font-semibold tabular-nums">
                        {formatKRW(order.totalAmount)}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-slate-400 transition-transform shrink-0 ml-2 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/5 px-3 py-2.5 space-y-2 bg-black/10">
                  <ul className="space-y-1">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-200 truncate">
                          {item.itemName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-2 text-slate-400 tabular-nums">
                          <span>
                            {item.quantity} {item.unit}
                          </span>
                          {item.totalPrice != null && (
                            <span className="text-slate-300">
                              {formatKRW(item.totalPrice)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {order.note && (
                    <p className="text-[11px] text-slate-400 bg-white/5 rounded px-2 py-1.5">
                      💬 {order.note}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAction(order.id, 'APPROVED')}
                      disabled={processing === order.id}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition active:scale-[0.98]"
                    >
                      {processing === order.id ? '처리 중...' : '승인'}
                    </button>
                    <button
                      onClick={() => handleAction(order.id, 'CANCELLED')}
                      disabled={processing === order.id}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50 transition active:scale-[0.98]"
                    >
                      거절
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
