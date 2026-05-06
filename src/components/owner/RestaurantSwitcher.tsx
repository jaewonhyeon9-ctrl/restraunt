'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
      await update()
      router.refresh()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '전환 실패')
    } finally {
      setPending(false)
    }
  }

  const active = restaurants.find((r) => r.id === activeId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/15 shadow-sm"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="max-w-[140px] truncate">{active?.name ?? '매장 선택'}</span>
        {restaurants.length > 1 && (
          <span className="text-[9px] font-bold px-1 rounded bg-emerald-400/30 text-emerald-200 leading-tight">
            {restaurants.length}
          </span>
        )}
        <svg className="w-4 h-4 flex-shrink-0 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex sm:items-end items-stretch justify-center bg-black/40"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white sm:rounded-t-3xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90dvh] overscroll-contain"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">매장 전환</h3>
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
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

              {error && (
                <p className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-700">
                  {error}
                </p>
              )}
            </div>

            {/* Footer — 매장 관리 탭으로 이동 */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white pb-[calc(env(safe-area-inset-bottom)+12px)]">
              <Link
                href="/restaurants"
                onClick={() => setOpen(false)}
                className="block w-full text-center rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-500"
              >
                🏪 매장 관리 / 새 매장 추가
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
