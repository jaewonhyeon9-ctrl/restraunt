'use client'

import { useEffect, useState } from 'react'

interface InventoryItem {
  id: string
  name: string
  unit: string
  currentStock: number
  safetyStock: number | null
  unitPrice: number | null
  category: string | null
  supplier: { id: string; name: string } | null
}

interface OrderRow {
  item: InventoryItem
  quantity: string
  checked: boolean
}

export default function EmployeeOrderPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [orderRows, setOrderRows] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      const data: InventoryItem[] = await res.json()
      setItems(Array.isArray(data) ? data : [])

      // 안전재고 이하 품목은 자동으로 체크됨
      const rows: OrderRow[] = data.map((item) => ({
        item,
        quantity: '',
        checked:
          item.safetyStock !== null && item.currentStock <= item.safetyStock,
      }))
      setOrderRows(rows)
    } catch {
      setError('재고 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(itemId: string, field: 'quantity' | 'checked', value: string | boolean) {
    setOrderRows((prev) =>
      prev.map((row) =>
        row.item.id === itemId ? { ...row, [field]: value } : row
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const selected = orderRows.filter(
      (row) => row.checked && row.quantity !== '' && Number(row.quantity) > 0
    )

    if (selected.length === 0) {
      setError('발주할 품목과 수량을 선택해주세요.')
      return
    }

    setSubmitting(true)

    // 거래처별로 그룹핑해서 발주 신청
    const groupedBySupplier = selected.reduce<Record<string, OrderRow[]>>(
      (acc, row) => {
        const supplierId = row.item.supplier?.id ?? '__none__'
        if (!acc[supplierId]) acc[supplierId] = []
        acc[supplierId].push(row)
        return acc
      },
      {}
    )

    try {
      for (const [supplierId, rows] of Object.entries(groupedBySupplier)) {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: supplierId !== '__none__' ? supplierId : undefined,
            items: rows.map((row) => ({
              itemId: row.item.id,
              itemName: row.item.name,
              quantity: Number(row.quantity),
              unit: row.item.unit,
              unitPrice: row.item.unitPrice ?? undefined,
            })),
            note: note || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || '발주 신청 실패')
        }
      }
      setSuccess(
        `발주 신청이 완료되었습니다. (${selected.length}개 품목) 사장님께 알림이 전송되었습니다.`
      )
      setNote('')
      // 체크 해제 및 수량 초기화
      setOrderRows((prev) =>
        prev.map((row) => ({ ...row, quantity: '', checked: false }))
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const lowStockRows = orderRows.filter(
    (row) =>
      row.item.safetyStock !== null &&
      row.item.currentStock <= row.item.safetyStock
  )
  const normalRows = orderRows.filter(
    (row) =>
      row.item.safetyStock === null ||
      row.item.currentStock > row.item.safetyStock
  )
  const selectedCount = orderRows.filter(
    (row) => row.checked && row.quantity !== '' && Number(row.quantity) > 0
  ).length

  function renderRow(row: OrderRow) {
    const isLow =
      row.item.safetyStock !== null &&
      row.item.currentStock <= row.item.safetyStock
    return (
      <div
        key={row.item.id}
        className={`flex items-center gap-3 px-4 py-3 ${
          isLow ? 'bg-red-50' : ''
        } ${row.checked ? 'opacity-100' : 'opacity-75'}`}
      >
        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={row.checked}
          onChange={(e) => updateRow(row.item.id, 'checked', e.target.checked)}
          className="w-4 h-4 rounded accent-blue-600 shrink-0"
        />
        {/* 품목 정보 */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isLow ? 'text-red-700' : 'text-gray-800'}`}>
            {isLow && <span className="mr-1">⚠</span>}
            {row.item.name}
          </p>
          <p className="text-xs text-gray-400">
            현재고 {row.item.currentStock}{row.item.unit}
            {row.item.safetyStock !== null
              ? ` / 안전재고 ${row.item.safetyStock}${row.item.unit}`
              : ''}
            {row.item.supplier ? ` · ${row.item.supplier.name}` : ''}
          </p>
        </div>
        {/* 수량 입력 */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min="0"
            step="0.1"
            value={row.quantity}
            onChange={(e) => {
              updateRow(row.item.id, 'quantity', e.target.value)
              if (e.target.value !== '' && Number(e.target.value) > 0) {
                updateRow(row.item.id, 'checked', true)
              }
            }}
            placeholder="0"
            disabled={!row.checked}
            className={`w-20 border rounded-lg px-2.5 py-2 text-sm text-right font-medium focus:outline-none focus:ring-2 ${
              row.checked
                ? isLow
                  ? 'border-red-300 focus:ring-red-400 bg-white text-red-700'
                  : 'border-gray-200 focus:ring-blue-400'
                : 'border-gray-100 bg-gray-50 text-gray-300'
            }`}
          />
          <span className="text-xs text-gray-500 w-6">{row.item.unit}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-gray-900 mb-1">발주 신청</h1>
      <p className="text-sm text-gray-400 mb-4">
        발주할 품목을 선택하고 수량을 입력하세요.
      </p>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📦</p>
          <p>등록된 재고 품목이 없습니다.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* 안전재고 이하 품목 */}
          {lowStockRows.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-bold text-red-600">⚠ 안전재고 이하 품목</h2>
                <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                  {lowStockRows.length}개
                </span>
              </div>
              <div className="bg-white rounded-xl border border-red-200 shadow-sm divide-y divide-red-50">
                {lowStockRows.map(renderRow)}
              </div>
            </div>
          )}

          {/* 일반 품목 */}
          {normalRows.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-500 mb-2">전체 품목</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {normalRows.map(renderRow)}
              </div>
            </div>
          )}

          {/* 메모 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              메모 (선택사항)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="긴급 발주, 특이사항 등..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || selectedCount === 0}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting
              ? '신청 중...'
              : selectedCount > 0
              ? `발주 신청하기 (${selectedCount}개 품목)`
              : '품목을 선택해주세요'}
          </button>
        </form>
      )}
    </div>
  )
}
