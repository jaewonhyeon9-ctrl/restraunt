'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const NOTE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  HANDOVER: { label: '전달사항', icon: '📋', color: 'text-sky-300' },
  ANOMALY: { label: '특이사항', icon: '⚠️', color: 'text-amber-300' },
  OWNER_NOTE: { label: '사장님께', icon: '📣', color: 'text-rose-300' },
  COMPLAINT: { label: '컴플레인', icon: '💢', color: 'text-rose-400' },
}

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  INGREDIENT: '식자재',
  UTILITY: '공과금',
  WAGE: '인건비',
  RENT: '임대료',
  EQUIPMENT: '장비',
  OTHER: '기타',
}

interface ReportData {
  restaurant: { name: string }
  date: string
  finance: {
    sales: {
      total: number
      cash: number
      card: number
      delivery: number
      note: string | null
    }
    expenses: {
      variable: number
      fixedDaily: number
      total: number
      byCategory: Record<string, number>
      items: {
        id: string
        category: string
        amount: number
        description: string | null
        supplier: string | null
      }[]
    }
    netProfit: number
  }
  attendance: {
    summary: { workers: number; totalMinutes: number; totalWage: number }
    list: {
      userId: string
      name: string
      clockIn: string | null
      clockOut: string | null
      workMinutes: number
      dailyWage: number
    }[]
  }
  orders: {
    summary: {
      total: number
      pending: number
      approved: number
      ordered: number
      received: number
      cancelled: number
      totalAmount: number
    }
    list: {
      id: string
      status: string
      totalAmount: number
      supplier: string | null
      requestedBy: string | null
      itemCount: number
      itemsPreview: string[]
    }[]
  }
  notes: {
    id: string
    type: string
    category: string | null
    content: string
    author: string | null
    createdAt: string
  }[]
  checklist: {
    totalTemplates: number
    totalCompleted: number
    byEmployee: {
      userId: string
      name: string
      done: number
      total: number
      percent: number
    }[]
  }
}

