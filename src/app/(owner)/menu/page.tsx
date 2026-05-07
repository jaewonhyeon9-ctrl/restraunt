'use client'

import { useEffect, useMemo, useState } from 'react'
import { MenuSaleModal } from '@/components/owner/MenuSaleModal'

interface MenuListItem {
  id: string
  name: string
  price: number
  category: string | null
  isActive: boolean
  costRatioThreshold: number | null
  recipeCount: number
  totalCost: number
  costRatio: number | null
  missingPriceCount: number
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  unitPrice: number | null
  packageWeightG: number | null
}

interface RecipeRow {
  inventoryItemId: string
  qtyUsed: number
  itemName: string
  itemUnit: string
  itemUnitPrice: number | null
}

function formatWon(n: number | null): string {
  if (n == null) return '-'
  return `${Math.round(n).toLocaleString()}원`
}

function ratioColor(ratio: number | null): string {
  if (ratio == null) return 'text-gray-400'
  if (ratio < 30) return 'text-emerald-600'
  if (ratio < 40) return 'text-yellow-600'
  return 'text-rose-600'
}

export default function MenuPage() {
  const [menus, setMenus] = useState<MenuListItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', price: '', category: '' })
  const [editTarget, setEditTarget] = useState<MenuListItem | null>(null)
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([])
  const [addRecipeOpen, setAddRecipeOpen] = useState(false)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [thresholdInput, setThresholdInput] = useState<string>('')
  const [actualAnalysis, setActualAnalysis] = useState<{
    overall: { revenue: number; cost: number; costRatio: number | null; itemCount: number }
    byMenu: Array<{ menuId: string; menuName: string; revenue: number; cost: number; costRatio: number | null; qty: number }>
  } | null>(null)

  function flash(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [menusRes, invRes, analysisRes] = await Promise.all([
        fetch('/api/menus'),
        fetch('/api/inventory'),
        fetch('/api/sales/cost-analysis'),
      ])
      if (menusRes.ok) setMenus(await menusRes.json())
      if (invRes.ok) setInventory(await invRes.json())
      if (analysisRes.ok) {
        const data = await analysisRes.json()
        setActualAnalysis({ overall: data.overall, byMenu: data.byMenu })
      }
    } catch {
      flash('error', '메뉴를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function createMenu(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          price: Number(addForm.price),
          category: addForm.category || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '생성 실패')
      }
      setShowAdd(false)
      setAddForm({ name: '', price: '', category: '' })
      flash('success', '메뉴가 추가되었습니다.')
      fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function openEditMenu(menu: MenuListItem) {
    setEditTarget(menu)
    setThresholdInput(menu.costRatioThreshold != null ? String(menu.costRatioThreshold) : '')
    try {
      const res = await fetch(`/api/menus/${menu.id}`)
      if (!res.ok) {
        flash('error', '레시피를 불러오지 못했습니다.')
        return
      }
      const data = await res.json()
      setRecipeRows(
        (data.recipes as Array<{
          inventoryItemId: string
          qtyUsed: number
          item: { name: string; unit: string; unitPrice: number | null }
        }>).map((r) => ({
          inventoryItemId: r.inventoryItemId,
          qtyUsed: r.qtyUsed,
          itemName: r.item.name,
          itemUnit: r.item.unit,
          itemUnitPrice: r.item.unitPrice,
        })),
      )
    } catch {
      flash('error', '레시피 조회 실패')
    }
  }

  async function saveThreshold() {
    if (!editTarget) return
    const trimmed = thresholdInput.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      flash('error', '임계값은 0~100 사이여야 합니다.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/menus/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costRatioThreshold: value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '저장 실패')
      }
      flash('success', value == null ? '임계값 비활성화' : `임계값 ${value}% 저장됨`)
      fetchAll()
    } catch (e) {
      flash('error', e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  function closeEdit() {
    setEditTarget(null)
    setRecipeRows([])
    setAddRecipeOpen(false)
    setRecipeSearch('')
    setThresholdInput('')
  }

  function addRecipeRow(item: InventoryItem) {
    if (recipeRows.some((r) => r.inventoryItemId === item.id)) {
      flash('error', '이미 추가된 재료입니다.')
      return
    }
    setRecipeRows((prev) => [
      ...prev,
      {
        inventoryItemId: item.id,
        qtyUsed: 1,
        itemName: item.name,
        itemUnit: item.unit,
        itemUnitPrice: item.unitPrice,
      },
    ])
    setAddRecipeOpen(false)
    setRecipeSearch('')
  }

  function updateQty(id: string, qty: number) {
    setRecipeRows((prev) =>
      prev.map((r) => (r.inventoryItemId === id ? { ...r, qtyUsed: qty } : r)),
    )
  }

  function removeRow(id: string) {
    setRecipeRows((prev) => prev.filter((r) => r.inventoryItemId !== id))
  }

  async function saveRecipe() {
    if (!editTarget) return
    for (const r of recipeRows) {
      if (!Number.isFinite(r.qtyUsed) || r.qtyUsed <= 0) {
        flash('error', `${r.itemName} 수량을 0보다 크게 입력하세요.`)
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/menus/${editTarget.id}/recipe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipes: recipeRows.map((r) => ({
            inventoryItemId: r.inventoryItemId,
            qtyUsed: r.qtyUsed,
          })),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '저장 실패')
      }
      flash('success', '레시피 저장됨')
      closeEdit()
      fetchAll()
    } catch (err) {
      flash('error', err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteMenu(menu: MenuListItem) {
    if (!confirm(`"${menu.name}"을(를) 비활성화할까요?`)) return
    try {
      const res = await fetch(`/api/menus/${menu.id}`, { method: 'DELETE' })
      if (!res.ok) {
        flash('error', '삭제 실패')
        return
      }
      flash('success', '삭제되었습니다.')
      closeEdit()
      fetchAll()
    } catch {
      flash('error', '삭제 실패')
    }
  }

  // 합산
  const summary = useMemo(() => {
    const total = menus.length
    const withRecipe = menus.filter((m) => m.recipeCount > 0).length
    const ratios = menus
      .filter((m) => m.costRatio != null)
      .map((m) => m.costRatio as number)
    const avg =
      ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null
    return { total, withRecipe, avgRatio: avg }
  }, [menus])

  // 검색 필터
  const filteredInventory = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase()
    if (!q) return inventory
    return inventory.filter((i) => i.name.toLowerCase().includes(q))
  }, [inventory, recipeSearch])

  // 편집 중 실시간 원가율
  const editingCost = useMemo(() => {
    if (!editTarget) return null
    let total = 0
    let missing = 0
    for (const r of recipeRows) {
      if (r.itemUnitPrice == null) {
        missing++
        continue
      }
      total += r.qtyUsed * r.itemUnitPrice
    }
    const ratio = editTarget.price > 0 ? (total / editTarget.price) * 100 : null
    return { total, ratio, missing }
  }, [recipeRows, editTarget])

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">🍽️ 메뉴 / 원가</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaleModal(true)}
            disabled={menus.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold disabled:opacity-40"
          >
            💰 판매
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold"
          >
            + 메뉴
          </button>
        </div>
      </div>

      {showSaleModal && (
        <MenuSaleModal
          menus={menus.map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            category: m.category,
            totalCost: m.totalCost,
            costRatio: m.costRatio,
          }))}
          open={showSaleModal}
          onClose={() => setShowSaleModal(false)}
          onRecorded={fetchAll}
        />
      )}

      {msg && (
        <div
          className={`rounded-xl px-3 py-2 text-xs text-center ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 요약 */}
      {!loading && menus.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className="text-xl font-bold text-gray-800">{summary.total}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">전체 메뉴</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-blue-100 text-center">
            <p className="text-xl font-bold text-blue-600">{summary.withRecipe}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">레시피 등록</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-orange-100 text-center">
            <p
              className={`text-xl font-bold ${
                summary.avgRatio != null ? ratioColor(summary.avgRatio) : 'text-gray-400'
              }`}
            >
              {summary.avgRatio != null ? `${summary.avgRatio.toFixed(0)}%` : '-'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">평균 원가율 (이론)</p>
          </div>
        </div>
      )}

      {/* 스냅샷 기반 실제 원가율 (특허 청구 #9 핵심 효과) */}
      {!loading && actualAnalysis && actualAnalysis.overall.itemCount > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-4 border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-emerald-700">
              📊 이번 달 실제 원가율 (판매 시점 스냅샷 기반)
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {actualAnalysis.overall.itemCount}건
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-2.5 text-center">
              <p className="text-xs font-bold text-gray-800">
                {formatWon(actualAnalysis.overall.revenue)}
              </p>
              <p className="text-[10px] text-gray-500">매출</p>
            </div>
            <div className="bg-white rounded-xl p-2.5 text-center">
              <p className="text-xs font-bold text-gray-700">
                {formatWon(actualAnalysis.overall.cost)}
              </p>
              <p className="text-[10px] text-gray-500">원가</p>
            </div>
            <div className="bg-white rounded-xl p-2.5 text-center">
              <p
                className={`text-base font-bold ${ratioColor(actualAnalysis.overall.costRatio)}`}
              >
                {actualAnalysis.overall.costRatio != null
                  ? `${actualAnalysis.overall.costRatio.toFixed(1)}%`
                  : '-'}
              </p>
              <p className="text-[10px] text-gray-500">실제 원가율</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 leading-snug">
            💡 식자재 단가가 변경돼도 과거 매출의 원가는 판매 시점 단가로 보존됩니다. 이론 원가율(현재 단가)과 실제 원가율(스냅샷)의 차이를 비교해보세요.
          </p>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : menus.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🍽️</p>
          <p className="text-sm">등록된 메뉴가 없습니다.</p>
          <p className="text-[11px] text-gray-400 mt-1">
            메뉴를 등록하면 재료별 원가율이 자동 계산됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {menus.map((m) => (
            <div
              key={m.id}
              onClick={() => openEditMenu(m)}
              className="bg-white rounded-2xl border border-gray-100 p-3 cursor-pointer hover:border-orange-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{m.name}</p>
                    {m.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {m.category}
                      </span>
                    )}
                    {m.recipeCount === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        레시피 미등록
                      </span>
                    )}
                    {m.costRatioThreshold != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        ⚠ 임계 {m.costRatioThreshold}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    재료 {m.recipeCount}개
                    {m.missingPriceCount > 0 && (
                      <span className="text-amber-600 ml-1">
                        (단가 누락 {m.missingPriceCount})
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{formatWon(m.price)}</p>
                </div>
              </div>

              {m.recipeCount > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-500">현재 원가 (이론)</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {formatWon(m.totalCost)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">현재 원가율 (이론)</p>
                    <p className={`text-sm font-bold ${ratioColor(m.costRatio)}`}>
                      {m.costRatio != null ? `${m.costRatio.toFixed(1)}%` : '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* 실제 판매 데이터 기반 원가율 (스냅샷) */}
              {(() => {
                const actual = actualAnalysis?.byMenu.find((b) => b.menuId === m.id)
                if (!actual || actual.qty === 0) return null
                const diff =
                  actual.costRatio != null && m.costRatio != null
                    ? actual.costRatio - m.costRatio
                    : null
                return (
                  <div className="mt-2 pt-2 border-t border-emerald-100 bg-emerald-50/50 -mx-3 -mb-3 px-3 pb-3 rounded-b-2xl">
                    <p className="text-[10px] font-semibold text-emerald-700 mb-1">
                      📊 이번 달 실제 (판매 {actual.qty}건)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-500">실 매출</p>
                        <p className="text-xs font-semibold text-gray-700">
                          {formatWon(actual.revenue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">실 원가율 (스냅샷)</p>
                        <p className={`text-xs font-bold ${ratioColor(actual.costRatio)}`}>
                          {actual.costRatio != null ? `${actual.costRatio.toFixed(1)}%` : '-'}
                          {diff != null && Math.abs(diff) >= 0.1 && (
                            <span className="ml-1 text-[10px] text-gray-500">
                              ({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {/* 메뉴 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 shadow-2xl pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">메뉴 추가</h2>
              <button
                onClick={() => {
                  setShowAdd(false)
                  setError('')
                }}
                className="text-gray-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={createMenu} className="space-y-3">
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="메뉴 이름 (예: 김치찌개)"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              <input
                type="number"
                min="0"
                value={addForm.price}
                onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                placeholder="판매가 (원)"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={addForm.category}
                onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                placeholder="카테고리 (선택, 예: 메인/사이드/음료)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50"
              >
                {submitting ? '저장 중...' : '추가'}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                추가 후 카드를 탭해서 레시피(재료)를 등록하세요.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* 레시피 편집 모달 */}
      {editTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90dvh]">
            {/* Sticky header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-gray-900 truncate">
                  {editTarget.name}
                </h3>
                <p className="text-xs text-gray-500">
                  판매가 {formatWon(editTarget.price)}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="text-gray-400 text-2xl leading-none w-8 h-8"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {recipeRows.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  아직 등록된 재료가 없습니다.
                </div>
              ) : (
                <ul className="space-y-2">
                  {recipeRows.map((r) => {
                    const cost =
                      r.itemUnitPrice != null ? r.qtyUsed * r.itemUnitPrice : null
                    return (
                      <li
                        key={r.inventoryItemId}
                        className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {r.itemName}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              단가 {formatWon(r.itemUnitPrice)} / {r.itemUnit}
                            </p>
                          </div>
                          <button
                            onClick={() => removeRow(r.inventoryItemId)}
                            className="text-rose-400 hover:text-rose-600 text-xs px-2"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.qtyUsed}
                            onChange={(e) =>
                              updateQty(r.inventoryItemId, Number(e.target.value))
                            }
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
                          />
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {r.itemUnit} × 1메뉴
                          </span>
                          {cost != null && (
                            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                              = {formatWon(cost)}
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* 재료 추가 */}
              {addRecipeOpen ? (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <input
                    type="text"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                    placeholder="재료 검색..."
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white mb-2"
                  />
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredInventory.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">
                        검색 결과 없음
                      </p>
                    ) : (
                      filteredInventory.map((i) => (
                        <button
                          key={i.id}
                          onClick={() => addRecipeRow(i)}
                          className="w-full text-left px-2 py-1.5 rounded-lg bg-white hover:bg-blue-100 text-xs flex items-center justify-between"
                        >
                          <span className="font-medium text-gray-800 truncate">{i.name}</span>
                          <span className="text-gray-400">
                            {i.unitPrice != null ? formatWon(i.unitPrice) : '단가 없음'}/{i.unit}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setAddRecipeOpen(false)
                      setRecipeSearch('')
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg text-xs text-gray-600 bg-white"
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddRecipeOpen(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 hover:border-orange-300"
                >
                  ➕ 재료 추가
                </button>
              )}

              {/* 실시간 원가 */}
              {/* 임계 원가율 설정 */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700">⚠ 임계 원가율</p>
                  <p className="text-[10px] text-blue-600">초과 시 사장에게 푸시</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    placeholder="예: 35 (비활성)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-blue-200 text-sm bg-white"
                  />
                  <span className="text-xs text-gray-600">%</span>
                  <button
                    onClick={saveThreshold}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
                <p className="text-[10px] text-blue-600">
                  비워두면 임계값 비활성. 매뉴 판매 시 원가율이 임계값을 넘으면 사장님께 푸시 알림이 발송됩니다.
                </p>
              </div>

              {editingCost && recipeRows.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-200 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">총 원가</span>
                    <span className="font-bold text-gray-800">
                      {formatWon(editingCost.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">판매가</span>
                    <span className="font-medium text-gray-700">
                      {formatWon(editTarget.price)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-orange-200">
                    <span className="font-semibold">원가율</span>
                    <span className={`font-bold ${ratioColor(editingCost.ratio)}`}>
                      {editingCost.ratio != null ? `${editingCost.ratio.toFixed(1)}%` : '-'}
                    </span>
                  </div>
                  {editingCost.missing > 0 && (
                    <p className="text-[10px] text-amber-600 pt-1">
                      ⚠ {editingCost.missing}개 재료 단가 미입력 (재고 페이지에서 단가 등록 시 반영됨)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2">
              <button
                onClick={saveRecipe}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50"
              >
                {submitting ? '저장 중...' : '레시피 저장'}
              </button>
              <button
                onClick={() => deleteMenu(editTarget)}
                className="w-full py-2 text-xs text-rose-500 hover:text-rose-600"
              >
                🗑 이 메뉴 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
