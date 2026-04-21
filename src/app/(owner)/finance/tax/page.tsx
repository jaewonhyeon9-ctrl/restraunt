'use client'

import { useEffect, useState } from 'react'

interface VatBreakdown {
  grossSales: number
  supplyAmount: number
  salesVat: number
  grossPurchases: number
  purchaseVat: number
  cardSales: number
  cardDeduction: number
  expectedVat: number
}

interface IncomeTaxBreakdown {
  revenue: number
  totalExpenses: number
  taxableIncome: number
  appliedRate: number
  estimatedTax: number
  localTax: number
}

interface TaxSummary {
  date: string
  year: number
  month: number
  quarter: number
  daily: VatBreakdown
  monthly: VatBreakdown
  quarterly: VatBreakdown
  incomeTax: IncomeTaxBreakdown
  filing: { label: string; date: string; daysLeft: number }
}

function won(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원'
}

function percent(n: number): string {
  return (n * 100).toFixed(0) + '%'
}

export default function TaxPage() {
  const [data, setData] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/tax')
        if (!res.ok) throw new Error('세무 정보 조회 실패')
        const json = (await res.json()) as TaxSummary
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '오류')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="px-4 py-6 text-gray-500">불러오는 중…</div>
  }
  if (error || !data) {
    return <div className="px-4 py-6 text-red-500">{error ?? '데이터 없음'}</div>
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">세무 자동 계산</h1>

      {/* 신고일 카운트다운 */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-orange-700 font-semibold">다음 부가세 신고</p>
        <p className="text-base font-bold text-orange-900 mt-0.5">
          {data.filing.label} — {data.filing.date}
        </p>
        <p className="text-xs text-orange-700 mt-0.5">
          {data.filing.daysLeft}일 남음
        </p>
      </div>

      {/* 오늘 부가세 */}
      <VatCard title={`오늘 (${data.date})`} vat={data.daily} highlight />

      {/* 이번달 부가세 */}
      <VatCard
        title={`${data.year}년 ${data.month}월 누적`}
        vat={data.monthly}
      />

      {/* 분기 부가세 */}
      <VatCard
        title={`${data.year}년 ${data.quarter}분기 누적`}
        vat={data.quarterly}
      />

      {/* 종합소득세 예상 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">
            {data.year}년 예상 종합소득세
          </h2>
          <span className="text-xs text-gray-400">
            세율 {percent(data.incomeTax.appliedRate)}
          </span>
        </div>
        <Row label="연 매출 (공급가액)" value={won(data.incomeTax.revenue)} />
        <Row label="연 경비" value={won(data.incomeTax.totalExpenses)} muted />
        <Row
          label="과세표준"
          value={won(data.incomeTax.taxableIncome)}
          divider
        />
        <Row
          label="예상 종합소득세"
          value={won(data.incomeTax.estimatedTax)}
          strong
        />
        <Row
          label="지방소득세 (10%)"
          value={won(data.incomeTax.localTax)}
          muted
        />
        <Row
          label="총 예상 납부"
          value={won(data.incomeTax.estimatedTax + data.incomeTax.localTax)}
          strong
          divider
        />
        <p className="text-xs text-gray-400 mt-2 leading-snug">
          ※ 기본공제·세액공제 미반영 추정치. 신고 시 실제 금액은 다를 수 있습니다.
        </p>
      </div>
    </div>
  )
}

function VatCard({
  title,
  vat,
  highlight,
}: {
  title: string
  vat: VatBreakdown
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm px-4 py-4 ${
        highlight ? 'border-orange-200' : 'border-gray-100'
      }`}
    >
      <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>
      <Row label="매출 (부가세 포함)" value={won(vat.grossSales)} />
      <Row label="  └ 공급가액" value={won(vat.supplyAmount)} muted />
      <Row label="  └ 매출세액" value={won(vat.salesVat)} muted />
      <Row label="매입 (공제대상)" value={won(vat.grossPurchases)} divider />
      <Row label="  └ 매입세액" value={won(vat.purchaseVat)} muted />
      <Row
        label="카드/배달매출 공제 (1.3%)"
        value={`− ${won(vat.cardDeduction)}`}
        muted
      />
      <Row
        label="예상 납부 부가세"
        value={won(vat.expectedVat)}
        strong
        divider
      />
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  strong,
  divider,
}: {
  label: string
  value: string
  muted?: boolean
  strong?: boolean
  divider?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        divider ? 'border-t border-gray-100 mt-1 pt-2' : ''
      }`}
    >
      <span
        className={`text-sm ${
          muted ? 'text-gray-400' : strong ? 'text-gray-900 font-semibold' : 'text-gray-600'
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          muted
            ? 'text-gray-400'
            : strong
            ? 'text-orange-600 font-bold text-base'
            : 'text-gray-900 font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
