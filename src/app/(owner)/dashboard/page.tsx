'use client'

import { useEffect, useState } from 'react'

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
  todayAttendance: AttendanceRecord[]
}

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
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
function SummaryCard({
  label,
  value,
  color,
  loading,
}: {
  label: string
  value: number
  color: string
  loading: boolean
}) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-medium text-white/80 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-24 bg-white/30 rounded-lg animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-white">{formatKRW(value)}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/dashboard/summary')
        if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.')
        const json = await res.json()
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* 날짜 헤더 */}
      <div>
        <p className="text-xs text-gray-400 font-medium">오늘</p>
        <h1 className="text-xl font-bold text-gray-900">{todayLabel()}</h1>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 안전재고 이하 알림 배너 */}
      {!loading && data && data.lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              발주 필요 품목 {data.lowStockCount}개
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              안전재고 이하인 품목을 확인해주세요
            </p>
          </div>
        </div>
      )}

      {/* 오늘 매출/지출/순이익 카드 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">오늘 손익</h2>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="매출"
            value={data?.today.sales ?? 0}
            color="bg-blue-500"
            loading={loading}
          />
          <SummaryCard
            label="지출"
            value={data?.today.expenses ?? 0}
            color="bg-rose-500"
            loading={loading}
          />
          <SummaryCard
            label="순이익"
            value={data?.today.netProfit ?? 0}
            color={
              (data?.today.netProfit ?? 0) >= 0
                ? 'bg-emerald-500'
                : 'bg-gray-500'
            }
            loading={loading}
          />
        </div>
      </section>

      {/* 이번 달 누적 손익 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          이번 달 누적
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">누적 매출</span>
              <span className="font-semibold text-blue-600">
                {formatKRW(data?.monthly.sales ?? 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">누적 지출</span>
              <span className="font-semibold text-rose-600">
                {formatKRW(data?.monthly.expenses ?? 0)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-gray-700 font-medium">누적 순이익</span>
              <span
                className={`font-bold text-base ${
                  (data?.monthly.netProfit ?? 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {formatKRW(data?.monthly.netProfit ?? 0)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 직원 출퇴근 현황 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          오늘 출퇴근 현황
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data || data.todayAttendance.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            오늘 출근 기록이 없습니다
          </p>
        ) : (
          <ul className="space-y-2">
            {data.todayAttendance.map((record) => (
              <li
                key={record.userId}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {record.clockOut ? '✅' : '🟢'}
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {record.name}
                  </span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <span>출근 {formatTime(record.clockIn)}</span>
                  {record.clockOut && (
                    <span className="ml-2">퇴근 {formatTime(record.clockOut)}</span>
                  )}
                  {!record.clockOut && record.clockIn && (
                    <span className="ml-2 text-emerald-600 font-medium">근무 중</span>
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
