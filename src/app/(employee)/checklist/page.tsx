'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DailyNotesSection from '@/components/checklist/DailyNotesSection'

type Category = 'KITCHEN' | 'HALL'

interface ChecklistItem {
  templateId: string
  title: string
  description: string | null
  category: Category
  timeSlot: string | null
  sortOrder: number
  isChecked: boolean
  checkedAt: string | null
}

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  KITCHEN: { label: '주방', icon: '🍳' },
  HALL: { label: '서빙', icon: '🍽️' },
}

const TIME_SLOT_PRIORITY = ['오픈 전', '오전', '점심', '브레이크', '저녁', '마감']

function slotPriority(slot: string | null): number {
  if (!slot) return 999
  const idx = TIME_SLOT_PRIORITY.indexOf(slot)
  return idx === -1 ? 500 : idx
}

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<Category>('KITCHEN')

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/checklist')
      if (res.ok) setItems(await res.json())
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

    setItems((prev) =>
      prev.map((item) =>
        item.templateId === templateId
          ? {
              ...item,
              isChecked: !current,
              checkedAt: !current ? new Date().toISOString() : null,
            }
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
        setItems((prev) =>
          prev.map((item) =>
            item.templateId === templateId
              ? { ...item, isChecked: current }
              : item
          )
        )
      }
    } catch {
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

  // filter by category + group by timeSlot
  const categoryItems = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>()
    categoryItems.forEach((item) => {
      const key = item.timeSlot ?? '기타'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    })
    const sorted = Array.from(map.entries()).sort(
      ([a], [b]) => slotPriority(a) - slotPriority(b)
    )
    sorted.forEach(([, list]) => list.sort((a, b) => a.sortOrder - b.sortOrder))
    return sorted
  }, [categoryItems])

  const total = categoryItems.length
  const completed = categoryItems.filter((i) => i.isChecked).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  // Count badges
  const counts = useMemo(() => {
    const map: Record<Category, { done: number; total: number }> = {
      KITCHEN: { done: 0, total: 0 },
      HALL: { done: 0, total: 0 },
    }
    items.forEach((i) => {
      map[i.category].total++
      if (i.isChecked) map[i.category].done++
    })
    return map
  }, [items])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-4">
      {/* Category tabs */}
      <div className="flex gap-2">
        {(['KITCHEN', 'HALL'] as Category[]).map((c) => {
          const meta = CATEGORY_META[c]
          const isActive = activeCategory === c
          const cnt = counts[c]
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition relative ${
                isActive
                  ? 'bg-white/10 ring-1 ring-white/20 text-slate-100'
                  : 'bg-white/5 ring-1 ring-white/5 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-lg mr-1.5">{meta.icon}</span>
              {meta.label}
              <span className="ml-1.5 text-xs opacity-75">
                {cnt.done}/{cnt.total}
              </span>
            </button>
          )
        })}
      </div>

      {/* 완료율 */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-200">
            {CATEGORY_META[activeCategory].icon}{' '}
            {CATEGORY_META[activeCategory].label} 체크리스트
          </p>
          <span
            className={`text-sm font-bold tabular-nums ${
              percent === 100 ? 'text-emerald-300' : 'text-indigo-300'
            }`}
          >
            {percent === 100 ? '완료 🎉' : `${percent}%`}
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent === 100
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 text-right tabular-nums">
          {completed} / {total} 완료
        </p>
      </div>

      {/* 타임슬롯별 섹션 */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">
            이 카테고리에 등록된 체크리스트가 없습니다.
          </p>
        </div>
      ) : (
        grouped.map(([slot, slotItems]) => {
          const slotDone = slotItems.filter((i) => i.isChecked).length
          return (
            <section key={slot}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-xs font-bold text-slate-300 tracking-wide">
                  {slot}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-medium">
                  {slotDone}/{slotItems.length}
                </span>
              </div>

              <div className="space-y-2">
                {slotItems.map((item) => {
                  const isProcessing = checking.has(item.templateId)
                  return (
                    <button
                      key={item.templateId}
                      onClick={() =>
                        handleCheck(item.templateId, item.isChecked)
                      }
                      disabled={isProcessing}
                      className={`w-full text-left rounded-xl p-3.5 ring-1 transition active:scale-[0.99] ${
                        item.isChecked
                          ? 'bg-emerald-500/10 ring-emerald-400/30'
                          : 'bg-white/5 ring-white/10 hover:ring-white/20'
                      } ${isProcessing ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-md flex items-center justify-center transition ${
                            item.isChecked
                              ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 ring-1 ring-emerald-300'
                              : 'bg-white/5 ring-1 ring-white/20'
                          }`}
                        >
                          {item.isChecked && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              item.isChecked
                                ? 'text-slate-500 line-through'
                                : 'text-slate-100'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          )}
                          {item.isChecked && item.checkedAt && (
                            <p className="text-[11px] text-emerald-400 mt-1">
                              {new Date(item.checkedAt).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              완료
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
        })
      )}

      {/* 메모 섹션 */}
      <DailyNotesSection category={activeCategory} />
    </div>
  )
}
