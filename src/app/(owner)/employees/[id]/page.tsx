'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface AttendanceItem {
  id: string
  date: string
  clockIn: string | null
  clockOut: string | null
  workMinutes: number
  dailyWage: number
}

interface EmployeeDetail {
  id: string
  name: string
  email: string
  phone: string | null
  hourlyWage: number | null
  fixedMonthlyWage: number | null
  hireDate: string | null
  isActive: boolean
  monthlyMinutes: number
  monthlyWage: number
  attendance: AttendanceItem[]
  checklist: {
    todayCompleted: number
    todayTotal: number
    recent7DaysCompleted: number
  }
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
  return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchEmployee() {
      try {
        const res = await fetch(`/api/employees/${params.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '조회 실패')
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '조회 실패')
      } finally {
        setLoading(false)
      }
    }
    if (params.id) fetchEmployee()
  }, [params.id])

  const now = new Date()
  const thisMonthLabel = `${now.getMonth() + 1}월`

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-3">
        <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-rose-300 text-sm mb-4">{error || '직원을 찾을 수 없습니다'}</p>
        <button
          onClick={() => router.push('/employees')}
          className="text-sm px-4 py-2 rounded-xl bg-white/10 text-slate-200"
        >
          직원 목록으로
        </button>
      </div>
    )
  }

  const todayPct =
    data.checklist.todayTotal > 0
      ? Math.round((data.checklist.todayCompleted / data.checklist.todayTotal) * 100)
      : 0

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 뒤로가기 + 제목 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 ring-1 ring-white/5 text-slate-300 active:scale-95"
          aria-label="뒤로"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold text-slate-100 flex-1 truncate">
          {data.name}
          {!data.isActive && (
            <span className="ml-2 text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full align-middle">
              퇴직
            </span>
          )}
        </h1>
      </div>

      {/* 기본 정보 카드 */}
      <section className="glass-card p-4 space-y-2">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
          기본 정보
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">이메일</span>
          <span className="text-slate-200 truncate ml-2">{data.email}</span>
        </div>
        {data.phone && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">연락처</span>
            <a href={`tel:${data.phone}`} className="text-sky-300">
              {data.phone}
            </a>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">급여</span>
          <span className="text-slate-200">
            {data.hourlyWage != null
              ? `시급 ${data.hourlyWage.toLocaleString()}원`
              : data.fixedMonthlyWage != null
              ? `월급 ${data.fixedMonthlyWage.toLocaleString()}원`
              : '미설정'}
          </span>
        </div>
        {data.hireDate && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">입사일</span>
            <span className="text-slate-200">{data.hireDate.slice(0, 10)}</span>
          </div>
        )}
      </section>

      {/* 이번달 근무 */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 ring-1 ring-indigo-400/20 p-3">
          <p className="text-[11px] text-slate-400 mb-1">{thisMonthLabel} 근무</p>
          <p className="text-base font-bold text-indigo-300 tabular-nums">
            {minutesToHours(data.monthlyMinutes)}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 ring-1 ring-emerald-400/20 p-3">
          <p className="text-[11px] text-slate-400 mb-1">{thisMonthLabel} 급여</p>
          <p className="text-base font-bold text-emerald-300 tabular-nums">
            {data.monthlyWage.toLocaleString()}원
          </p>
        </div>
      </section>

      {/* 체크리스트 성과 */}
      <section className="glass-card p-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
          체크리스트 성과
        </h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm text-slate-300">오늘 완료</span>
              <span className="text-sm font-bold text-indigo-300 tabular-nums">
                {data.checklist.todayCompleted}/{data.checklist.todayTotal} ({todayPct}%)
              </span>
            </div>
            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, todayPct)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-slate-400">최근 7일 완료</span>
            <span className="text-slate-200 font-semibold tabular-nums">
              {data.checklist.recent7DaysCompleted}회
            </span>
          </div>
        </div>
      </section>

      {/* 출퇴근 이력 */}
      <section className="glass-card p-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-3">
          {thisMonthLabel} 출퇴근
        </h2>
        {data.attendance.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            이번달 출근 기록이 없습니다
          </p>
        ) : (
          <ul className="space-y-2">
            {data.attendance.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl bg-white/5 ring-1 ring-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-slate-300 shrink-0 w-14">
                    {formatDate(a.date)}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate">
                    {formatTime(a.clockIn)} ~ {formatTime(a.clockOut)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-300 font-semibold tabular-nums">
                    {minutesToHours(a.workMinutes)}
                  </p>
                  {a.dailyWage > 0 && (
                    <p className="text-[10px] text-emerald-300 tabular-nums">
                      {a.dailyWage.toLocaleString()}원
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 직원 목록으로 */}
      <Link
        href="/employees"
        className="block text-center text-xs text-slate-400 py-2"
      >
        ‹ 전체 직원 목록
      </Link>
    </div>
  )
}
