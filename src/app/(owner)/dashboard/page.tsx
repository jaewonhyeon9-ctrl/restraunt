'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RestaurantLocationCard from '@/components/owner/RestaurantLocationCard'
import PendingOrdersCard from '@/components/owner/PendingOrdersCard'

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────
interface AttendanceRecord {
  userId: string
  name: string
  clockIn: string | null
  clockOut: string | null
}

interface DashboardSummary {
  today: {
    sales: number
    expenses: number
    netProfit: number
  }
  monthly: {
    sales: number
    expenses: number
    netProfit: number
  }
  lowStockCount: number
  pendingOrderCount?: number
  todayAttendance: AttendanceRecord[]
}

function formatKRW(amount: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원'
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

// ──────────────────────────────────────────────
// 서브 컴포넌트
// ──────────────────────────────────────────────
type Tone = 'blue' | 'rose' | 'emerald' | 'slate'
const TONE: Record<Tone, { text: string; bg: string; ring: string }> = {
  blue:    { text: 'text-sky-300',     bg: 'from-sky-500/15 to-sky-500/5',        ring: 'ring-sky-400/20' },
  rose:    { text: 'text-rose-300',    bg: 'from-rose-500/15 to-rose-500/5',      ring: 'ring-rose-400/20' },
  emerald: { text: 'text-emerald-300', bg: 'from-emerald-500/15 to-emerald-500/5', ring: 'ring-emerald-400/20' },
  slate:   { text: 'text-slate-300',   bg: 'from-slate-500/15 to-slate-500/5',     ring: 'ring-slate-400/20' },
}

function SummaryCard({
  label,
  value,
  tone,
  loading,
  href,
}: {
  label: string
  value: number
  tone: Tone
  loading: boolean
  href?: string
}) {
  const t = TONE[tone]
  const content = (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${t.bg} ring-1 ${t.ring} p-3 transition ${
        href ? 'active:scale-[0.98] cursor-pointer hover:ring-2' : ''
      }`}
    >
      <p className="text-[11px] font-medium text-slate-400 mb-1">{label}</p>
      {loading ? (
        <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className={`text-lg font-bold tabular-nums ${t.text}`}>
          {formatKRW(value)}
        </p>
      )}
      {href && (
        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-0.5">
          상세보기
          <span className="transition-transform group-hover:translate-x-0.5">›</span>
        </p>
      )}
    </div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [pendingOrderCount, setPendingOrderCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/dashboard/summary')
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          const detail = json?.detail ? ` (${json.detail})` : ''
          throw new Error(`${json?.error ?? '데이터를 불러오지 못했습니다.'}${detail}`)
        }
        setData(json)
        if (typeof json.pendingOrderCount === 'number') {
          setPendingOrderCount(json.pendingOrderCount)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    const fetchPendingOrders = async () => {
      try {
        const res = await fetch('/api/orders?status=PENDING')
        if (!res.ok) return
        const json = await res.json()
        if (Array.isArray(json)) {
          setPendingOrderCount(json.length)
        }
      } catch {
        // 조용히 무시
      }
    }

    fetchSummary()
    fetchPendingOrders()
  }, [])

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">
      {/* 날짜 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Today
          </p>
          <h1 className="text-xl font-bold text-slate-100 mt-0.5">
            {todayLabel()}
          </h1>
        </div>
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {/* 영수증 촬영 CTA */}
      <Link
        href="/finance/expenses/receipt"
        className="relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 shadow-[0_8px_28px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/30 transition active:scale-[0.99]"
        style={{
          background:
            'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #c026d3 120%)',
        }}
      >
        <span className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6),transparent_40%)]" />
        <span className="relative text-3xl drop-shadow">📸</span>
        <div className="relative">
          <p className="font-bold text-base text-white">영수증 촬영</p>
          <p className="text-xs text-white/80">사진 한 장으로 지출 등록 + 재고 입고</p>
        </div>
        <svg
          className="relative w-5 h-5 ml-auto text-white/80"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>

      {/* 대기 중 발주 요청 카드 */}
      {!loading && pendingOrderCount > 0 && (
        <PendingOrdersCard count={pendingOrderCount} />
      )}

      {/* 안전재고 이하 알림 */}
      {!loading && data && data.lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-200">
              발주 필요 품목 {data.lowStockCount}개
            </p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              안전재고 이하인 품목을 확인해주세요
            </p>
          </div>
        </div>
      )}

      {/* 오늘 손익 */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2.5">
          오늘 손익
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="매출"
            value={data?.today.sales ?? 0}
            tone="blue"
            loading={loading}
            href="/finance/daily"
          />
          <SummaryCard
            label="지출"
            value={data?.today.expenses ?? 0}
            tone="rose"
            loading={loading}
            href="/finance/daily"
          />
          <SummaryCard
            label="순이익"
            value={data?.today.netProfit ?? 0}
            tone={(data?.today.netProfit ?? 0) >= 0 ? 'emerald' : 'slate'}
            loading={loading}
          />
        </div>
      </section>

      {/* 이번 달 누적 */}
      <Link href="/finance/monthly" className="block">
        <section className="glass-card p-4 active:scale-[0.99] transition">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              이번 달 누적
            </h2>
            <span className="text-[11px] text-slate-500">상세 ›</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">누적 매출</span>
                <span className="font-semibold text-sky-300 tabular-nums">
                  {formatKRW(data?.monthly.sales ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">누적 지출</span>
                <span className="font-semibold text-rose-300 tabular-nums">
                  {formatKRW(data?.monthly.expenses ?? 0)}
                </span>
              </div>
              <div className="border-t border-white/5 pt-2.5 flex justify-between items-center">
                <span className="text-slate-200 font-medium">누적 순이익</span>
                <span
                  className={`font-bold text-base tabular-nums ${
                    (data?.monthly.netProfit ?? 0) >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {formatKRW(data?.monthly.netProfit ?? 0)}
                </span>
              </div>
            </div>
          )}
        </section>
      </Link>

      {/* 식당 위치 설정 */}
      <RestaurantLocationCard />

      {/* 출퇴근 현황 */}
      <section className="glass-card p-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
          오늘 출퇴근 현황
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-11 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data || data.todayAttendance.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            오늘 출근 기록이 없습니다
          </p>
        ) : (
          <ul className="space-y-2">
            {data.todayAttendance.map((record) => (
              <li
                key={record.userId}
                className="flex items-center justify-between rounded-xl bg-white/5 ring-1 ring-white/5 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {record.clockOut ? '✅' : '🟢'}
                  </span>
                  <span className="text-sm font-medium text-slate-100">
                    {record.name}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <span>출근 {formatTime(record.clockIn)}</span>
                  {record.clockOut && (
                    <span className="ml-2">퇴근 {formatTime(record.clockOut)}</span>
                  )}
                  {!record.clockOut && record.clockIn && (
                    <span className="ml-2 text-emerald-300 font-medium">근무 중</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
