'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface FixedExpenseItem {
  id: string
  name: string
  category: string
  amount: number
  billingDay: number | null
  isDailyCalc: boolean
  isActive: boolean
}

interface WageEmployee {
  id: string
  name: string
  monthlyWage: number
}

const CATEGORY_OPTIONS = [
  { value: 'RENT', label: '임대료' },
  { value: 'UTILITY', label: '공과금' },
  { value: 'WAGE', label: '인건비' },
  { value: 'EQUIPMENT', label: '설비' },
  { value: 'OTHER', label: '기타' },
]

const CATEGORY_LABEL: Record<string, string> = {
  RENT: '임대료',
  UTILITY: '공과금',
  WAGE: '인건비',
  EQUIPMENT: '설비',
  INGREDIENT: '식재료',
  OTHER: '기타',
}

const CATEGORY_COLOR: Record<string, string> = {
  RENT: 'bg-purple-100 text-purple-700',
  UTILITY: 'bg-yellow-100 text-yellow-700',
  WAGE: 'bg-blue-100 text-blue-700',
  EQUIPMENT: 'bg-gray-100 text-gray-700',
  INGREDIENT: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-green-100 text-green-700',
}

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

const EMPTY_FORM = {
  name: '',
  category: 'RENT',
  amount: '',
  billingDay: '',
  isDailyCalc: true,
}

export default function FixedExpensePage() {
  const router = useRouter()
  const [items, setItems] = useState<FixedExpenseItem[]>([])
  const [wageEmployees, setWageEmployees] = useState<WageEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fixed-expenses')
      if (res.ok) {
        const data = await res.json()
        setItems(data.fixedExpenses || [])
        setWageEmployees(data.wageEmployees || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openAddModal = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (item: FixedExpenseItem) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      category: item.category,
      amount: String(item.amount),
      billingDay: item.billingDay ? String(item.billingDay) : '',
      isDailyCalc: item.isDailyCalc,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    const amount = Number(form.amount.replace(/,/g, ''))
    if (!form.name.trim() || !amount) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        amount,
        billingDay: form.billingDay ? Number(form.billingDay) : null,
        isDailyCalc: form.isDailyCalc,
      }

      if (editingId) {
        await fetch(`/api/fixed-expenses/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/fixed-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setShowModal(false)
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 고정비용을 삭제하시겠습니까?')) return
    setDeleting(id)
    try {
      await fetch(`/api/fixed-expenses/${id}`, { method: 'DELETE' })
      await fetchData()
    } finally {
      setDeleting(null)
    }
  }

  const totalMonthly = items.reduce((s, i) => s + i.amount, 0)
  const totalWages = wageEmployees.reduce((s, e) => s + e.monthlyWage, 0)
  const totalWithWages = totalMonthly + totalWages

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">고정비용 관리</h1>
          <button
            onClick={openAddModal}
            className="bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            + 추가
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 월 총액 요약 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">월 고정비용 합계 (인건비 포함)</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalWithWages)}</p>
          <p className="text-xs text-gray-400 mt-1">
            일할계산 시 약 {formatCurrency(Math.round(totalWithWages / 30))}/일
          </p>
          {totalWages > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              수동 등록 {formatCurrency(totalMonthly)} + 월급 자동 {formatCurrency(totalWages)}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">등록된 고정비용이 없습니다</p>
            <button
              onClick={openAddModal}
              className="text-sm text-orange-500 font-semibold"
            >
              + 고정비용 추가하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${CATEGORY_COLOR[item.category] || CATEGORY_COLOR.OTHER}`}>
                      {CATEGORY_LABEL[item.category] || '기타'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.billingDay && (
                          <span className="text-xs text-gray-400">매월 {item.billingDay}일</span>
                        )}
                        {item.isDailyCalc && (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">일할계산</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(item.amount)}</p>
                      {item.isDailyCalc && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          ~{formatCurrency(Math.round(item.amount / 30))}/일
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-xs text-gray-500 hover:text-orange-500 font-medium px-2 py-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 disabled:opacity-50"
                    >
                      {deleting === item.id ? '삭제중...' : '삭제'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 자동 포함: 월급제 직원 */}
        {wageEmployees.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">자동</span>
                <h2 className="text-sm font-semibold text-gray-800">월급제 직원 인건비</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                직원 관리에서 등록된 월급이 자동으로 고정비에 포함됩니다
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {wageEmployees.map((emp) => (
                <div key={emp.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 shrink-0">
                      월급
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                      <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">일할계산</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(emp.monthlyWage)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ~{formatCurrency(Math.round(emp.monthlyWage / 30))}/일
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">월급 합계</span>
              <span className="text-sm font-bold text-blue-600">{formatCurrency(totalWages)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)] overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                고정비용 {editingId ? '수정' : '등록'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="예: 월세, 전기세, 김직원 월급"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 <span className="text-orange-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                월 금액 <span className="text-orange-500">*</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* 납부일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">납부일</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={form.billingDay}
                onChange={(e) => setForm((p) => ({ ...p, billingDay: e.target.value }))}
                placeholder="매월 몇일 (선택)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* 일할계산 여부 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">일할계산 적용</p>
                <p className="text-xs text-gray-400 mt-0.5">매일 일할 금액으로 지출 반영</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isDailyCalc: !p.isDailyCalc }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.isDailyCalc ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.isDailyCalc ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.amount}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
