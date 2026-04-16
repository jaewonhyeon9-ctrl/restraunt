'use client'

import { useState, useEffect, useCallback } from 'react'

interface ChecklistItem {
  templateId: string
  title: string
  description: string | null
  timeSlot: string | null
  sortOrder: number
  isChecked: boolean
  checkedAt: string | null
}

type TimeSlot = '오전' | '오후' | '저녁' | '기타'

const TIME_SLOT_ORDER: TimeSlot[] = ['오전', '오후', '저녁', '기타']

const TIME_SLOT_STYLE: Record<TimeSlot, { bg: string; badge: string; icon: string }> = {
  오전: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '🌅' },
  오후: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '☀️' },
  저녁: { bg: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', icon: '🌙' },
  기타: { bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: '📌' },
}

function normalizeSlot(raw: string | null): TimeSlot {
  if (!raw) return '기타'
  if (raw.includes('오전') || raw.toLowerCase().includes('morning')) return '오전'
  if (raw.includes('오후') || raw.toLowerCase().includes('afternoon')) return '오후'
  if (raw.includes('저녁') || raw.toLowerCase().includes('evening') || raw.toLowerCase().includes('night')) return '저녁'
  return '기타'
}

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/checklist')
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleCheck = async (templateId: string, current: boolean) => {
    if (checking.has(templateId)) return
    setChecking((prev) => new Set(prev).add(templateId))

    // 낙관적 업데이트
    setItems((prev) =>
      prev.map((item) =>
        item.templateId === templateId
          ? { ...item, isChecked: !current, checkedAt: !current ? new Date().toISOString() : null }
          : item
      )
    )

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, isChecked: !current }),
      })
      if (!res.ok) {
        // 실패 시 롤백
        setItems((prev) =>
          prev.map((item) =>
            item.templateId === templateId
              ? { ...item, isChecked: current, checkedAt: current ? item.checkedAt : null }
              : item
          )
        )
      }
    } catch {
      // 실패 시 롤백
      setItems((prev) =>
        prev.map((item) =>
          item.templateId === templateId
            ? { ...item, isChecked: current }
            : item
        )
      )
    } finally {
      setChecking((prev) => {
        const next = new Set(prev)
        next.delete(templateId)
        return next
      })
    }
  }

  // 타임슬롯별 그룹화
  const grouped = TIME_SLOT_ORDER.reduce<Record<TimeSlot, ChecklistItem[]>>(
    (acc, slot) => {
      acc[slot] = items
        .filter((i) => normalizeSlot(i.timeSlot) === slot)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      return acc
    },
    { 오전: [], 오후: [], 저녁: [], 기타: [] }
  )

  const total = items.length
  const completed = items.filter((i) => i.isChecked).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 완료율 헤더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-gray-800">오늘의 체크리스트</p>
          <span
            className={`text-sm font-bold ${
              percent === 100 ? 'text-green-600' : 'text-blue-600'
            }`}
          >
            {percent === 100 ? '완료 🎉' : `${percent}%`}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              percent === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-right">
          {completed} / {total} 완료
        </p>
      </div>

      {/* 타임슬롯별 섹션 */}
      {TIME_SLOT_ORDER.map((slot) => {
        const slotItems = grouped[slot]
        if (slotItems.length === 0) return null
        const style = TIME_SLOT_STYLE[slot]
        const slotDone = slotItems.filter((i) => i.isChecked).length

        return (
          <section key={slot}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-base">{style.icon}</span>
              <h2 className="font-semibold text-gray-700 text-sm">{slot}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                {slotDone}/{slotItems.length}
              </span>
            </div>

            <div className="space-y-2">
              {slotItems.map((item) => {
                const isProcessing = checking.has(item.templateId)
                return (
                  <button
                    key={item.templateId}
                    onClick={() => handleCheck(item.templateId, item.isChecked)}
                    disabled={isProcessing}
                    className={`w-full text-left rounded-xl p-4 border transition-all active:scale-[0.98] ${
                      item.isChecked
                        ? 'bg-green-50 border-green-200'
                        : `${style.bg}`
                    } ${isProcessing ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 체크박스 */}
                      <div
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.isChecked
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {item.isChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium leading-snug ${
                            item.isChecked ? 'text-gray-400 line-through' : 'text-gray-800'
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{item.description}</p>
                        )}
                        {item.isChecked && item.checkedAt && (
                          <p className="text-xs text-green-500 mt-1">
                            {new Date(item.checkedAt).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} 완료
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {total === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">오늘 등록된 체크리스트가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
