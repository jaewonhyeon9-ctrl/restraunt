'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

type Range = 7 | 30

interface Point {
  date: string
  label: string
  sales: number
  expenses: number
  netProfit: number
}

interface TrendResponse {
  days: number
  points: Point[]
  totalSales: number
  totalExpenses: number
  avgSales: number
}

function formatKRWShort(n: number): string {
  if (Math.abs(n) >= 10000) {
    const man = Math.round(n / 1000) / 10
    return `${man}만`
  }
  return String(Math.round(n))
}

function formatKRWFull(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n)) + '원'
}

export default function SalesTrendCard() {
  const [range, setRange] = useState<Range>(7)
  const [data, setData] = useState<TrendResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (days: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/sales-trend?days=${days}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(range)
  }, [fetchData, range])

  const hasData = useMemo(
    () => (data?.points ?? []).some((p) => p.sales > 0 || p.expenses > 0),
    [data]
  )

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            매출 추이
          </h2>
          {data && !loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {range}일 평균{' '}
              <span className="font-bold text-sky-300 tabular-nums">
                {formatKRWFull(data.avgSales)}
              </span>
            </p>
          )}
        </div>
        <div className="inline-flex p-0.5 rounded-lg bg-white/5 ring-1 ring-white/5">
          {([7, 30] as Range[]).map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                range === d
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-36 bg-white/5 rounded-lg animate-pulse" />
      ) : !hasData ? (
        <div className="h-36 flex flex-col items-center justify-center text-slate-500 gap-2">
          <span className="text-3xl">📉</span>
          <p className="text-xs">{range}일간 매출 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="h-36 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data!.points}
              margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="rgba(148,163,184,0.6)"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={range === 30 ? 4 : 0}
              />
              <YAxis
                stroke="rgba(148,163,184,0.6)"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatKRWShort(Number(v))}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value, name) => {
                  const label =
                    name === 'sales'
                      ? '매출'
                      : name === 'expenses'
                      ? '지출'
                      : '순이익'
                  return [formatKRWFull(Number(value) || 0), label]
                }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#f43f5e"
                strokeWidth={1.5}
                fill="url(#expensesFill)"
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#salesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
          매출
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
          지출
        </span>
      </div>
    </section>
  )
}
