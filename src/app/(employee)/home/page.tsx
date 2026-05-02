'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { calculateDistance } from '@/lib/gps'

interface AttendanceStatus {
  clockIn: string | null
  clockOut: string | null
  workMinutes: number | null
}

interface ChecklistPreview {
  total: number
  completed: number
}

interface RestaurantLocation {
  lat: number | null
  lng: number | null
  gpsRadius: number
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatWorkTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

export default function EmployeeHomePage() {
  const { data: session } = useSession()

  const [restaurant, setRestaurant] = useState<RestaurantLocation | null>(null)
  const geo = useGeolocation(
    restaurant?.lat ?? undefined,
    restaurant?.lng ?? undefined,
    restaurant?.gpsRadius ?? 50
  )

  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null)
  const [checklist, setChecklist] = useState<ChecklistPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await fetch('/api/restaurant')
        if (res.ok) {
          const data = await res.json()
          setRestaurant({ lat: data.lat, lng: data.lng, gpsRadius: data.gpsRadius ?? 50 })
        }
      } catch {
        // 무시
      }
    }
    fetchRestaurant()
  }, [])

  // 현재 시각 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 출퇴근 상태 조회
  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance')
      if (res.ok) {
        const data = await res.json()
        setAttendance(data)
      }
    } catch {
      // 무시
    }
  }, [])

  // 체크리스트 미리보기 조회
  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch('/api/checklist')
      if (res.ok) {
        const data = await res.json()
        const total = data.length as number
        const completed = (data as Array<{ isChecked: boolean }>).filter((i) => i.isChecked).length
        setChecklist({ total, completed })
      }
    } catch {
      // 무시
    }
  }, [])

  useEffect(() => {
    fetchAttendance()
    fetchChecklist()
  }, [fetchAttendance, fetchChecklist])

  // 클릭 시점에 GPS 재측정 (정확도 우선)
  const acquireFreshLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS를 지원하지 않는 기기'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
        },
        (err) => reject(new Error(err.message || '위치를 가져올 수 없어요')),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      )
    })
  }

  const handleAttendance = async (type: 'in' | 'out') => {
    if (restaurant && (restaurant.lat == null || restaurant.lng == null)) {
      setError('사장님이 아직 식당 위치를 설정하지 않았습니다.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      // 1단계: 클릭 시점 신선한 GPS 측정
      let fresh: { lat: number; lng: number; accuracy: number }
      try {
        fresh = await acquireFreshLocation()
      } catch (e) {
        setError(
          (e instanceof Error ? e.message : '') +
            ' (위치 권한을 확인해주세요)'
        )
        return
      }

      // 2단계: 식당 반경 체크 (즉시 피드백)
      if (restaurant?.lat != null && restaurant?.lng != null) {
        const dist = calculateDistance(fresh.lat, fresh.lng, restaurant.lat, restaurant.lng)
        const radius = restaurant.gpsRadius ?? 50
        if (dist > radius) {
          setError(
            `식당 반경 ${radius}m 이내에서만 출퇴근이 가능합니다. ` +
              `현재 거리 ${Math.round(dist)}m (정확도 ±${Math.round(fresh.accuracy)}m)`
          )
          return
        }
      }

      // 3단계: 서버 전송
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, lat: fresh.lat, lng: fresh.lng }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '처리 중 오류가 발생했습니다.')
      } else {
        await fetchAttendance()
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const hasClockIn = !!attendance?.clockIn
  const hasClockOut = !!attendance?.clockOut
  const incomplete = checklist ? checklist.total - checklist.completed : 0

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 인사 헤더 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-md">
        <p className="text-sm text-blue-100 mb-1">
          {now.toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
        <p className="text-2xl font-bold tracking-wide">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="mt-2 text-base font-medium text-blue-50">
          안녕하세요, {session?.user?.name ?? '직원'}님 👋
        </p>
      </div>

      {/* GPS 상태 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-700 text-sm">📍 내 위치</span>
          {restaurant && (restaurant.lat == null || restaurant.lng == null) ? (
            <span className="text-xs text-amber-600">식당 위치 미설정</span>
          ) : geo.loading ? (
            <span className="text-xs text-gray-400">위치 확인 중...</span>
          ) : geo.error ? (
            <span className="text-xs text-red-500">{geo.error}</span>
          ) : (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                geo.isWithinRange
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-600'
              }`}
            >
              {geo.isWithinRange
                ? '식당 반경 내'
                : `${geo.distance != null ? Math.round(geo.distance) : '--'}m 이탈`}
            </span>
          )}
        </div>

        {/* 출퇴근 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => handleAttendance('in')}
            disabled={loading || hasClockIn || !geo.isWithinRange || geo.loading}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              hasClockIn
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : geo.isWithinRange
                ? 'bg-blue-500 text-white active:scale-95 hover:bg-blue-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {hasClockIn ? `출근 ${formatTime(attendance?.clockIn ?? null)}` : '출근'}
          </button>
          <button
            onClick={() => handleAttendance('out')}
            disabled={loading || !hasClockIn || hasClockOut || !geo.isWithinRange || geo.loading}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              hasClockOut
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : hasClockIn && geo.isWithinRange
                ? 'bg-rose-500 text-white active:scale-95 hover:bg-rose-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {hasClockOut ? `퇴근 ${formatTime(attendance?.clockOut ?? null)}` : '퇴근'}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
        )}
      </div>

      {/* 근무 현황 카드 */}
      {hasClockIn && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">⏱ 오늘 근무</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">출근</p>
              <p className="text-base font-bold text-gray-800">{formatTime(attendance?.clockIn ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">퇴근</p>
              <p className="text-base font-bold text-gray-800">{formatTime(attendance?.clockOut ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">근무시간</p>
              <p className="text-base font-bold text-blue-600">
                {attendance?.workMinutes != null
                  ? formatWorkTime(attendance.workMinutes)
                  : hasClockIn && !hasClockOut
                  ? formatWorkTime(Math.floor((Date.now() - new Date(attendance!.clockIn!).getTime()) / 60000))
                  : '--'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 체크리스트 미리보기 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">✅ 오늘 체크리스트</p>
          <a href="/checklist" className="text-xs text-blue-500 font-medium">
            전체보기
          </a>
        </div>
        {checklist == null ? (
          <p className="text-xs text-gray-400 text-center py-2">로딩 중...</p>
        ) : checklist.total === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">오늘 체크리스트가 없습니다.</p>
        ) : (
          <>
            {/* 진행률 바 */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.round((checklist.completed / checklist.total) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {incomplete > 0 ? (
                  <span className="text-orange-500 font-medium">미완료 {incomplete}개</span>
                ) : (
                  <span className="text-green-600 font-medium">모두 완료!</span>
                )}
              </span>
              <span>{checklist.completed} / {checklist.total}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
