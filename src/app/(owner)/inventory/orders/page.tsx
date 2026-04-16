'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface OrderItem {
  id: string
  itemName: string
  quantity: number
  unit: string
  unitPrice: number | null
  totalPrice: number | null
}

interface PurchaseOrder {
  id: string
  orderDate: string
  status: 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  totalAmount: number | null
  note: string | null
  supplier: { id: string; name: string } | null
  requestedBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
  items: OrderItem[]
  createdAt: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: '승인 대기', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '승인됨', color: 'bg-blue-100 text-blue-700' },
  ORDERED: { label: '발주 완료', color: 'bg-purple-100 text-purple-700' },
  RECEIVED: { label: '입고 완료', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소됨', color: 'bg-gray-100 text-gray-500' },
}

export default function OwnerOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const pendingOrders = orders.filter((o) => o.status === 'PENDING')

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

  async function handleAction(orderId: string, action: 'APPROVED' | 'CANCELLED') {
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
    } catch (err: any) {
      setError(err.message)
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

  return (
    <div className="px-4 py-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/owner/inventory" className="text-gray-400 hover:text-gray-600">
          ←
        </Link>
        <h1 className="text-xl font-bold text-gray-900">발주 내역</h1>
      </div>

      {/* 승인 대기 배너 */}
      {pendingOrders.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-yellow-700 font-semibold text-sm">
            ⏳ 승인 대기 중인 발주 {pendingOrders.length}건
          </p>
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>발주 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_LABEL[order.status] ?? {
              label: order.status,
              color: 'bg-gray-100 text-gray-500',
            }
            const isExpanded = expandedId === order.id

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* 발주 헤더 행 */}
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

                {/* 상세 펼침 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    {/* 품목 목록 */}
                    <p className="text-xs font-semibold text-gray-500 mb-2">발주 품목</p>
                    <div className="space-y-1.5 mb-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700">
                            {item.itemName}
                          </span>
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

                    {/* 승인/거절 버튼 (PENDING 상태만) */}
                    {order.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(order.id, 'CANCELLED')}
                          disabled={processing === order.id}
                          className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        >
                          {processing === order.id ? '처리 중...' : '거절'}
                        </button>
                        <button
                          onClick={() => handleAction(order.id, 'APPROVED')}
                          disabled={processing === order.id}
                          className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                          {processing === order.id ? '처리 중...' : '승인'}
                        </button>
                      </div>
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
