'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import InventoryExcelUpload from '@/components/owner/InventoryExcelUpload'

interface Supplier {
  id: string
  name: string
}

interface InventoryItem {
  id: string
  name: string
  unit: string
  currentStock: number
  safetyStock: number | null
  unitPrice: number | null
  category: string | null
  supplier: Supplier | null
}

interface AddItemForm {
  name: string
  unit: string
  unitPrice: string
  safetyStock: string
  currentStock: string
  category: string
  supplierId: string
}

const EMPTY_FORM: AddItemForm = {
  name: '',
  unit: '',
  unitPrice: '',
  safetyStock: '',
  currentStock: '',
  category: '',
  supplierId: '',
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

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          unit: form.unit,
          unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
          safetyStock: form.safetyStock ? Number(form.safetyStock) : undefined,
          currentStock: form.currentStock ? Number(form.currentStock) : 0,
          category: form.category || undefined,
          supplierId: form.supplierId || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '등록 실패')
      }
      setShowModal(false)
      setForm(EMPTY_FORM)
      fetchItems()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

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
        <div className="space-y-2">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-gray-800">{items.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">전체 품목</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-red-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">부족 품목</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-green-100 shadow-sm text-center">
              <p className="text-2xl font-bold text-green-600">
                {items.length - lowStockItems.length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">정상 품목</p>
            </div>
          </div>

          {/* 테이블 헤더 */}
          <div className="bg-gray-100 rounded-lg px-3 py-2 grid grid-cols-12 gap-1 text-xs font-semibold text-gray-500">
            <span className="col-span-4">품목명</span>
            <span className="col-span-2 text-center">현재고</span>
            <span className="col-span-2 text-center">안전재고</span>
            <span className="col-span-2 text-center">단위</span>
            <span className="col-span-2 text-center">거래처</span>
          </div>

          {/* 재고 행 */}
          {items.map((item) => {
            const isLow =
              item.safetyStock !== null && item.currentStock <= item.safetyStock
            return (
              <div
                key={item.id}
                className={`rounded-xl px-3 py-3 grid grid-cols-12 gap-1 items-center border ${
                  isLow
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-gray-100'
                } shadow-sm`}
              >
                <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                  {isLow && <span className="text-red-500 text-xs shrink-0">⚠</span>}
                  <span
                    className={`text-sm font-medium truncate ${
                      isLow ? 'text-red-700' : 'text-gray-800'
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
                <span
                  className={`col-span-2 text-center text-sm font-bold ${
                    isLow ? 'text-red-600' : 'text-gray-800'
                  }`}
                >
                  {item.currentStock}
                </span>
                <span className="col-span-2 text-center text-sm text-gray-500">
                  {item.safetyStock ?? '-'}
                </span>
                <span className="col-span-2 text-center text-xs text-gray-500">
                  {item.unit}
                </span>
                <span className="col-span-2 text-center text-xs text-gray-400 truncate">
                  {item.supplier?.name ?? '-'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 품목 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">재고 품목 추가</h2>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setError('') }}
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

            <form onSubmit={handleAddItem} className="space-y-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    단위 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="예) kg, 개, 병"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    현재 재고
                  </label>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    안전재고
                  </label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="예) 육류, 채소, 음료"
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors mt-2"
              >
                {submitting ? '등록 중...' : '품목 등록'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
