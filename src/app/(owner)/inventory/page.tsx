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

type UnitType = 'mass' | 'volume' | 'count'

interface AddItemForm {
  name: string
  manufacturer: string
  unitType: UnitType
  packageQty: string         // 패키지 사이즈 숫자 (예: "20")
  packageUnit: string        // 패키지 단위 (kg/g/L/ml/개/박스/...)
  packagePrice: string       // 패키지 총 가격 (원)
  perPieceVolume: string     // count 모드 — 1단위당 g/ml
  safetyStock: string
  currentStock: string
  category: string
  supplierId: string
}

const EMPTY_FORM: AddItemForm = {
  name: '',
  manufacturer: '',
  unitType: 'mass',
  packageQty: '',
  packageUnit: 'kg',
  packagePrice: '',
  perPieceVolume: '',
  safetyStock: '',
  currentStock: '',
  category: '',
  supplierId: '',
}

const PRESET_CATEGORIES = [
  '쌀/곡물',
  '육류',
  '해산물',
  '채소',
  '과일',
  '양념/조미료',
  '유제품',
  '음료',
  '면류',
  '주류',
  '기타',
] as const

const MASS_UNITS = ['kg', 'g'] as const
const VOLUME_UNITS = ['L', 'ml'] as const
const COUNT_UNITS = ['개', '박스', '병', '봉', '캔', '통', '팩', '포', '묶음', '세트', '근'] as const

function deriveUnitType(unit: string | null | undefined): UnitType {
  if (!unit) return 'count'
  const u = unit.toLowerCase()
  if (['kg', 'g'].includes(u)) return 'mass'
  if (['l', 'ml', 'cc'].includes(u)) return 'volume'
  return 'count'
}

function unitToPackageWeightG(unit: string): number | null {
  const u = unit.toLowerCase()
  if (u === 'kg') return 1000
  if (u === 'g') return 1
  if (u === 'l') return 1000
  if (u === 'ml' || u === 'cc') return 1
  return null
}

type SortMode = 'name' | 'pricePerG_asc' | 'pricePerG_desc' | 'lowStock'
type GroupMode = 'supplier' | 'none'

function pricePerG(item: InventoryItem): number | null {
  if (item.unitPrice == null || !item.packageWeightG || item.packageWeightG <= 0) {
    return null
  }
  return item.unitPrice / item.packageWeightG
}

// 품목명에서 규격 자동 감지 (예: "3.5kg", "20kg", "1L", "500g", "350ml")
function detectPackageWeightG(name: string): number | null {
  const matches = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|L|l|ml|cc)\b/gi)]
  if (matches.length === 0) return null
  const last = matches[matches.length - 1]
  const value = parseFloat(last[1])
  const unit = last[2].toLowerCase()
  if (!Number.isFinite(value) || value <= 0) return null
  if (unit === 'kg' || unit === 'l') return value * 1000
  if (unit === 'g' || unit === 'ml' || unit === 'cc') return value
  return null
}

