'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface OrderItem {
  id: string
  itemName: string
  quantity: number
  unit: string
}

interface PurchaseOrder {
  id: string
  status: 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  orderDate: string
  expectedDate: string | null
  totalAmount: number | null
  note: string | null
  createdAt: string
  supplier: { id: string; name: string } | null
  requestedBy: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  items: OrderItem[]
}

const STATUS_META: Record<PurchaseOrder['status'], { label: string; color: string }> = {
  PENDING: { label: '대기', color: 'bg-yellow-500/20 text-yellow-200' },
  APPROVED: { label: '승인', color: 'bg-blue-500/20 text-blue-200' },
  ORDERED: { label: '발주됨', color: 'bg-indigo-500/20 text-indigo-200' },
  RECEIVED: { label: '입고완료', color: 'bg-emerald-500/20 text-emerald-200' },
  CANCELLED: { label: '취소', color: 'bg-rose-500/20 text-rose-200' },
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function OrderHistoryCalendarPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 일자별 발주 그룹핑 (orderDate 기준)
  const byDate = useMemo(() => {
    const map = new Map<string, PurchaseOrder[]>()
    for (const o of orders) {
      const key = o.orderDate.slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(o)
      map.set(key, arr)
    }
    return map
  }, [orders])

  // 캘린더 그리드 생성
  const calendar = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startWeekday = firstDay.getDay() // 0=일
    const daysInMonth = lastDay.getDate()

    type Cell = { date: Date | null; ymd: string | null; orders: PurchaseOrder[] }
    const cells: Cell[] = []
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ date: null, ymd: null, orders: [] })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const ymd = formatYmd(date)
      cells.push({ date, ymd, orders: byDate.get(ymd) ?? [] })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, ymd: null, orders: [] })
    }
    return cells
  }, [cursor, byDate])

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
  const todayYmd = formatYmd(new Date())

  const selectedOrders = selectedDate ? byDate.get(selectedDate) ?? [] : []

  function navigate(delta: number) {
    const next = new Date(cursor)
    next.setMonth(next.getMonth() + delta)
    setCursor(next)
    setSelectedDate(null)
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">📅 발주 내역</h1>
        <Link
          href="/inventory/order"
          className="text-xs text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10"
        >
          + 발주 신청
        </Link>
      </div>

      {/* 월 네비 */}
      <div className="flex items-center justify-between bg-white/5 ring-1 ring-white/10 rounded-2xl px-3 py-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300"
        >
          ‹
        </button>
        <p className="text-sm font-bold text-slate-100">{monthLabel}</p>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-300"
        >
          ›
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 캘린더 */}
          <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-2">
            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div
                  key={d}
                  className={`text-[10px] font-medium py-1 ${
                    i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {calendar.map((cell, i) => {
                const dayOfWeek = i % 7
                const isToday = cell.ymd === todayYmd
                const isSelected = cell.ymd === selectedDate
                const hasOrders = cell.orders.length > 0
                return (
                  <button
                    key={i}
                    disabled={!cell.date}
                    onClick={() => cell.ymd && setSelectedDate(cell.ymd)}
                    className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start text-xs transition-colors ${
                      !cell.date
                        ? 'invisible'
                        : isSelected
                        ? 'bg-indigo-500 text-white ring-2 ring-indigo-300'
                        : isToday
                        ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40'
                        : hasOrders
                        ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/20'
                        : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`text-[11px] ${
                        dayOfWeek === 0 && !isSelected
                          ? 'text-rose-400'
                          : dayOfWeek === 6 && !isSelected
                          ? 'text-blue-400'
                          : ''
                      }`}
                    >
                      {cell.date?.getDate()}
                    </span>
                    {hasOrders && (
                      <span className="text-[9px] font-bold mt-0.5">
                        {cell.orders.length}건
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 선택된 날짜의 발주 상세 */}
          {selectedDate ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-300 px-1">
                📅 {selectedDate.replace(/-/g, '.')} 발주 ({selectedOrders.length}건)
              </p>
              {selectedOrders.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  이 날짜에 발주 내역이 없습니다.
                </p>
              ) : (
                selectedOrders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            STATUS_META[o.status].color
                          }`}
                        >
                          {STATUS_META[o.status].label}
                        </span>
                        {o.supplier && (
                          <span className="text-xs font-semibold text-slate-200">
                            {o.supplier.name}
                          </span>
                        )}
                      </div>
                      {o.totalAmount != null && (
                        <span className="text-xs font-bold text-amber-300">
                          {Math.round(o.totalAmount).toLocaleString()}원
                        </span>
                      )}
                    </div>
                    {o.requestedBy && (
                      <p className="text-[10px] text-slate-500 mb-2">
                        신청: {o.requestedBy.name}
                        {o.expectedDate && ' · 예정일 ' + o.expectedDate.slice(0, 10)}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {o.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex justify-between text-xs bg-white/5 rounded-lg px-2 py-1.5"
                        >
                          <span className="text-slate-200">{it.itemName}</span>
                          <span className="text-slate-400 font-mono tabular-nums">
                            {it.quantity} {it.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {o.note && (
                      <p className="text-[11px] text-slate-400 mt-2 italic">{o.note}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl px-4 py-6 text-center">
              <p className="text-xs text-slate-400">
                날짜를 선택하면 발주 상세를 볼 수 있어요.
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                🟢 발주가 있는 날 · 🟡 오늘
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}