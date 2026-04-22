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
      <section className="glass-card p-4">
        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
      </section>
    )
  }

  const hasLocation = info?.lat != null && info?.lng != null

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">📍 식당 위치</h2>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
            hasLocation
              ? 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30'
              : 'text-amber-300 bg-amber-500/10 ring-amber-400/30'
          }`}
        >
          {hasLocation ? '설정됨' : '미설정'}
        </span>
      </div>

      <div className="rounded-xl bg-white/5 ring-1 ring-white/5 px-3 py-2.5 mb-3 text-xs">
        {hasLocation ? (
          <p className="text-slate-300 font-mono">
            {info!.lat!.toFixed(6)}, {info!.lng!.toFixed(6)}
          </p>
        ) : (
          <p className="text-slate-500">
            위치가 설정되지 않아 직원 출퇴근 확인이 불가합니다.
          </p>
        )}
      </div>

      <button
        onClick={handleSetCurrentLocation}
        disabled={saving}
        className="btn-primary w-full mb-3"
      >
        {saving ? '저장 중...' : '📡 현재 위치로 설정'}
      </button>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
          허용 반경
        </label>
        <input
          type="number"
          min={10}
          max={500}
          step={10}
          value={radiusInput}
          onChange={(e) => setRadiusInput(Number(e.target.value))}
          className="input-field !py-2 !text-sm flex-1"
        />
        <span className="text-xs text-slate-500">m</span>
        <button
          onClick={handleSaveRadius}
          disabled={saving || radiusInput === info?.gpsRadius}
          className="btn-ghost !px-3 !py-2 !text-xs disabled:opacity-40"
        >
          저장
        </button>
      </div>

      {message && (
        <p
          className={`mt-2 text-xs text-center ${
            message.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