function formatKRW(amount: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원'
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

function buildShareText(data: ReportData) {
  const d = new Date(data.date)
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`
  const { sales, expenses, netProfit } = data.finance

  const lines: string[] = [
    `📊 [${data.restaurant.name}] ${dateStr} 마감 리포트`,
    '',
    `💰 매출: ${formatKRW(sales.total)}`,
  ]
  if (sales.cash || sales.card || sales.delivery) {
    const parts: string[] = []
    if (sales.cash) parts.push(`현금 ${formatKRW(sales.cash)}`)
    if (sales.card) parts.push(`카드 ${formatKRW(sales.card)}`)
    if (sales.delivery) parts.push(`배달 ${formatKRW(sales.delivery)}`)
    lines.push(`  ${parts.join(' / ')}`)
  }
  lines.push(
    `💸 지출: ${formatKRW(expenses.total)} (변동 ${formatKRW(expenses.variable)} + 고정 ${formatKRW(expenses.fixedDaily)})`
  )
  lines.push(`📈 순이익: ${formatKRW(netProfit)}`)
  lines.push('')
  lines.push(
    `👥 근무: ${data.attendance.summary.workers}명 / ${minutesToHours(data.attendance.summary.totalMinutes)}`
  )
  lines.push(
    `✅ 체크리스트: ${data.checklist.totalCompleted}/${data.checklist.totalTemplates * (data.checklist.byEmployee.length || 1)}`
  )
  if (data.orders.summary.total > 0) {
    lines.push(
      `🛒 발주: ${data.orders.summary.total}건 (대기 ${data.orders.summary.pending})`
    )
  }
  if (data.notes.length > 0) {
    lines.push('')
    lines.push(`📝 메모 ${data.notes.length}건`)
    data.notes.slice(0, 3).forEach((n) => {
      const label = NOTE_LABEL[n.type]?.label ?? n.type
      lines.push(`  · [${label}] ${n.content}`)
    })
    if (data.notes.length > 3) {
      lines.push(`  …외 ${data.notes.length - 3}건`)
    }
  }
  lines.push('')
  lines.push('— 오토드림')
  return lines.join('\n')
}

export default function DailyReportPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 space-y-3">
          <div className="h-8 w-44 bg-white/5 rounded animate-pulse" />
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <DailyReportInner />
    </Suspense>
  )
}

function DailyReportInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      try {
        const q = dateParam ? `?date=${dateParam}` : ''
        const res = await fetch(`/api/reports/daily${q}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '조회 실패')
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '조회 실패')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [dateParam])

  const shareText = useMemo(() => (data ? buildShareText(data) : ''), [data])

  async function handleShare() {
    if (!shareText) return
    const nav = navigator as Navigator & {
      share?: (data: { text: string; title?: string }) => Promise<void>
    }
    if (nav.share) {
      try {
        await nav.share({ text: shareText, title: '오토드림 마감 리포트' })
        return
      } catch {
        // 공유 취소/실패 → 복사로 폴백
      }
    }
    handleCopy()
  }

  async function handleCopy() {
    if (!shareText) return
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('복사에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-3">
        <div className="h-8 w-44 bg-white/5 rounded animate-pulse" />
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-rose-300 text-sm mb-4">{error || '데이터 없음'}</p>
        <button
          onClick={() => router.back()}
          className="text-sm px-4 py-2 rounded-xl bg-white/10 text-slate-200"
        >
          뒤로
        </button>
      </div>
    )
  }

  const { finance, attendance, orders, notes, checklist } = data
  const profitTone =
    finance.netProfit > 0
      ? 'text-emerald-300'
      : finance.netProfit < 0
      ? 'text-rose-300'
      : 'text-slate-200'

  return (
    <div className="px-4 py-5 pb-24 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/5 text-slate-300 active:scale-95"
          aria-label="뒤로"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Closing Report
          </p>
          <h1 className="text-xl font-bold text-slate-100 truncate">
            {formatDate(data.date)}
          </h1>
        </div>
      </div>

      {/* 공유 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold shadow-lg active:scale-[0.98]"
        >
          📤 공유하기
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 text-slate-200 text-sm font-semibold active:scale-[0.98]"
        >
          {copied ? '✓ 복사됨' : '📋 복사'}
        </button>
      </div>

      {/* 손익 요약 */}
      <section className="glass-card p-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
          손익 요약
        </h2>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl bg-sky-500/10 ring-1 ring-sky-400/20 p-2.5">
            <p className="text-[10px] text-slate-400">매출</p>
            <p className="text-base font-bold text-sky-300 tabular-nums">
              {formatKRW(finance.sales.total)}
            </p>
          </div>
          <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/20 p-2.5">
            <p className="text-[10px] text-slate-400">지출</p>
            <p className="text-base font-bold text-rose-300 tabular-nums">
              {formatKRW(finance.expenses.total)}
            </p>
          </div>
          <div className={`rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/20 p-2.5 ${finance.netProfit < 0 ? 'bg-rose-500/10 ring-rose-400/20' : ''}`}>
            <p className="text-[10px] text-slate-400">순이익</p>
            <p className={`text-base font-bold tabular-nums ${profitTone}`}>
              {formatKRW(finance.netProfit)}
            </p>
          </div>
        </div>

        {/* 매출 상세 */}
        {(finance.sales.cash > 0 ||
          finance.sales.card > 0 ||
          finance.sales.delivery > 0) && (
          <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-white/5 pt-2">
            {finance.sales.cash > 0 && (
              <div className="flex justify-between">
                <span>현금</span>
                <span className="tabular-nums">{formatKRW(finance.sales.cash)}</span>
              </div>
            )}
            {finance.sales.card > 0 && (
              <div className="flex justify-between">
                <span>카드</span>
                <span className="tabular-nums">{formatKRW(finance.sales.card)}</span>
              </div>
            )}
            {finance.sales.delivery > 0 && (
              <div className="flex justify-between">
                <span>배달</span>
                <span className="tabular-nums">{formatKRW(finance.sales.delivery)}</span>
              </div>
            )}
          </div>
        )}

        {/* 지출 카테고리별 */}
        {Object.keys(finance.expenses.byCategory).length > 0 && (
          <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-white/5 pt-2 mt-2">
            {Object.entries(finance.expenses.byCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between">
                <span>{EXPENSE_CATEGORY_LABEL[cat] ?? cat}</span>
                <span className="tabular-nums">{formatKRW(amt)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-500 pt-1">
              <span>고정비 일할</span>
              <span className="tabular-nums">
                {formatKRW(finance.expenses.fixedDaily)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 출퇴근 */}
      <section className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            근무 현황
          </h2>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">총 근무</p>
            <p className="text-sm font-bold text-slate-200 tabular-nums">
              {minutesToHours(attendance.summary.totalMinutes)} · {attendance.summary.workers}명
            </p>
          </div>
        </div>
        {attendance.list.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-3">
            출근 기록 없음
          </p>
        ) : (
          <ul className="space-y-1.5">
            {attendance.list.map((a) => (
              <li
                key={a.userId}
                className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5"
              >
                <span className="text-slate-200 font-medium">{a.name}</span>
                <div className="flex items-center gap-2 text-slate-400 tabular-nums">
                  <span>{minutesToHours(a.workMinutes)}</span>
                  {a.dailyWage > 0 && (
                    <span className="text-emerald-300">
                      {formatKRW(a.dailyWage)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 체크리스트 달성 */}
      {checklist.totalTemplates > 0 && (
        <section className="glass-card p-4">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
            체크리스트 달성 (오늘 {checklist.totalTemplates}개 기준)
          </h2>
          {checklist.byEmployee.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-3">
              완료한 직원 없음
            </p>
          ) : (
            <ul className="space-y-2">
              {checklist.byEmployee.map((e) => (
                <li key={e.userId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-200 font-semibold">{e.name}</span>
                    <span className="text-slate-400 tabular-nums">
                      {e.done}/{e.total} ({e.percent}%)
                    </span>
                  </div>
                  <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        e.percent >= 90
                          ? 'bg-emerald-400'
                          : e.percent >= 70
                          ? 'bg-indigo-400'
                          : e.percent >= 40
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.min(100, e.percent)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 발주 */}
      {orders.summary.total > 0 && (
        <section className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              발주 현황
            </h2>
            <span className="text-[11px] text-slate-400 tabular-nums">
              총 {orders.summary.total}건 · {formatKRW(orders.summary.totalAmount)}
            </span>
          </div>
          <ul className="space-y-1.5">
            {orders.list.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <span className="text-slate-200 font-medium">
                    {o.supplier ?? '거래처 미지정'}
                  </span>
                  <span className="text-slate-500 ml-1.5">· {o.itemCount}품목</span>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    o.status === 'PENDING'
                      ? 'bg-amber-400/20 text-amber-300'
                      : o.status === 'APPROVED'
                      ? 'bg-sky-400/20 text-sky-300'
                      : o.status === 'ORDERED'
                      ? 'bg-indigo-400/20 text-indigo-300'
                      : o.status === 'RECEIVED'
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'bg-rose-400/20 text-rose-300'
                  }`}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 메모 */}
      {notes.length > 0 && (
        <section className="glass-card p-4">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
            오늘의 메모 ({notes.length}건)
          </h2>
          <ul className="space-y-2">
            {notes.map((n) => {
              const meta = NOTE_LABEL[n.type] ?? { label: n.type, icon: '📝', color: 'text-slate-300' }
              return (
                <li
                  key={n.id}
                  className="rounded-xl bg-white/5 ring-1 ring-white/5 px-3 py-2"
                >
                  <div className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1 ${meta.color}`}>
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    {n.category && (
                      <span className="text-slate-500 font-normal">
                        · {n.category === 'KITCHEN' ? '주방' : '서빙'}
                      </span>
                    )}
                    {n.author && (
                      <span className="ml-auto text-slate-500 font-normal">
                        {n.author}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                    {n.content}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