function formatWon(n: number | null): string {
  if (n == null) return '-'
  if (n >= 10000) return `${Math.round(n).toLocaleString()}원`
  if (n >= 100) return `${Math.round(n).toLocaleString()}원`
  if (n >= 1) return `${n.toFixed(1)}원`
  return `${n.toFixed(2)}원`
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
  const [logs, setLogs] = useState<Array<{
    id: string
    type: 'IN' | 'OUT' | 'ADJUST' | 'ORDER_IN'
    quantity: number
    note: string | null
    userName: string | null
    createdAt: string
  }> | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)

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
    const ut = deriveUnitType(item.unit)
    const baseFactor = unitToPackageWeightG(item.unit) // kg→1000, g→1, L→1000, ml→1
    let packageQty = '1'
    let packagePrice = item.unitPrice != null ? String(item.unitPrice) : ''
    let perPieceVolume = ''
    if ((ut === 'mass' || ut === 'volume') && baseFactor && item.packageWeightG && item.packageWeightG > 0) {
      // 레거시 호환: packageWeightG가 baseFactor와 다르면 "per-package" 컨벤션으로 간주
      if (Math.abs(item.packageWeightG - baseFactor) >= 0.01) {
        const qty = item.packageWeightG / baseFactor
        packageQty = Number.isInteger(qty) ? String(qty) : qty.toFixed(2)
        // packagePrice는 unitPrice 그대로 (레거시에서 unitPrice가 패키지 총액으로 저장됨)
      }
    } else if (ut === 'count' && item.packageWeightG != null) {
      perPieceVolume = String(item.packageWeightG)
    }
    setForm({
      name: item.name,
      manufacturer: item.manufacturer ?? '',
      unitType: ut,
      packageQty,
      packageUnit: item.unit || (ut === 'mass' ? 'kg' : ut === 'volume' ? 'L' : '개'),
      packagePrice,
      perPieceVolume,
      safetyStock: item.safetyStock != null ? String(item.safetyStock) : '',
      currentStock: String(item.currentStock),
      category: item.category ?? '',
      supplierId: item.supplier?.id ?? '',
    })
    setError('')
    setLogs(null)
    setShowModal(true)
    // 변동 이력 비동기 조회
    setLogsLoading(true)
    fetch(`/api/inventory/${item.id}/logs?limit=50`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  }

  async function handleSubmitItem(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const qty = Number(form.packageQty)
      const price = Number(form.packagePrice)
      if (!form.packageUnit || !qty || qty <= 0) {
        throw new Error('패키지 단위와 사이즈를 입력하세요.')
      }
      // unitPrice = 1단위당 가격 (예: 1kg당 가격)
      const unitPrice = price && qty ? price / qty : null
      // packageWeightG = 1단위당 g/ml
      let packageWeightG: number | null = null
      if (form.unitType === 'mass' || form.unitType === 'volume') {
        packageWeightG = unitToPackageWeightG(form.packageUnit)
      } else {
        // count: 사용자가 직접 입력한 1단위당 g/ml
        const ppv = Number(form.perPieceVolume)
        packageWeightG = ppv > 0 ? ppv : null
      }

      const payload = {
        name: form.name,
        manufacturer: form.manufacturer || null,
        unit: form.packageUnit,
        unitPrice,
        packageWeightG,
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

  async function handleAiClassify() {
    if (!form.name) {
      setError('품목명을 먼저 입력하세요.')
      return
    }
    try {
      const res = await fetch('/api/inventory/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, manufacturer: form.manufacturer }),
      })
      const data = (await res.json()) as { category: string | null; reason?: string }
      if (data.category) {
        setForm((p) => ({ ...p, category: data.category as string }))
      } else {
        setError('AI가 분류를 정하지 못했습니다. 직접 선택해주세요.')
      }
    } catch {
      setError('AI 분류 실패')
    }
  }

  function changeUnitType(next: UnitType) {
    setForm((p) => {
      const defaultUnit = next === 'mass' ? 'kg' : next === 'volume' ? 'L' : '개'
      return { ...p, unitType: next, packageUnit: defaultUnit, perPieceVolume: '' }
    })
  }

  // 한 품목 자동 설정
  async function autoSetItem(itemId: string, weightG: number) {
    const res = await fetch(`/api/inventory/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageWeightG: weightG }),
    })
    if (!res.ok) return false
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, packageWeightG: weightG } : i)),
    )
    return true
  }

  // 일괄 자동 설정 (이름에서 감지된 모든 품목)
  const [bulkRunning, setBulkRunning] = useState(false)
  async function runBulkAutoDetect() {
    const candidates = items.filter((i) => !i.packageWeightG && detectPackageWeightG(i.name) != null)
    if (candidates.length === 0) {
      setError('자동 감지 가능한 품목이 없습니다.')
      return
    }
    if (!confirm(`${candidates.length}개 품목의 규격을 이름에서 자동으로 설정합니다. 진행할까요?`)) return
    setBulkRunning(true)
    let success = 0
    for (const item of candidates) {
      const w = detectPackageWeightG(item.name)
      if (w == null) continue
      const ok = await autoSetItem(item.id, w)
      if (ok) success++
    }
    setBulkRunning(false)
    setError(`✅ ${success}/${candidates.length}개 품목이 자동 설정되었습니다.`)
  }

  const bulkCandidatesCount = useMemo(
    () => items.filter((i) => !i.packageWeightG && detectPackageWeightG(i.name) != null).length,
    [items],
  )

  // 폼 미리보기용 1g/ml당 가격
  const formPricePerG = useMemo(() => {
    const qty = Number(form.packageQty)
    const price = Number(form.packagePrice)
    if (!qty || !price || qty <= 0) return null
    if (form.unitType === 'mass' || form.unitType === 'volume') {
      const factor = unitToPackageWeightG(form.packageUnit)
      if (!factor || factor <= 0) return null
      return price / (qty * factor)
    }
    const ppv = Number(form.perPieceVolume)
    if (!ppv || ppv <= 0) return null
    return price / (qty * ppv)
  }, [form.unitType, form.packageQty, form.packageUnit, form.packagePrice, form.perPieceVolume])

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
      if (sortMode === 'pricePerG_asc') {
        const av = pricePerG(a)
        const bv = pricePerG(b)
        if (av == null && bv == null) return a.name.localeCompare(b.name)
        if (av == null) return 1
        if (bv == null) return -1
        return av - bv
      }
      if (sortMode === 'pricePerG_desc') {
        const av = pricePerG(a)
        const bv = pricePerG(b)
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
            href="/menu"
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            🍽️ 메뉴
          </Link>
          <Link
            href="/owner/inventory/orders"
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            발주
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
            <option value="pricePerG_asc">1g당 가격 낮은 순</option>
            <option value="pricePerG_desc">1g당 가격 높은 순</option>
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

      {/* 일괄 자동 설정 배너 */}
      {!loading && bulkCandidatesCount > 0 && (
        <div className="mb-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-violet-700">🪄 1g당 가격 자동 설정 가능</p>
              <p className="text-[11px] text-violet-600 mt-0.5">
                {bulkCandidatesCount}개 품목의 이름에서 규격(kg/g/L/ml)을 감지했어요
              </p>
            </div>
            <button
              onClick={runBulkAutoDetect}
              disabled={bulkRunning}
              className="px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              {bulkRunning ? '진행 중...' : `일괄 설정 (${bulkCandidatesCount})`}
            </button>
          </div>
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
                <span className="col-span-2 text-right">1g당</span>
                <span className="col-span-2 text-right">재고</span>
              </div>

              {/* 행 */}
              <ul className="divide-y divide-gray-50">
                {group.items.map((item) => {
                  const isLow =
                    item.safetyStock !== null && item.currentStock <= item.safetyStock
                  const perG = pricePerG(item)
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
                        {perG != null ? (
                          <p className="text-sm font-bold text-emerald-600">
                            {formatWon(perG)}
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

              {/* 단위 유형 chip selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  단위 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  {(['mass', 'volume', 'count'] as UnitType[]).map((t) => {
                    const label = t === 'mass' ? '무게 (kg/g)' : t === 'volume' ? '용량 (L/ml)' : '갯수 (개/박스 등)'
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => changeUnitType(t)}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          form.unitType === t
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 패키지 사이즈 + 단위 + 가격 */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    사이즈 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.packageQty}
                    onChange={(e) => setForm({ ...form, packageQty: e.target.value })}
                    placeholder="20"
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">단위</label>
                  <select
                    value={form.packageUnit}
                    onChange={(e) => setForm({ ...form, packageUnit: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    {(form.unitType === 'mass'
                      ? MASS_UNITS
                      : form.unitType === 'volume'
                      ? VOLUME_UNITS
                      : COUNT_UNITS
                    ).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5">
                  <label className="block text-xs font-medium text-gray-600 mb-1">총 가격 (원)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.packagePrice}
                    onChange={(e) => setForm({ ...form, packagePrice: e.target.value })}
                    placeholder="50000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {/* 갯수 모드일 때만: 1개당 g/ml */}
              {form.unitType === 'count' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    1{form.packageUnit}당 용량 (g 또는 ml) <span className="text-red-500">*</span>
                    <span className="ml-1 text-[10px] font-normal text-gray-400">— 1g당 가격 환산용</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.perPieceVolume}
                    onChange={(e) => setForm({ ...form, perPieceVolume: e.target.value })}
                    placeholder={`예) 1${form.packageUnit}이 350g이면 350`}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}

              {/* 1g/1ml당 가격 미리보기 */}
              {formPricePerG != null && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-emerald-700">
                    <span className="font-bold">1{form.unitType === 'volume' ? 'ml' : 'g'}당 {formatWon(formPricePerG)}</span>
                    <span className="text-[10px] text-emerald-600 ml-2">— 레시피 원가 자동 계산에 사용</span>
                  </p>
                </div>
              )}

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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">재료 분류</label>
                  <button
                    type="button"
                    onClick={handleAiClassify}
                    disabled={!form.name}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 font-medium hover:bg-violet-200 disabled:opacity-50"
                  >
                    🤖 AI 자동분류
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: form.category === c ? '' : c })}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        form.category === c
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="직접 입력도 가능"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
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

            {/* 변동 이력 (편집 모드일 때만) */}
            {editTarget && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-700 mb-2">📜 변동 이력</p>
                {logsLoading ? (
                  <div className="text-center py-4 text-xs text-gray-400">불러오는 중...</div>
                ) : logs && logs.length > 0 ? (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                    {logs.map((l) => {
                      const isIn = l.type === 'IN' || l.type === 'ORDER_IN'
                      const sign = isIn ? '+' : '−'
                      const tone = isIn
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : l.type === 'OUT'
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : 'text-blue-700 bg-blue-50 border-blue-200'
                      return (
                        <li
                          key={l.id}
                          className={`rounded-lg px-2.5 py-1.5 border text-xs ${tone}`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold">
                              {sign}
                              {Math.abs(l.quantity).toLocaleString()} {editTarget.unit}
                            </span>
                            <span className="text-[10px] opacity-70">
                              {new Date(l.createdAt).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {l.note && <p className="text-[10px] opacity-80">{l.note}</p>}
                          {l.userName && (
                            <p className="text-[10px] opacity-60 mt-0.5">{l.userName}</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">
                    아직 변동 이력이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
