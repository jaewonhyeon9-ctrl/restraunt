'use client'

import { useEffect, useState } from 'react'

interface RestaurantInfo {
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  gpsRadius: number
}

export default function RestaurantLocationCard() {
  const [info, setInfo] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [radiusInput, setRadiusInput] = useState<number>(50)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/restaurant')
        if (res.ok) {
          const data: RestaurantInfo = await res.json()
          setInfo(data)
          setRadiusInput(data.gpsRadius ?? 50)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSetCurrentLocation = () => {
    if (!navigator.geolocation) {
      showMessage('error', 'GPS를 지원하지 않는 기기입니다.')
      return
    }

    setSaving(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch('/api/restaurant', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          })
          const data = await res.json()
          if (!res.ok) {
            showMessage('error', data.error ?? '저장에 실패했습니다.')
          } else {
            setInfo(data)
            showMessage('success', '식당 위치가 저장되었습니다.')
          }
        } catch {
          showMessage('error', '네트워크 오류가 발생했습니다.')
        } finally {
          setSaving(false)
        }
      },
      (err) => {
        showMessage('error', err.code === 1 ? 'GPS 권한을 허용해주세요.' : 'GPS 오류가 발생했습니다.')
        setSaving(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSaveRadius = async () => {
    if (radiusInput < 10 || radiusInput > 500) {
      showMessage('error', '반경은 10m~500m 사이여야 합니다.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpsRadius: radiusInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error ?? '저장에 실패했습니다.')
      } else {
        setInfo(data)
        showMessage('success', '반경이 저장되었습니다.')
      }
    } catch {
      showMessage('error', '네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      </section>
    )
  }

  const hasLocation = info?.lat != null && info?.lng != null

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">📍 식당 위치</h2>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            hasLocation ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {hasLocation ? '설정됨' : '미설정'}
        </span>
      </div>

      {/* 현재 좌표 */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3 text-xs">
        {hasLocation ? (
          <p className="text-gray-600 font-mono">
            {info!.lat!.toFixed(6)}, {info!.lng!.toFixed(6)}
          </p>
        ) : (
          <p className="text-gray-400">위치가 설정되지 않아 직원 출퇴근 확인이 불가합니다.</p>
        )}
      </div>

      {/* 현재 위치로 설정 */}
      <button
        onClick={handleSetCurrentLocation}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-sm bg-blue-500 text-white active:scale-[0.98] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-3"
      >
        {saving ? '저장 중...' : '📡 현재 위치로 설정'}
      </button>

      {/* 반경 설정 */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 font-medium whitespace-nowrap">허용 반경</label>
        <input
          type="number"
          min={10}
          max={500}
          step={10}
          value={radiusInput}
          onChange={(e) => setRadiusInput(Number(e.target.value))}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
        <span className="text-xs text-gray-500">m</span>
        <button
          onClick={handleSaveRadius}
          disabled={saving || radiusInput === info?.gpsRadius}
          className="px-3 py-2 text-xs font-bold bg-gray-100 text-gray-700 rounded-lg active:scale-95 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          저장
        </button>
      </div>

      {message && (
        <p
          className={`mt-2 text-xs text-center ${
            message.type === 'success' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
