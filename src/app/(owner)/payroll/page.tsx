'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface PayrollRow {
  userId: string
  name: string
  role: string
  hourlyWage: number | null
  monthlyWage: number | null
  workDays: number
  totalMinutes: number
  totalWage: number
  registered: boolean
  expenseId: string | null
}

interface PayrollData {
  yearMonth: string
  rows: PayrollRow[]
  totalWage: number
  totalRegistered: number
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: '사장',
  MANAGER: '점장',
  DEPUTY: '대리',
  STAFF: '사원',
  EMPLOYEE: '사원',
}

const won = (n: number) => n.toLocaleString('ko-KR') + '원'
const minutesToHours = (m: number) => {
  const h = Math.floor(m / 60)
  const min = m % 60
  return min > 0 ? `${h}시간 ${min}분` : `${h}시간`
}
const thisMonth = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function PayrollPage() {
  const [month, setMonth] = useState(thisMonth())
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null) // userId 또는 'all'
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll?month=${month}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const register = async (body: { userId?: string; all?: boolean }) => {
    setBusy(body.all ? 'all' : (body.userId ?? null))
    setMsg(null)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, ...body }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error ?? '등록 실패')
      } else {
        setMsg(
          json.registered > 0
            ? `${json.registered}명 급여를 지출로 등록했습니다.`
            : '등록할 새 급여가 없습니다.'
        )
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  const unregisteredWithWage = (data?.rows ?? []).filter(
    (r) => r.totalWage > 0 && !r.registered
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900">급여 관리</h1>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <p className="text-xs text-gray-500">
          출퇴근 기록을 기반으로 직원별 급여를 자동 계산합니다. &lsquo;지출 등록&rsquo;을
          누르면 인건비(WAGE) 지출로 반영돼 손익에 잡힙니다.
        </p>

        {/* 요약 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">{month} 총 급여</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {won(data?.totalWage ?? 0)}
          </p>
          {data && (
            <p className="mt-1 text-xs text-gray-400">
              지출 등록 완료 {data.totalRegistered}명 / 전체{' '}
              {data.rows.filter((r) => r.totalWage > 0).length}명
            </p>
          )}
        </div>

        {msg && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-700">
            {msg}
          </div>
        )}

        {/* 전체 등록 */}
        {unregisteredWithWage.length > 0 && (
          <button
            onClick={() => register({ all: true })}
            disabled={busy !== null}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3.5 rounded-2xl text-sm"
          >
            {busy === 'all'
              ? '등록 중...'
              : `미등록 ${unregisteredWithWage.length}명 급여 한 번에 지출 등록`}
          </button>
        )}

        {/* 직원별 */}
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-10">불러오는 중...</p>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">직원이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {data!.rows.map((r) => (
              <div
                key={r.userId}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {r.name}{' '}
                      <span className="text-xs text-gray-400 font-normal">
                        {ROLE_LABEL[r.role] ?? r.role}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.hourlyWage != null
                        ? `시급 ${r.hourlyWage.toLocaleString()}원`
                        : r.monthlyWage != null
                        ? `월급 ${r.monthlyWage.toLocaleString()}원`
                        : '급여 미설정'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{won(r.totalWage)}</p>
                    <p className="text-xs text-gray-400">
                      {r.workDays}일 · {minutesToHours(r.totalMinutes)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50">
                  {r.registered ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      ✅ 지출 등록 완료
                    </span>
                  ) : r.totalWage > 0 ? (
                    <button
                      onClick={() => register({ userId: r.userId })}
                      disabled={busy !== null}
                      className="w-full bg-gray-100 hover:bg-orange-100 text-orange-600 font-semibold py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {busy === r.userId ? '등록 중...' : '이 직원 급여 지출 등록'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">근무 기록 없음</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/finance"
          className="block text-center text-xs text-gray-400 hover:text-gray-600 py-4"
        >
          재무 화면으로 →
        </Link>
      </div>
    </div>
  )
}
