'use client'

import { useEffect, useState } from 'react'

interface InventoryItem {
  id: string
  name: string
  unit: string
  currentStock: number
  safetyStock: number | null
  category: string | null
}

interface StockInput {
  itemId: string
  quantity: string
}

export default function InventoryCheckPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      const data: InventoryItem[] = await res.json()
      setItems(Array.isArray(data) ? data : [])
      // 현재고를 기본값으로 세팅
      const initInputs: Record<string, string> = {}
      for (const item of data) {
        initInputs[item.id] = String(item.currentStock)
      }
      setInputs(initInputs)
    } catch {
      setError('재고 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(itemId: string, value: string) {
    setInputs((prev) => ({ ...prev, [itemId]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    const itemsPayload: StockInput[] = items
      .filter((item) => inputs[item.id] !== '')
      .map((item) => ({
        itemId: item.id,
        quantity: inputs[item.id],
      }))

    if (itemsPayload.length === 0) {
      setError('재고량을 입력해주세요.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/inventory/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload.map((i) => ({
            itemId: i.itemId,
            quantity: Number(i.quantity),
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      const result = await res.json()
      setSuccess(
        `재고 파악이 완료되었습니다.${
          result.lowStockCount > 0
            ? ` (안전재고 이하 ${result.lowStockCount}개 품목 — 사장님께 알림 전송)`
            : ''
        }`
      )
      fetchItems()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 카테고리별 그룹핑
  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const cat = item.category ?? '기타'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-gray-900 mb-1">재고 파악</h1>
      <p className="text-sm text-gray-400 mb-4">
        현재 보유 중인 재고량을 입력해주세요.
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
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, categoryItems]) => (
              <div key={category}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  {category}
                </h2>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {categoryItems.map((item) => {
                    const inputVal = inputs[item.id] ?? ''
                    const numVal = parseFloat(inputVal)
                    const isLow =
                      item.safetyStock !== null &&
                      !isNaN(numVal) &&
                      numVal <= item.safetyStock
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          isLow ? 'bg-red-50' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isLow ? 'text-red-700' : 'text-gray-800'}`}>
                            {isLow && <span className="mr-1">⚠</span>}
                            {item.name}
                          </p>
                          {item.safetyStock !== null && (
                            <p className="text-xs text-gray-400">
                              안전재고: {item.safetyStock}{item.unit}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={inputVal}
                            onChange={(e) => handleChange(item.id, e.target.value)}
                            className={`w-20 border rounded-lg px-2.5 py-2 text-sm text-right font-medium focus:outline-none focus:ring-2 ${
                              isLow
                                ? 'border-red-300 focus:ring-red-400 bg-red-50 text-red-700'
                                : 'border-gray-200 focus:ring-blue-400'
                            }`}
                          />
                          <span className="text-xs text-gray-500 w-6">{item.unit}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? '저장 중...' : '재고 파악 완료'}
          </button>
        </form>
      )}
    </div>
  )
}
