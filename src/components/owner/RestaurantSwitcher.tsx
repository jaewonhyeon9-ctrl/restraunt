'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type Restaurant = {
  id: string
  name: string
  address: string | null
  plan: string
  role: string
  isPrimary: boolean
}

export function RestaurantSwitcher() {
  const router = useRouter()
  const { update } = useSession()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const res = await fetch('/api/restaurants/me')
      if (!res.ok) return
      const data = await res.json()
      setRestaurants(data.restaurants ?? [])
      setActiveId(data.activeRestaurantId)
    } catch {
      // ignore
    }
  }

  async function switchTo(id: string) {
    if (id === activeId) {
      setOpen(false)
      return
    }
    setPending(true)
    setError(null)
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
      // 세션 갱신
      await update()
      // 페이지 데이터 다시 로드
      router.refresh()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '전환 실패')
    } finally {
      setPending(false)
    }
  }

  async function createRestaurant() {
    if (!newName.trim()) {
      setError('매장 이름을 입력해주세요')
      return
    }
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), address: newAddress.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '생성 실패')
      }
      const data = await res.json()
      setActiveId(data.restaurant.id)
      await fetchAll()
      await update()
      setNewName('')
      setNewAddress('')
      setCreating(false)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setPending(false)
    }
  }

  const active = restaurants.find((r) => r.id === activeId)

  if (restaurants.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="max-w-[110px] truncate">{active?.name ?? '매장 선택'}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl p-5 space-y-3 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+16px)] overscroll-contain"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">매장 선택</h3>
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-1.5">
              {restaurants.map((r) => {
                const isActive = r.id === activeId
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => switchTo(r.id)}
                      disabled={pending}
                      className={
                        'w-full text-left rounded-xl px-3.5 py-3 transition-colors flex items-center gap-3 ' +
                        (isActive
                          ? 'bg-orange-50 border-2 border-orange-400'
                          : 'bg-gray-50 border-2 border-transparent hover:border-gray-200')
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {r.name}
                          {r.isPrimary && (
                            <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              주
                            </span>
                          )}
                        </p>
                        {r.address && (
                          <p className="text-[11px] text-gray-500 truncate">{r.address}</p>
                        )}
                      </div>
                      <span
                        className={
                          'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ' +
                          (r.role === 'OWNER'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-700')
                        }
                      >
                        {r.role === 'OWNER' ? '사장' : '매니저'}
                      </span>
                      {isActive && (
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                disabled={pending}
                className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500"
              >
                + 새 매장 추가
              </button>
            ) : (
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-700">새 매장 추가</p>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="매장 이름 *"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                />
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="주소 (선택)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setNewName('')
                      setNewAddress('')
                      setError(null)
                    }}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-xs text-gray-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={createRestaurant}
                    disabled={pending || !newName.trim()}
                    className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? '생성 중…' : '생성'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
