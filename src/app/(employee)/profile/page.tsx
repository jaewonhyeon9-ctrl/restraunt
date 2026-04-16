'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'

interface AttendanceRecord {
  date: string
  clockIn: string | null
  clockOut: string | null
  workMinutes: number | null
  dailyWage: number | null
}

interface AttendanceSummary {
  totalDays: number
  totalMinutes: number
  totalWage: number
}

interface AttendanceHistory {
  records: AttendanceRecord[]
  summary: AttendanceSummary
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatWorkMinutes(minutes: number | null): string {
  if (minutes === null || minutes === 0) return '0분'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`
}

function getMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

export default function ProfilePage() {
  const { data: session } = useSession()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const [history, setHistory] = useState<AttendanceHistory | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async (year: number, month: number) => {
    setLoading(true)
    try {
      const param = getMonthParam(year, month)
      const res = await fetch(`/api/attendance/history?month=${param}`)
      if (res.ok) {
        const data: AttendanceHistory = await res.json()
        setHistory(data)
      }
    } catch {
      // 무시
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(viewYear, viewMonth)
  }, [viewYear, viewMonth, fetchHistory])

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function handleNextMonth() {
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    if (viewYear > currentYear || (viewYear === currentYear && viewMonth >= currentMonth)) {
      return
    }
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const isNextDisabled =
    viewYear > now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth >= now.getMonth())

  const summary = history?.summary
  const records = history?.records ?? []

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 섹션 1 - 내 정보 카드 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {session?.user?.name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="text-lg font-bold">{session?.user?.name ?? '이름 없음'}</p>
            <p className="text-sm text-blue-100">{session?.user?.email ?? ''}</p>
          </div>
        </div>
      </div>

      {/* 섹션 2 - 월별 근무 요약 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        {/* 월 이동 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="이전 달"
          >
            &#8249;
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {formatMonthLabel(viewYear, viewMonth)} 근무 요약
          </span>
          <button
            onClick={handleNextMonth}
            disabled={isNextDisabled}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isNextDisabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            aria-label="다음 달"
          >
            &#8250;
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">총 근무일</p>
              <p className="text-xl font-bold text-blue-600">{summary?.totalDays ?? 0}</p>
              <p className="text-xs text-gray-400">일</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">총 근무시간</p>
              <p className="text-xl font-bold text-blue-600">
                {summary ? Math.floor(summary.totalMinutes / 60) : 0}
              </p>
              <p className="text-xs text-gray-400">
                시간 {summary ? summary.totalMinutes % 60 : 0}분
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">예상 급여</p>
              <p className="text-xl font-bold text-blue-600">
                {summary ? Math.floor(summary.totalWage / 10000) : 0}
              </p>
              <p className="text-xs text-gray-400">만원</p>
            </div>
          </div>
        )}
      </div>

      {/* 섹션 3 - 출퇴근 이력 리스트 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">출퇴근 이력</p>
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-6">불러오는 중...</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">출퇴근 기록이 없습니다</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {records.map((record) => {
              const weekend = isWeekend(record.date)
              const dateObj = new Date(record.date + 'T00:00:00')
              const dateLabel = dateObj.toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
              })

              return (
                <li key={record.date} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium w-24 ${
                        weekend ? 'text-red-500' : 'text-gray-700'
                      }`}
                    >
                      {dateLabel}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="text-center">
                        <p className="text-gray-400 text-[10px]">출근</p>
                        <p className="font-medium text-gray-700">{formatTime(record.clockIn)}</p>
                      </div>
                      <span className="text-gray-300">—</span>
                      <div className="text-center">
                        <p className="text-gray-400 text-[10px]">퇴근</p>
                        <p className="font-medium text-gray-700">{formatTime(record.clockOut)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-blue-600">
                        {formatWorkMinutes(record.workMinutes)}
                      </p>
                      {record.dailyWage !== null && (
                        <p className="text-[10px] text-gray-400">
                          {record.dailyWage.toLocaleString('ko-KR')}원
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 하단 로그아웃 버튼 */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="w-full py-3 rounded-2xl bg-white border border-gray-200 text-sm font-medium text-gray-500 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
      >
        로그아웃
      </button>
    </div>
  )
}
