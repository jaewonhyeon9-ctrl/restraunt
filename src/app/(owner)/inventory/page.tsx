'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import InventoryExcelUpload from '@/components/owner/InventoryExcelUpload'

interface Supplier {
  id: string
  name: string
}

interface InventoryItem {
  id: string
  name: string
  manufacturer: string | null
  unit: string
  currentStock: number
  safetyStock: number | null
  unitPrice: number | null
  packageWeightG: number | null
  category: string | null
  supplier: Supplier | null
}

interface AddItemForm {
  name: string
  manufacturer: string
  unit: string
  unitPrice: string
  packageWeightG: string
  safetyStock: string
  currentStock: string
  category: string
  supplierId: string
}

const EMPTY_FORM: AddItemForm = {
  name: '',
  manufacturer: '',
  unit: '',
  unitPrice: '',
  packageWeightG: '',
  safetyStock: '',
  currentStock: '',
  category: '',
  supplierId: '',
}

type SortMode = 'name' | 'pricePer10g_asc' | 'pricePer10g_desc' | 'lowStock'
type GroupMode = 'supplier' | 'none'

function pricePer10g(item: InventoryItem): number | null {
  if (item.unitPrice == null || !item.packageWeightG || item.packageWeightG <= 0) {
    return null
  }
  return (item.unitPrice / item.packageWeightG) * 10
}

function formatWon(n: number | null): string {
  if (n == null) return '-'
  if (n >= 10000) return `${Math.round(n).toLocaleString()}원`
  if (n >= 100) return `${Math.round(n).toLocaleString()}원`
  return `${n.toFixed(1)}원`
}

