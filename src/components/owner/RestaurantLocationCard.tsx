'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface RestaurantInfo {
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  gpsRadius: number
  gpsEnforced: boolean
}

export default function RestaurantLocationCard() {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [info, setInfo] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [radiusInput, setRadiusInput] = useState<number>(50)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/restaurant')
        if (res.ok) {
          const data: RestaurantInfo = await res.json()
          setInfo(data)
          setRadiusInput(data.gpsRadius ?? 50)
          setNameInput(data.name ?? '')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [])

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (trimmed.length === 0 || trimmed.length > 60) {
      showMessage('error', '매장 이름은 1~60자 사이여야 합니다.')
      return
    }
    if (trimmed === info?.name) {
      setEditingName(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/restaurant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error ?? '저장 실패')
      } else {
        setInfo(data)
        setNameInput(data.name ?? '')
        setEditingName(false)
        showMessage('success', '매장 이름이 저장되었습니다.')
        await updateSession()
        router.refresh()
      }
    } catch {
      showMessage('error', '네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRestaurant = async () => {
    const trimmed = createName.trim()
    if (trimmed.length === 0) {
      showMessage('error', '새 매장 이름을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error ?? '생성 실패')
      } else {
        showMessage('success', `"${data.restaurant.name}" 매장으로 전환되었습니다.`)
        setCreateName('')
        setShowCreate(false)
        await updateSession()
        router.refresh()
      }
    } catch {
      showMessage('error', '네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

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
    if (radiusInput < 10 || radiusInput > 2000) {
      showMessage('error', '반경은 10m~2000m 사이여야 합니다.')
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
        <h2 className="text-sm font-semibold text-slate-200">🏪 매장 정보</h2>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${
            hasLocation
              ? 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30'
              : 'text-amber-300 bg-amber-500/10 ring-amber-400/30'
          }`}
        >
          {hasLocation ? '위치 설정됨' : '위치 미설정'}
        </span>
      </div>

      {/* 매장 이름 (편집 가능) */}
      <div className="mb-3 rounded-xl bg-white/5 ring-1 ring-white/5 px-3 py-2.5">
        <p className="text-[10px] text-slate-500 mb-1">매장 이름</p>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={60}
              autoFocus
              className="input-field !py-1.5 !text-sm flex-1"
            />
            <button
              onClick={handleSaveName}
              disabled={saving}
              className="btn-ghost !px-3 !py-1.5 !text-xs disabled:opacity-40"
            >
              저장
            </button>
            <button
              onClick={() => {
                setEditingName(false)
                setNameInput(info?.name ?? '')
              }}
              disabled={saving}
              className="btn-ghost !px-2 !py-1.5 !text-xs"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100 truncate">{info?.name ?? '-'}</p>
            <button
              onClick={() => setEditingName(true)}
              className="text-[11px] text-blue-300 hover:text-blue-200 px-2 py-0.5 rounded-full bg-blue-500/10"
            >
              ✎ 변경
            </button>
          </div>
        )}
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
          max={2000}
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

      {/* GPS 검증 우회 토글 */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex-1 mr-2">
          <p className="text-xs font-medium text-slate-300">GPS 검증</p>
          <p className="text-[10px] text-slate-500">
            끄면 직원이 위치 무관하게 출퇴근 가능 (실내/오프라인 매장용)
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setSaving(true)
            try {
              const res = await fetch('/api/restaurant', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gpsEnforced: !info?.gpsEnforced }),
              })
              const data = await res.json()
              if (res.ok) {
                setInfo(data)
                showMessage('success', `GPS 검증 ${data.gpsEnforced ? '켜짐' : '꺼짐'}`)
              } else {
                showMessage('error', data.error ?? '저장 실패')
              }
            } finally {
              setSaving(false)
            }
          }}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            info?.gpsEnforced === false ? 'bg-slate-600' : 'bg-emerald-500'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              info?.gpsEnforced === false ? '' : 'translate-x-5'
            }`}
          />
        </button>
      </div>

      {/* 새 매장 추가 (다점포) */}
      <div className="mt-3 pt-3 border-t border-white/5">
        {showCreate ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-300">새 매장 추가</p>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="새 매장 이름 (예: 강남점)"
              maxLength={60}
              autoFocus
              className="input-field !py-2 !text-sm w-full"
            />
            <p className="text-[10px] text-slate-500">
              생성 후 이 카드에서 "현재 위치로 설정"을 눌러 위치를 등록하세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreate(false)
                  setCreateName('')
                }}
                disabled={saving}
                className="btn-ghost flex-1 !py-2 !text-xs"
              >
                취소
              </button>
              <button
                onClick={handleCreateRestaurant}
                disabled={saving || createName.trim().length === 0}
                className="btn-primary flex-1 !py-2 !text-xs disabled:opacity-40"
              >
                {saving ? '생성 중…' : '생성하고 전환'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-xl border-2 border-dashed border-white/10 py-2.5 text-xs font-medium text-slate-400 hover:border-emerald-400/40 hover:text-emerald-300 transition-colors"
          >
            ➕ 새 매장 추가 (다점포)
          </button>
        )}
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
