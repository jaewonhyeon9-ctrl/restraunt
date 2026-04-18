'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface OrderItem {
  id: string
  itemName: string
  quantity: number
  unit: string
  unitPrice: number | null
  totalPrice: number | null
}

type Status = 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'

interface PurchaseOrder {
  id: string
  orderDate: string
  status: Status
  totalAmount: number | null
  note: string | null
  supplier: { id: string; name: string } | null
  requestedBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  items: OrderItem[]
  createdAt: string
}

const STATUS_LABEL: Record<Status, { label: string; color: string }> = {
  PENDING: { label: '승인 대기', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '승인됨', color: 'bg-blue-100 text-blue-700' },
  ORDERED: { label: '주문 완료', color: 'bg-purple-100 text-purple-700' },
  RECEIVED: { label: '입고 완료', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소됨', color: 'bg-gray-100 text-gray-500' },
}

type FilterTab = 'ALL' | Status
const TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'PENDING', label: '대기' },
  { key: 'APPROVED', label: '승인' },
  { key: 'ORDERED', label: '주문' },
  { key: 'RECEIVED', label: '입고' },
  { key: 'CANCELLED', label: '취소' },
]

function OwnerOrdersPageInner() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') as FilterTab | null

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>(
    initialStatus && ['PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(initialStatus)
      ? initialStatus
      : 'ALL'
  )

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    try {
      const res = await fetch('/api/orders')
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch {
      setError('발주 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLegacyAction(orderId: string, action: 'APPROVED' | 'CANCELLED') {
    setProcessing(orderId)
    setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '처리 실패')
      }
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    } finally {
      setProcessing(null)
    }
  }

  async function handleTransition(orderId: string, action: Status) {
    setProcessing(orderId)
    setError('')
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '처리 실패')
      }
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    } finally {
      setProcessing(null)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
  }

  function formatAmount(amount: number | null) {
    if (amount === null) return '-'
    return `${amount.toLocaleString()}원`
  }

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = {
      ALL: orders.length,
      PENDING: 0,
      APPROVED: 0,
      ORDERED: 0,
      RECEIVED: 0,
      CANCELLED: 0,
    }
    for (const o of orders) c[o.status] += 1
    return c
  }, [orders])

  const filtered = activeTab === 'ALL' ? orders : orders.filter((o) => o.status === activeTab)

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/inventory" className="text-gray-400 hover:text-gray-600">
          ←
        </Link>
        <h1 className="text-xl font-bold text-gray-900">발주 내역</h1>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-4 px-4 scrollbar-hide">
        {TABS.map((tab) => {
          const count = counts[tab.key]
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 ${active ? 'text-orange-100' : 'text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>{activeTab === 'ALL' ? '발주 내역이 없습니다.' : '해당 상태의 발주가 없습니다.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const statusInfo = STATUS_LABEL[order.status]
            const isExpanded = expandedId === order.id
            const isProcessing = processing === order.id

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <button
                  className="w-full text-left px-4 py-3"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">
                      {order.supplier?.name ?? '거래처 미지정'}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {formatDate(order.createdAt)} · {order.requestedBy.name} 신청
                    </span>
                    <span className="font-semibold text-gray-600">
                      {formatAmount(order.totalAmount)}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 mb-2">발주 품목</p>
                    <div className="space-y-1.5 mb-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700">{item.itemName}</span>
                          <span className="text-gray-500 text-xs">
                            {item.quantity}{item.unit}
                            {item.totalPrice
                              ? ` · ${item.totalPrice.toLocaleString()}원`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.note && (
                      <p className="text-xs text-gray-400 mb-3">메모: {order.note}</p>
                    )}

                    {/* 상태별 액션 버튼 */}
                    {order.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLegacyAction(order.id, 'CANCELLED')}
                          disabled={isProcessing}
                          className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                        >
                          {isProcessing ? '처리 중...' : '거절'}
                        </button>
                        <button
                          onClick={() => handleLegacyAction(order.id, 'APPROVED')}
                          disabled={isProcessing}
                          className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                        >
                          {isProcessing ? '처리 중...' : '승인'}
                        </button>
                      </div>
                    )}

                    {order.status === 'APPROVED' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTransition(order.id, 'CANCELLED')}
                          disabled={isProcessing}
                          className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleTransition(order.id, 'ORDERED')}
                          disabled={isProcessing}
                          className="flex-1 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50"
                        >
                          {isProcessing ? '처리 중...' : '🛒 주문 완료'}
                        </button>
                      </div>
                    )}

                    {order.status === 'ORDERED' && (
                      <button
                        onClick={() => handleTransition(order.id, 'RECEIVED')}
                        disabled={isProcessing}
                        className="w-full py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                      >
                        {isProcessing ? '처리 중...' : '📦 입고 확인 (재고 자동 증가)'}
                      </button>
                    )}

                    {order.approvedBy && (
                      <p className="text-xs text-gray-400 mt-2 text-right">
                        처리: {order.approvedBy.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function OwnerOrdersPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-center text-gray-400">로딩 중...</div>}>
      <OwnerOrdersPageInner />
    </Suspense>
  )
}
