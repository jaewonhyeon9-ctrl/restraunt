'use client'

import { useEffect, useMemo, useState } from 'react'

interface MenuItem {
  id: string
  name: string
  price: number
  category: string | null
  totalCost: number
  costRatio: number | null
}

interface SaleItemDraft {
  menuId: string
  qty: number
}

type SaleResult = {
  saleId: string
  saleDate: string
  totalAmount: number
  totalCost: number
  costRatio: number
  items: {
    menuName: string
    qty: number
    subtotal: number
    costAtSale: number
    costRatio: number
    exceededThreshold: number | null
  }[]
  alerts: {
    type: 'menu' | 'global'
    menuName?: string
    ratio: number
    threshold: number
  }[]
}

const ALL_CAT = '__all__'
const NO_CAT = '__none__'

function formatWon(n: number | null | undefined): string {
  if (n == null) return '-'
  return `${Math.round(n).toLocaleString()}원`
}

function ratioColor(ratio: number | null): string {
  if (ratio == null) return 'text-gray-400'
  if (ratio < 30) return 'text-emerald-600'
  if (ratio < 40) return 'text-yellow-600'
  return 'text-rose-600'
}

export function MenuSaleModal({
  menus,
  open,
  onClose,
  onRecorded,
}: {
  menus: MenuItem[]
  open: boolean
  onClose: () => void
  onRecorded: () => void
}) {
  const [drafts, setDrafts] = useState<SaleItemDraft[]>([])
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SaleResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CAT)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      // 닫힐 때 상태 초기화
      setDrafts([])
      setResult(null)
      setError(null)
      setSearch('')
      setActiveCategory(ALL_CAT)
    }
  }, [open])

  function getQty(menuId: string): number {
    return drafts.find((d) => d.menuId === menuId)?.qty ?? 0
  }

  function setQty(menuId: string, qty: number) {
    setDrafts((prev) => {
      const without = prev.filter((d) => d.menuId !== menuId)
      if (qty <= 0) return without
      return [...without, { menuId, qty }]
    })
  }

  // 카테고리 목록 추출
  const categories = useMemo(() => {
    const set = new Set<string>()
    let hasNone = false
    for (const m of menus) {
      if (m.category) set.add(m.category)
      else hasNone = true
    }
    const list = Array.from(set).sort()
    return { list, hasNone }
  }, [menus])

  // 사전 계산 (서버 호출 없이도 미리보기)
  const preview = useMemo(() => {
    let totalAmount = 0
    let totalCost = 0
    for (const d of drafts) {
      const m = menus.find((mm) => mm.id === d.menuId)
      if (!m) continue
      totalAmount += m.price * d.qty
      totalCost += m.totalCost * d.qty
    }
    const ratio = totalAmount > 0 ? (totalCost / totalAmount) * 100 : null
    return { totalAmount, totalCost, ratio, count: drafts.length }
  }, [drafts, menus])

  // 필터링된 메뉴
  const filteredMenus = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menus.filter((m) => {
      if (activeCategory === NO_CAT) {
        if (m.category) return false
      } else if (activeCategory !== ALL_CAT) {
        if (m.category !== activeCategory) return false
      }
      if (q && !m.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [menus, activeCategory, search])

  async function submit() {
    if (drafts.length === 0) {
      setError('1개 이상 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/sales/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleDate,
          items: drafts.map((d) => ({ menuId: d.menuId, qty: d.qty })),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '등록 실패')
      }
      const data: SaleResult = await res.json()
      setResult(data)
      onRecorded()
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  // 결과 화면
  if (result) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
        <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90dvh]">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-base font-bold text-emerald-600">✓ 매출 등록 완료</h3>
            <button
              onClick={onClose}
              className="text-gray-400 text-2xl leading-none w-8 h-8"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-600">매출 합계</span>
                <span className="text-base font-bold text-gray-800">
                  {formatWon(result.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-600">원가 (스냅샷)</span>
                <span className="text-base font-semibold text-gray-700">
                  {formatWon(result.totalCost)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-emerald-200">
                <span className="text-sm font-semibold">원가율</span>
                <span className={`text-base font-bold ${ratioColor(result.costRatio)}`}>
                  {result.costRatio.toFixed(1)}%
                </span>
              </div>
            </div>

            {result.alerts.length > 0 && (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-3">
                <p className="text-xs font-bold text-rose-700 mb-1.5">⚠ 임계 원가율 초과</p>
                <ul className="space-y-1">
                  {result.alerts.map((a, i) => (
                    <li key={i} className="text-xs text-rose-700">
                      {a.type === 'menu' ? `${a.menuName}: ` : '식당 전체: '}
                      <span className="font-bold">{a.ratio.toFixed(1)}%</span>
                      <span className="text-rose-500"> (임계 {a.threshold}%)</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-rose-600 mt-1.5">
                  사장님께 푸시 알림이 발송되었습니다.
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">항목별 결과</p>
              <ul className="space-y-2">
                {result.items.map((it, i) => (
                  <li
                    key={i}
                    className="bg-white rounded-xl p-3 border border-gray-100"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {it.menuName} × {it.qty}
                      </span>
                      <span className="text-sm font-semibold">{formatWon(it.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">
                        원가 {formatWon(it.costAtSale)} (스냅샷)
                      </span>
                      <span className={`font-bold ${ratioColor(it.costRatio)}`}>
                        {it.costRatio.toFixed(1)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <p className="text-[11px] font-bold text-blue-700 mb-1">📦 자동 차감</p>
              <p className="text-[11px] text-blue-700">
                각 메뉴의 레시피에 따라 재고가 단일 트랜잭션으로 차감되었습니다.
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2">
            <button
              onClick={() => {
                setResult(null)
                setDrafts([])
                setError(null)
                setSearch('')
              }}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium"
            >
              + 또 등록하기
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 입력 화면
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90dvh]">
        {/* 헤더 (sticky) */}
        <div className="flex-shrink-0 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h3 className="text-base font-bold text-gray-900">💰 메뉴 판매 기록</h3>
            <button
              onClick={onClose}
              className="text-gray-400 text-2xl leading-none w-8 h-8"
            >
              ×
            </button>
          </div>

          {/* 날짜 + 검색 */}
          <div className="px-5 pb-2 flex gap-2">
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="메뉴 검색..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          {/* 카테고리 탭 */}
          <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(ALL_CAT)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                activeCategory === ALL_CAT
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              전체 ({menus.length})
            </button>
            {categories.list.map((c) => {
              const count = menus.filter((m) => m.category === c).length
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                    activeCategory === c
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {c} ({count})
                </button>
              )
            })}
            {categories.hasNone && (
              <button
                onClick={() => setActiveCategory(NO_CAT)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                  activeCategory === NO_CAT
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                미분류
              </button>
            )}
          </div>

          {/* 실시간 미리보기 */}
          <div className="mx-5 mb-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-3 border border-orange-200">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-500">선택</p>
                <p className="text-sm font-bold">{preview.count}건</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">매출</p>
                <p className="text-sm font-bold text-gray-800">
                  {formatWon(preview.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">예상 원가율</p>
                <p className={`text-sm font-bold ${ratioColor(preview.ratio)}`}>
                  {preview.ratio != null ? `${preview.ratio.toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 메뉴 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          {filteredMenus.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {search ? '검색 결과 없음' : '카테고리에 메뉴가 없습니다.'}
            </div>
          ) : (
            filteredMenus.map((m) => {
              const qty = getQty(m.id)
              const recipeReady = m.totalCost > 0
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl p-3 border-2 ${
                    qty > 0
                      ? 'bg-orange-50 border-orange-400'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 truncate">{m.name}</p>
                        {!recipeReady && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            레시피 미등록
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {formatWon(m.price)}{' '}
                        {recipeReady && (
                          <span className={ratioColor(m.costRatio)}>
                            · {m.costRatio != null ? `${m.costRatio.toFixed(0)}%` : '-'}
                          </span>
                        )}
                      </p>
                    </div>
                    {qty > 0 && (
                      <div className="text-right ml-2">
                        <p className="text-[10px] text-gray-500">소계</p>
                        <p className="text-sm font-bold text-orange-600">
                          {formatWon(m.price * qty)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 큰 +/- 버튼 (모바일 친화) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQty(m.id, Math.max(0, qty - 1))}
                      disabled={qty === 0}
                      className="w-12 h-12 rounded-xl bg-gray-100 disabled:opacity-30 text-2xl font-bold active:scale-95"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center">
                      <p className={`text-3xl font-black tabular-nums ${qty > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                        {qty}
                      </p>
                    </div>
                    <button
                      onClick={() => setQty(m.id, qty + 1)}
                      className="w-12 h-12 rounded-xl bg-orange-500 text-white text-2xl font-bold active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            onClick={submit}
            disabled={submitting || drafts.length === 0}
            className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-40 active:scale-95"
          >
            {submitting
              ? '등록 중...'
              : drafts.length === 0
              ? '메뉴를 선택하세요'
              : `매출 ${formatWon(preview.totalAmount)} 등록`}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            등록 시 레시피 기반 다중 재고가 자동 차감되며, 판매 시점 단가가 보존됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}