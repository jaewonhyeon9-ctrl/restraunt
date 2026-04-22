'use client'

import { useCallback, useEffect, useState } from 'react'

type Period = 'today' | 'week' | 'month'

interface CategoryStat {
  completed: number
  total: number
  percent: number
}

interface Employee {
  userId: string
  name: string
  role: string
  completed: number
  total: number
  percent: number
  kitchen: CategoryStat
  hall: CategoryStat
}

interface PerformanceResponse {
  period: Period
  dateRange: { start: string; end: string; days: number }
  templates: { total: number; kitchen: number; hall: number }
  employees: Employee[]
}

const PERIOD_LABELS: Record<Period, string> = {
  today: '오늘',
  week: '최근 7일',
  month: '이번 달',
}

function percentTone(percent: number): { text: string; bar: string } {
  if (percent >= 90) {
    return {
      text: 'text-emerald-300',
      bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    }
  }
  if (percent >= 70) {
    return {
      text: 'text-indigo-300',
      bar: 'bg-gradient-to-r from-indigo-400 to-indigo-500',
    }
  }
  if (percent >= 40) {
    return {
      text: 'text-amber-300',
      bar: 'bg-gradient-to-r from-amber-400 to-amber-500',
    }
  }
  return {
    text: 'text-rose-300',
    bar: 'bg-gradient-to-r from-rose-400 to-rose-500',
  }
}

export default function EmployeePerformanceCard() {
  const [period, setPeriod] = useState<Period>('today')
  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/dashboard/employee-performance?period=${period}`
      )
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const avgPercent =
    data && data.employees.length > 0
      ? Math.round(
          data.employees.reduce((sum, e) => sum + e.percent, 0) /
            data.employees.length
        )
      : 0

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            직원 업무 성과율
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            체크리스트 완료 기준
            {data && data.templates.total > 0 && (
              <span className="text-slate-500">
                {' · '}하루 {data.templates.total}개 항목
              </span>
            )}
          </p>
        </div>
        {!loading && data && data.employees.length > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-slate-500">평균</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                percentTone(avgPercent).text
              }`}
            >
              {avgPercent}%
            </p>
          </div>
        )}
      </div>

      {/* Period tabs */}
      <div className="inline-flex p-1 rounded-lg bg-white/5 ring-1 ring-white/5 mb-3">
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-[11px] font-semibold rounded transition ${
              period === p
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.employees.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          등록된 직원이 없습니다
        </p>
      ) : data.templates.total === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          등록된 체크리스트 항목이 없습니다
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.employees.map((e, idx) => {
            const tone = percentTone(e.percent)
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
            return (
              <li
                key={e.userId}
                className="rounded-xl bg-white/5 ring-1 ring-white/5 p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {medal && <span className="text-sm">{medal}</span>}
                    <span className="text-sm font-semibold text-slate-100 truncate">
                      {e.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className={`text-base font-bold tabular-nums ${tone.text}`}>
                      {e.percent}%
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      ({e.completed}/{e.total})
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                    style={{ width: `${Math.min(100, e.percent)}%` }}
                  />
                </div>

                {/* Kitchen / Hall breakdown (if both have items) */}
                {data.templates.kitchen > 0 && data.templates.hall > 0 && (
                  <div className="flex gap-3 mt-2 text-[11px] text-slate-400">
                    <span>
                      🍳 주방{' '}
                      <span className="font-semibold text-slate-200 tabular-nums">
                        {e.kitchen.percent}%
                      </span>
                    </span>
                    <span>
                      🍽️ 서빙{' '}
                      <span className="font-semibold text-slate-200 tabular-nums">
                        {e.hall.percent}%
                      </span>
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
