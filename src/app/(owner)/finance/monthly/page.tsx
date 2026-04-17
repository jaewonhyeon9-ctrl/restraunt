'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DailyRow {
  date: string
  sales: number
  expenses: number
  netProfit: number
}

interface SupplierSummary {
  supplierId: string
  supplierName: string
  total: number
}

interface FixedExpenseItem {
  id: string
  name: string
  category: string
  amount: number
  isDailyCalc: boolean
}

interface MonthlySummary {
  totalSales: number
  totalExpenses: number
  totalFixed: number
  totalAll: number
  netProfit: number
  profitMargin: number
  dailyRows: DailyRow[]
  supplierSummaries: SupplierSummary[]
  fixedExpenses: FixedExpenseItem[]
}

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatPercent(n: number): string {
  return n.toFixed(1) + '%'
}

export default function MonthlyFinancePage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'daily' | 'supplier'>('daily')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const [expRes, saleRes, fixedRes] = await Promise.all([
        fetch(`/api/expenses?month=${monthStr}`),
        fetch(`/api/sales?month=${monthStr}`),
        fetch('/api/fixed-expenses'),
      ])

      const expData = expRes.ok ? await expRes.json() : { expenses: [] }
      const saleData = saleRes.ok ? await saleRes.json() : { sales: [] }
      const fixedData = fixedRes.ok ? await fixedRes.json() : { fixedExpenses: [], wageEmployees: [], totalWages: 0 }

      const expenses: Array<{ expenseDate: string; amount: number; supplierId?: string; supplier?: { id: string; name: string } | null }> = expData.expenses || []
      const sales: Array<{ saleDate: string; amount: number }> = saleData.sales || []
      const fixedList: FixedExpenseItem[] = fixedData.fixedExpenses || []
      const totalWages: number = fixedData.totalWages || 0

      // 고정비용 월 총액 (월급제 직원 포함)
      const totalFixed = fixedList.reduce((s: number, f: FixedExpenseItem) => s + f.amount, 0) + totalWages

      // 일별 집계
      const daysInMonth = new Date(year, month, 0).getDate()
      const fixedDailyAmount = fixedList
        .filter((f: FixedExpenseItem) => f.isDailyCalc)
        .reduce((s: number, f: FixedExpenseItem) => s + Math.round(f.amount / daysInMonth), 0)
        + Math.round(totalWages / daysInMonth)

      const dayMap: Record<string, { sales: number; expenses: number }> = {}
      sales.forEach((s) => {
        const d = s.saleDate.slice(0, 10)
        if (!dayMap[d]) dayMap[d] = { sales: 0, expenses: 0 }
        dayMap[d].sales += s.amount
      })
      expenses.forEach((e) => {
        const d = e.expenseDate.slice(0, 10)
        if (!dayMap[d]) dayMap[d] = { sales: 0, expenses: 0 }
        dayMap[d].expenses += e.amount
      })

      // 각 일별 행에 고정비 일할분 추가
      const dailyRows: DailyRow[] = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          sales: v.sales,
          expenses: v.expenses + fixedDailyAmount,
          netProfit: v.sales - v.expenses - fixedDailyAmount,
        }))

      // 거래처별 집계
      const supplierMap: Record<string, { name: string; total: number }> = {}
      expenses.forEach((e) => {
        if (e.supplier) {
          const sid = e.supplier.id
          if (!supplierMap[sid]) supplierMap[sid] = { name: e.supplier.name, total: 0 }
          supplierMap[sid].total += e.amount
        }
      })

      const supplierSummaries: SupplierSummary[] = Object.entries(supplierMap)
        .map(([id, v]) => ({ supplierId: id, supplierName: v.name, total: v.total }))
        .sort((a, b) => b.total - a.total)

      const totalSales = sales.reduce((s, i) => s + i.amount, 0)
      const totalExpenses = expenses.reduce((s, i) => s + i.amount, 0)
      const totalAll = totalExpenses + totalFixed
      const netProfit = totalSales - totalAll
      const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0

      setSummary({ totalSales, totalExpenses, totalFixed, totalAll, netProfit, profitMargin, dailyRows, supplierSummaries, fixedExpenses: fixedList })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }

  const nextMonth = () => {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }

  const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">월별 누적 손익</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 월 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-base font-bold text-gray-900">
              {year}년 {month}월
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentOrFuture}
              className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summary ? (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '누적 매출', value: formatCurrency(summary.totalSales), color: 'text-gray-900' },
                { label: '변동 지출', value: formatCurrency(summary.totalExpenses), color: 'text-red-500' },
                { label: '고정비용', value: formatCurrency(summary.totalFixed), color: 'text-purple-600' },
                { label: '총 지출', value: formatCurrency(summary.totalAll), color: 'text-red-600' },
                { label: '순이익', value: formatCurrency(summary.netProfit), color: summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-500' },
                { label: '수익률', value: formatPercent(summary.profitMargin), color: summary.profitMargin >= 0 ? 'text-green-600' : 'text-red-500' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color} truncate`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* 고정비용 상세 */}
            {summary.fixedExpenses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">고정비용 내역</h2>
                <div className="space-y-2">
                  {summary.fixedExpenses.map((f) => (
                    <div key={f.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-medium">{f.name}</span>
                        {f.isDailyCalc && (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">일할</span>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">{formatCurrency(f.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-3 mt-2 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">고정비용 합계</span>
                  <span className="text-sm font-bold text-purple-600">{formatCurrency(summary.totalFixed)}</span>
                </div>
              </div>
            )}

            {/* 탭 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                {([['daily', '일별 손익'], ['supplier', '거래처별']] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'text-orange-600 border-b-2 border-orange-500'
                        : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 일별 손익 탭 */}
              {activeTab === 'daily' && (
                <div className="divide-y divide-gray-50">
                  {summary.dailyRows.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다</p>
                  ) : (
                    <>
                      {/* 테이블 헤더 */}
                      <div className="grid grid-cols-4 px-4 py-2 bg-gray-50">
                        <span className="text-xs text-gray-500 font-medium">날짜</span>
                        <span className="text-xs text-gray-500 font-medium text-right">매출</span>
                        <span className="text-xs text-gray-500 font-medium text-right">지출</span>
                        <span className="text-xs text-gray-500 font-medium text-right">순이익</span>
                      </div>
                      {summary.dailyRows.map((row) => {
                        const day = row.date.slice(8)
                        const dateObj = new Date(row.date)
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()]
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                        return (
                          <button
                            key={row.date}
                            onClick={() => router.push(`/finance/daily?date=${row.date}`)}
                            className="w-full grid grid-cols-4 px-4 py-3 hover:bg-orange-50 transition-colors text-left"
                          >
                            <span className={`text-sm font-medium ${isWeekend ? 'text-red-500' : 'text-gray-800'}`}>
                              {day}일 ({dayOfWeek})
                            </span>
                            <span className="text-sm text-gray-700 text-right">
                              {row.sales === 0 ? '-' : (row.sales / 10000).toFixed(0) + '만'}
                            </span>
                            <span className="text-sm text-gray-500 text-right">
                              {row.expenses === 0 ? '-' : (row.expenses / 10000).toFixed(0) + '만'}
                            </span>
                            <span className={`text-sm font-semibold text-right ${row.netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                              {row.netProfit === 0 ? '-' : (row.netProfit >= 0 ? '+' : '') + (row.netProfit / 10000).toFixed(0) + '만'}
                            </span>
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              )}

              {/* 거래처별 탭 */}
              {activeTab === 'supplier' && (
                <div className="divide-y divide-gray-50">
                  {summary.supplierSummaries.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">거래처 데이터가 없습니다</p>
                  ) : (
                    <>
                      {summary.supplierSummaries.map((s, idx) => (
                        <div key={s.supplierId} className="flex items-center gap-3 px-4 py-3">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm text-gray-800 font-medium">{s.supplierName}</span>
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(s.total)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-4 py-3 bg-gray-50">
                        <span className="text-sm font-semibold text-gray-700">합계</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(summary.supplierSummaries.reduce((s, i) => s + i.total, 0))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