export default function OwnerInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [form, setForm] = useState<AddItemForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [groupMode, setGroupMode] = useState<GroupMode>('supplier')
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null)

  const lowStockItems = items.filter(
    (item) => item.safetyStock !== null && item.currentStock <= item.safetyStock
  )

  useEffect(() => {
    fetchItems()
    fetchSuppliers()
  }, [])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError('재고를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSuppliers() {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : [])
    } catch {
      // 거래처 로드 실패는 무시
    }
  }

  function openEdit(item: InventoryItem) {
    setEditTarget(item)
    setForm({
      name: item.name,
      manufacturer: item.manufacturer ?? '',
      unit: item.unit,
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
      packageWeightG: item.packageWeightG != null ? String(item.packageWeightG) : '',
      safetyStock: item.safetyStock != null ? String(item.safetyStock) : '',
      currentStock: String(item.currentStock),
      category: item.category ?? '',
      supplierId: item.supplier?.id ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSubmitItem(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        manufacturer: form.manufacturer || null,
        unit: form.unit,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
        packageWeightG: form.packageWeightG ? Number(form.packageWeightG) : null,
        safetyStock: form.safetyStock ? Number(form.safetyStock) : null,
        currentStock: form.currentStock ? Number(form.currentStock) : 0,
        category: form.category || null,
        supplierId: form.supplierId || null,
      }
      const url = editTarget ? `/api/inventory/${editTarget.id}` : '/api/inventory'
      const method = editTarget ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      setShowModal(false)
      setEditTarget(null)
      setForm(EMPTY_FORM)
      fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteItem(item: InventoryItem) {
    if (!confirm(`"${item.name}"을(를) 재고에서 삭제할까요?\n(데이터는 보존되며 목록에서만 사라집니다.)`)) return
    try {
      const res = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '삭제 실패')
      }
      fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  // 정렬
  const sortedItems = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      if (sortMode === 'pricePer10g_asc') {
        const av = pricePer10g(a)
        const bv = pricePer10g(b)
        if (av == null && bv == null) return a.name.localeCompare(b.name)
        if (av == null) return 1
        if (bv == null) return -1
        return av - bv
      }
      if (sortMode === 'pricePer10g_desc') {
        const av = pricePer10g(a)
        const bv = pricePer10g(b)
        if (av == null && bv == null) return a.name.localeCompare(b.name)
        if (av == null) return 1
        if (bv == null) return -1
        return bv - av
      }
      if (sortMode === 'lowStock') {
        const aLow =
          a.safetyStock !== null && a.currentStock <= a.safetyStock ? 0 : 1
        const bLow =
          b.safetyStock !== null && b.currentStock <= b.safetyStock ? 0 : 1
        if (aLow !== bLow) return aLow - bLow
        return a.name.localeCompare(b.name)
      }
      return 0
    })
    return arr
  }, [items, sortMode])

  // 그룹핑 (거래처별)
  const grouped = useMemo(() => {
    if (groupMode === 'none') {
      return [{ key: 'all', name: '전체', items: sortedItems }]
    }
    const map = new Map<string, { key: string; name: string; items: InventoryItem[] }>()
    for (const item of sortedItems) {
      const key = item.supplier?.id ?? '__no_supplier__'
      const name = item.supplier?.name ?? '거래처 미지정'
      if (!map.has(key)) map.set(key, { key, name, items: [] })
      map.get(key)!.items.push(item)
    }
    return Array.from(map.values()).sort((a, b) => {
      // 미지정은 맨 아래
      if (a.key === '__no_supplier__') return 1
      if (b.key === '__no_supplier__') return -1
      return a.name.localeCompare(b.name)
    })
  }, [sortedItems, groupMode])

  return (
    <div className="px-4 py-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-100">재고 현황</h1>
        <div className="flex gap-2">
          <Link
            href="/owner/inventory/orders"
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            발주내역
          </Link>
          <button
            onClick={() => setShowExcelModal(true)}
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            📥 엑셀
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary !py-1.5 !px-3 !text-xs"
          >
            + 품목
          </button>
        </div>
      </div>

      {showExcelModal && (
        <InventoryExcelUpload
          onClose={() => setShowExcelModal(false)}
          onDone={() => {
            setShowExcelModal(false)
            fetchItems()
          }}
        />
      )}

      {/* 안전재고 이하 경고 배너 */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-bold text-sm">⚠ 안전재고 이하 품목</span>
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {lowStockItems.length}개
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lowStockItems.map((item) => (
              <span
                key={item.id}
                className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium"
              >
                {item.name} ({item.currentStock}{item.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* 요약 카드 */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xl font-bold text-gray-800">{items.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">전체 품목</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-red-100 shadow-sm text-center">
            <p className="text-xl font-bold text-red-600">{lowStockItems.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">부족 품목</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-green-100 shadow-sm text-center">
            <p className="text-xl font-bold text-green-600">
              {items.length - lowStockItems.length}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">정상 품목</p>
          </div>
        </div>
      )}

      {/* 정렬/그룹 토글 */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 flex-shrink-0"
          >
            <option value="name">이름순</option>
            <option value="pricePer10g_asc">10g당 가격 낮은 순</option>
            <option value="pricePer10g_desc">10g당 가격 높은 순</option>
            <option value="lowStock">부족 우선</option>
          </select>
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="text-xs border border-gray-200 rounded-lg bg-white px-2 py-1.5 flex-shrink-0"
          >
            <option value="supplier">거래처별 그룹</option>
            <option value="none">그룹 없음</option>
          </select>
        </div>
      )}

      {/* 재고 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📦</p>
          <p>등록된 재고 품목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 그룹 헤더 */}
              {groupMode === 'supplier' && (
                <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 truncate">
                    🏪 {group.name}
                  </span>
                  <span className="text-[10px] text-gray-400">{group.items.length}품목</span>
                </div>
              )}

              {/* 컬럼 헤더 (mobile-friendly) */}
              <div className="px-3 py-2 grid grid-cols-12 gap-1 text-[10px] font-semibold text-gray-400 border-b border-gray-50">
                <span className="col-span-5">품목 / 제조사</span>
                <span className="col-span-3 text-right">가격</span>
                <span className="col-span-2 text-right">10g당</span>
                <span className="col-span-2 text-right">재고</span>
              </div>

              {/* 행 */}
              <ul className="divide-y divide-gray-50">
                {group.items.map((item) => {
                  const isLow =
                    item.safetyStock !== null && item.currentStock <= item.safetyStock
                  const per10g = pricePer10g(item)
                  return (
                    <li
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className={`px-3 py-2.5 grid grid-cols-12 gap-1 items-center text-xs cursor-pointer hover:bg-orange-50/50 transition-colors ${
                        isLow ? 'bg-red-50' : ''
                      }`}
                    >
                      {/* 품목 + 제조사 */}
                      <div className="col-span-5 min-w-0">
                        <div className="flex items-center gap-1">
                          {isLow && <span className="text-red-500 text-xs">⚠</span>}
                          <span
                            className={`text-sm font-medium truncate ${
                              isLow ? 'text-red-700' : 'text-gray-800'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {item.manufacturer ?? '제조사 미지정'}
                        </p>
                      </div>

                      {/* 가격 */}
                      <div className="col-span-3 text-right">
                        <p className="text-sm font-semibold text-gray-800">
                          {item.unitPrice != null
                            ? `${item.unitPrice.toLocaleString()}원`
                            : '-'}
                        </p>
                        {item.packageWeightG != null && item.packageWeightG > 0 && (
                          <p className="text-[10px] text-gray-400">
                            /{item.packageWeightG.toLocaleString()}g
                          </p>
                        )}
                      </div>

                      {/* 10g당 가격 */}
                      <div className="col-span-2 text-right">
                        {per10g != null ? (
                          <p className="text-sm font-bold text-emerald-600">
                            {formatWon(per10g)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-300">-</p>
                        )}
                      </div>

                      {/* 현재고 */}
                      <div className="col-span-2 text-right">
                        <p
                          className={`text-sm font-bold ${
                            isLow ? 'text-red-600' : 'text-gray-700'
                          }`}
                        >
                          {item.currentStock}
                          <span className="text-[10px] font-normal text-gray-400 ml-0.5">
                            {item.unit}
                          </span>
                        </p>
                        {item.safetyStock != null && (
                          <p className="text-[9px] text-gray-400">안전 {item.safetyStock}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 품목 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 shadow-2xl max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+16px)] overscroll-contain">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? '재고 품목 수정' : '재고 품목 추가'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditTarget(null)
                  setForm(EMPTY_FORM)
                  setError('')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitItem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  품목명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예) 돼지고기 앞다리살"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제조사명</label>
                <input
                  type="text"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  placeholder="예) CJ제일제당"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">거래처</label>
                <select
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  <option value="">거래처 선택 (선택사항)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    단위 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="kg, 개, 병"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    단가 (원)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  패키지 중량 (g)
                  <span className="ml-1 text-[10px] font-normal text-gray-400">— 10g당 가격 환산용</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.packageWeightG}
                  onChange={(e) => setForm({ ...form, packageWeightG: e.target.value })}
                  placeholder="예) 5kg → 5000, 350g → 350"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                {form.unitPrice && form.packageWeightG && Number(form.packageWeightG) > 0 && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    → 10g당 {formatWon((Number(form.unitPrice) / Number(form.packageWeightG)) * 10)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">현재 재고</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.currentStock}
                    onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">안전재고</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.safetyStock}
                    onChange={(e) => setForm({ ...form, safetyStock: e.target.value })}
                    placeholder="최소 보유량"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="예) 육류, 채소, 음료"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors mt-2"
              >
                {submitting
                  ? '저장 중...'
                  : editTarget
                  ? '수정 완료'
                  : '품목 등록'}
              </button>
              {editTarget && (
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(editTarget)
                    setShowModal(false)
                    setEditTarget(null)
                    setForm(EMPTY_FORM)
                  }}
                  className="w-full text-xs text-red-500 hover:text-red-600 py-2"
                >
                  🗑 이 품목 삭제하기
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
