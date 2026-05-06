'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LocationPicker } from '@/components/owner/LocationPicker'

type RestaurantSetup = {
  hasAddress: boolean
  hasLocation: boolean
  fixedExpenseCount: number
  employeeCount: number
  supplierCount: number
}

type Restaurant = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  plan: string
  role: string
  isPrimary: boolean
  setup: RestaurantSetup
}

export default function RestaurantsPage() {
  const router = useRouter()
  const { update: updateSession } = useSession()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 인라인 이름 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  // 새 매장 추가 폼 (초기 설정 마법사)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newLat, setNewLat] = useState<number | null>(null)
  const [newLng, setNewLng] = useState<number | null>(null)
  const [includeLocation, setIncludeLocation] = useState(true)
  const [newGpsRadius, setNewGpsRadius] = useState<number>(200)
  const [newGpsEnforced, setNewGpsEnforced] = useState<boolean>(true)

  useEffect(() => {
    fetchAll()
  }, [])

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  async function fetchAll() {
    setLoading(true)
    try {
      const res = await fetch('/api/restaurants/me')
      if (res.ok) {
        const data = await res.json()
        setRestaurants(data.restaurants ?? [])
        setActiveId(data.activeRestaurantId)
      }
    } catch {
      showMsg('error', '매장 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function switchTo(id: string) {
    if (id === activeId) return
    setPending(true)
    try {
      const res = await fetch('/api/restaurants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '전환 실패')
      }
      setActiveId(id)
      await updateSession()
      router.refresh()
      showMsg('success', '매장을 전환했습니다.')
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : '전환 실패')
    } finally {
      setPending(false)
    }
  }

  function startEdit(r: Restaurant) {
    setEditingId(r.id)
    setNameDraft(r.name)
  }

  async function saveEdit(id: string) {
    const trimmed = nameDraft.trim()
    if (trimmed.length === 0 || trimmed.length > 60) {
      showMsg('error', '매장 이름은 1~60자 사이여야 합니다.')
      return
    }
    setPending(true)
    try {
      const res = await fetch(`/api/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '수정 실패')
      }
      setRestaurants((prev) =>
        prev.map((r) => (r.id === id ? { ...r, name: trimmed } : r))
      )
      setEditingId(null)
      await updateSession()
      router.refresh()
      showMsg('success', '매장 이름이 변경되었습니다.')
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : '수정 실패')
    } finally {
      setPending(false)
    }
  }

  async function createRestaurant() {
    if (!newName.trim()) {
      showMsg('error', '매장 이름을 입력해주세요.')
      return
    }
    if (newGpsRadius < 10 || newGpsRadius > 2000) {
      showMsg('error', '반경은 10m~2000m 사이여야 합니다.')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          address: newAddress.trim() || null,
          lat: includeLocation ? newLat : null,
          lng: includeLocation ? newLng : null,
          gpsRadius: newGpsRadius,
          gpsEnforced: newGpsEnforced,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '생성 실패')
      }
      const data = await res.json()
      // 폼 초기화
      setNewName('')
      setNewAddress('')
      setNewLat(null)
      setNewLng(null)
      setIncludeLocation(true)
      setNewGpsRadius(200)
      setNewGpsEnforced(true)
      setShowCreate(false)
      // 목록 갱신 + 활성 매장 전환된 상태
      await fetchAll()
      await updateSession()
      router.refresh()
      showMsg('success', `"${data.restaurant.name}" 매장이 생성되었습니다.`)
    } catch (e) {
      showMsg('error', e instanceof Error ? e.message : '생성 실패')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">🏪 매장 관리</h1>
        <span className="text-xs text-gray-500">총 {restaurants.length}개</span>
      </div>

      {message && (
        <div
          className={`rounded-xl px-3 py-2 text-xs text-center ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 매장 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
          <p className="text-3xl mb-2">🏪</p>
          <p className="text-sm">아직 매장이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {restaurants.map((r) => {
            const isActive = r.id === activeId
            const canEdit = r.role === 'OWNER'
            const isEditing = editingId === r.id
            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border-2 p-4 transition-colors ${
                  isActive ? 'border-orange-400 bg-orange-50/30' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          maxLength={60}
                          autoFocus
                          className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <button
                          onClick={() => saveEdit(r.id)}
                          disabled={pending}
                          className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-50"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          className="px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-gray-900 truncate">
                          {r.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                            활성
                          </span>
                        )}
                        {r.isPrimary && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            주
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            r.role === 'OWNER'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {r.role === 'OWNER' ? '사장' : '점장'}
                        </span>
                      </div>
                    )}
                    {!isEditing && r.address && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{r.address}</p>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    {!isActive && (
                      <button
                        onClick={() => switchTo(r.id)}
                        disabled={pending}
                        className="flex-1 text-xs py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50"
                      >
                        🔄 이 매장으로 전환
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => startEdit(r)}
                        disabled={pending}
                        className={`text-xs py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 disabled:opacity-50 ${
                          isActive ? 'flex-1' : 'flex-shrink-0 px-4'
                        }`}
                      >
                        ✎ 이름 변경
                      </button>
                    )}
                  </div>
                )}

                {/* 초기 설정 체크리스트 — 활성 매장에만 표시 */}
                {!isEditing && isActive && (
                  <SetupChecklist setup={r.setup} hasAddress={!!r.address} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 빠른 액세스 — 활성 매장 기존 페이지 */}
      {/* (체크리스트 안에 이미 링크 있어서 별도 노출 X) */}

      {/* 새 매장 추가 섹션 */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-4">
        {showCreate ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">+ 새 매장 추가</h2>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setNewName('')
                  setNewAddress('')
                  setNewLat(null)
                  setNewLng(null)
                  setIncludeLocation(false)
                }}
                disabled={pending}
                className="text-gray-400 text-xl leading-none w-7 h-7"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                매장 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 강남점"
                maxLength={60}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">주소 (선택)</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="서울시 강남구 ..."
                maxLength={120}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-location"
                checked={includeLocation}
                onChange={(e) => setIncludeLocation(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="include-location" className="text-xs text-gray-700">
                지금 매장 위치도 같이 등록 (GPS 출퇴근용)
              </label>
            </div>

            {includeLocation && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1.5">
                  지도 클릭 또는 "현재 위치 사용"으로 매장 위치를 지정하세요.
                </p>
                <LocationPicker
                  initialLat={null}
                  initialLng={null}
                  height="220px"
                  onChange={(lat, lng) => {
                    setNewLat(lat)
                    setNewLng(lng)
                  }}
                />
              </div>
            )}

            {/* GPS 반경 + 검증 우회 */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700">출퇴근 GPS 설정</p>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 font-medium whitespace-nowrap">허용 반경</label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  step={10}
                  value={newGpsRadius}
                  onChange={(e) => setNewGpsRadius(Number(e.target.value))}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                />
                <span className="text-xs text-gray-500">m</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1 mr-2">
                  <p className="text-xs font-medium text-gray-700">GPS 검증</p>
                  <p className="text-[10px] text-gray-500">
                    끄면 직원이 위치 무관하게 출퇴근 가능 (실내·오프라인 매장용)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewGpsEnforced((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    newGpsEnforced ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      newGpsEnforced ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={createRestaurant}
              disabled={pending || !newName.trim()}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-orange-600"
            >
              {pending ? '생성 중…' : '매장 생성하고 전환하기'}
            </button>
            <p className="text-[10px] text-gray-400 text-center">
              위치를 지금 안 정해도 생성 후 대시보드 매장 정보 카드에서 등록할 수 있어요.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-4 text-sm font-semibold text-gray-600 hover:text-orange-500"
          >
            ➕ 새 매장 추가하기
          </button>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
 * 활성 매장의 초기 설정 체크리스트
 * ────────────────────────────────────────────── */

function SetupChecklist({
  setup,
  hasAddress,
}: {
  setup: RestaurantSetup
  hasAddress: boolean
}) {
  const items = [
    {
      key: 'address',
      label: '주소 등록',
      done: hasAddress,
      doneText: '등록됨',
      todoText: '주소 입력',
      href: null, // 위쪽 인라인 편집으로 처리 — 안내만
      hint: '카드 위쪽에서 ✎ 이름 변경 옆 → 대시보드 매장 정보',
    },
    {
      key: 'location',
      label: '위치/GPS',
      done: setup.hasLocation,
      doneText: '설정됨',
      todoText: '위치 등록',
      href: '/dashboard',
      hint: '대시보드 매장 정보 카드',
    },
    {
      key: 'fixed',
      label: '고정비용',
      done: setup.fixedExpenseCount > 0,
      doneText: `${setup.fixedExpenseCount}건 등록됨`,
      todoText: '등록하기',
      href: '/finance/fixed',
    },
    {
      key: 'employee',
      label: '직원',
      done: setup.employeeCount > 0,
      doneText: `${setup.employeeCount}명 등록됨`,
      todoText: '등록하기',
      href: '/employees',
    },
    {
      key: 'supplier',
      label: '거래처',
      done: setup.supplierCount > 0,
      doneText: `${setup.supplierCount}개 등록됨`,
      todoText: '등록하기',
      href: '/suppliers',
    },
  ]

  const completed = items.filter((i) => i.done).length
  const total = items.length
  const percent = Math.round((completed / total) * 100)

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-700">📋 초기 설정 진행률</p>
        <span className="text-xs font-semibold text-orange-600">
          {completed}/{total} ({percent}%)
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2 text-xs"
          >
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              {item.done ? (
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
              )}
            </span>
            <span
              className={`font-medium ${item.done ? 'text-gray-500' : 'text-gray-800'}`}
            >
              {item.label}
            </span>
            <span className="flex-1 text-right">
              {item.done ? (
                <span className="text-[11px] text-emerald-600">{item.doneText}</span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 px-2 py-0.5 rounded bg-orange-50"
                >
                  {item.todoText} →
                </Link>
              ) : (
                <span className="text-[11px] text-gray-400">{item.hint}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
