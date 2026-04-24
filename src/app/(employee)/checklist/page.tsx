'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DailyNotesSection from '@/components/checklist/DailyNotesSection'
import MissionClearToast, {
  type MissionToastData,
} from '@/components/checklist/MissionClearToast'

const XP_PER_CHECK = 10
const COMBO_WINDOW_MS = 4000
const PERFECT_BONUS_XP = 100
const LEVEL_STEP_XP = 100

const COMBO_MESSAGES = [
  '잘했어요! 💪',
  '멋져요!',
  '연속 성공!',
  '불붙었네요! 🔥',
  '대단해요!',
]

function calcLevel(totalXp: number) {
  const level = Math.floor(totalXp / LEVEL_STEP_XP) + 1
  const xpInLevel = totalXp % LEVEL_STEP_XP
  const percent = Math.round((xpInLevel / LEVEL_STEP_XP) * 100)
  return { level, xpInLevel, percent }
}

type Category = 'KITCHEN' | 'HALL'

interface ChecklistItem {
  templateId: string
  title: string
  description: string | null
  category: Category
  timeSlot: string | null
  scheduledTime: string | null
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

  // 게임화 상태
  const [toast, setToast] = useState<MissionToastData | null>(null)
  const [monthlyXp, setMonthlyXp] = useState(0)
  const comboCountRef = useRef(0)
  const lastCheckTimeRef = useRef(0)
  const perfectFiredRef = useRef<Set<Category>>(new Set())

  // 서버에서 월 누적 XP 조회
  useEffect(() => {
    fetch('/api/gamification/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.monthlyXp === 'number') {
          setMonthlyXp(json.monthlyXp)
          // 이미 완료된 카테고리는 Perfect Day 재발동 방지
          if (Array.isArray(json.perfectedToday)) {
            perfectFiredRef.current = new Set(json.perfectedToday)
          }
        }
      })
      .catch(() => {})
  }, [])

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

  const triggerMissionToast = useCallback(
    (category: Category, willComplete: boolean, prevItems: ChecklistItem[]) => {
      const now = Date.now()
      const withinCombo = now - lastCheckTimeRef.current < COMBO_WINDOW_MS
      comboCountRef.current = withinCombo ? comboCountRef.current + 1 : 1
      lastCheckTimeRef.current = now

      const combo = comboCountRef.current
      const comboBonus = combo >= 2 ? (combo - 1) * 5 : 0
      const xpGained = XP_PER_CHECK + comboBonus

      setMonthlyXp((v) => v + xpGained)

      // Perfect Day 조건: 이번 체크로 카테고리 100% 달성 && 이 세션에서 아직 안 터트림
      const catItems = prevItems.filter((i) => i.category === category)
      const catDone = catItems.filter((i) => i.isChecked).length + 1
      const catTotal = catItems.length
      const justPerfected =
        willComplete &&
        catTotal > 0 &&
        catDone === catTotal &&
        !perfectFiredRef.current.has(category)

      if (justPerfected) {
        perfectFiredRef.current.add(category)
        setMonthlyXp((v) => v + PERFECT_BONUS_XP)
        setToast({
          id: now,
          xp: PERFECT_BONUS_XP,
          combo: 0,
          perfect: true,
          message:
            category === 'KITCHEN'
              ? '주방 체크리스트 100% 완료!'
              : '서빙 체크리스트 100% 완료!',
        })
        return
      }

      if (willComplete) {
        const msgIdx = Math.min(combo - 1, COMBO_MESSAGES.length - 1)
        setToast({
          id: now,
          xp: xpGained,
          combo,
          message: combo >= 2 ? COMBO_MESSAGES[msgIdx] : '미션 클리어!',
        })
      }
    },
    []
  )

  const handleCheck = async (templateId: string, current: boolean) => {
    if (checking.has(templateId)) return
    setChecking((prev) => new Set(prev).add(templateId))

    // 체크(미완료 → 완료)일 때만 연출 트리거
    const willComplete = !current
    if (willComplete) {
      const target = items.find((i) => i.templateId === templateId)
      if (target) triggerMissionToast(target.category, willComplete, items)
    }

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
    sorted.forEach(([, list]) =>
      list.sort((a, b) => {
        // time-aware ordering: scheduledTime first (asc), then sortOrder
        const ta = a.scheduledTime ?? '99:99'
        const tb = b.scheduledTime ?? '99:99'
        if (ta !== tb) return ta.localeCompare(tb)
        return a.sortOrder - b.sortOrder
      })
    )
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

  const levelInfo = calcLevel(monthlyXp)

  return (
    <div className="px-4 pt-5 pb-6 space-y-4">
      <MissionClearToast toast={toast} onDone={() => setToast(null)} />

      {/* 레벨/XP 바 */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 ring-1 ring-indigo-400/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-xs font-black text-amber-900 shadow ring-1 ring-amber-300">
              {levelInfo.level}
            </span>
            <span className="text-sm font-bold text-slate-100">
              Lv.{levelInfo.level}
            </span>
            <span className="text-[11px] text-slate-400">이번달 성과</span>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-amber-300">
            {monthlyXp.toLocaleString()} XP
          </span>
        </div>
        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${levelInfo.percent}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-1 text-right tabular-nums">
          다음 레벨까지 {LEVEL_STEP_XP - levelInfo.xpInLevel} XP
        </p>
      </div>

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

              <div className="relative space-y-2">
                {/* Timeline vertical line */}
                {slotItems.some((i) => i.scheduledTime) && (
                  <div
                    aria-hidden
                    className="absolute left-[42px] top-2 bottom-2 w-px bg-gradient-to-b from-indigo-400/30 via-indigo-400/20 to-transparent"
                  />
                )}
                {slotItems.map((item) => {
                  const isProcessing = checking.has(item.templateId)
                  return (
                    <button
                      key={item.templateId}
                      onClick={() =>
                        handleCheck(item.templateId, item.isChecked)
                      }
                      disabled={isProcessing}
                      className={`relative w-full text-left rounded-xl p-3.5 ring-1 transition active:scale-[0.99] ${
                        item.isChecked
                          ? 'bg-emerald-500/10 ring-emerald-400/30'
                          : 'bg-white/5 ring-white/10 hover:ring-white/20'
                      } ${isProcessing ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Time badge or checkbox column */}
                        <div className="flex flex-col items-center gap-1 min-w-[38px]">
                          {item.scheduledTime && (
                            <span
                              className={`text-[11px] font-mono font-bold tabular-nums leading-none ${
                                item.isChecked
                                  ? 'text-emerald-300/70'
                                  : 'text-amber-300'
                              }`}
                            >
                              {item.scheduledTime}
                            </span>
                          )}
                          <div
                            className={`flex-shrink-0 h-5 w-5 rounded-md flex items-center justify-center transition ${
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
