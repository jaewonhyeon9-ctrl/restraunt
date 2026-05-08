'use client'

import { useEffect, useMemo, useState } from 'react'

interface ManualMenu {
  id: string
  name: string
  category: string | null
  imageUrl: string | null
  cookingSteps: string | null
  recipes: { itemName: string; qtyUsed: number; unit: string }[]
}

const ALL = '__all__'
const NONE = '__none__'

export default function EmployeeMenuManualPage() {
  const [menus, setMenus] = useState<ManualMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(ALL)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/menus/manual')
      .then((r) => r.json())
      .then((d) => setMenus(d.menus ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    let hasNone = false
    for (const m of menus) {
      if (m.category) set.add(m.category)
      else hasNone = true
    }
    return { list: Array.from(set).sort(), hasNone }
  }, [menus])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menus.filter((m) => {
      if (activeCategory === NONE && m.category) return false
      if (activeCategory !== ALL && activeCategory !== NONE && m.category !== activeCategory)
        return false
      if (q && !m.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [menus, activeCategory, search])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    )
  }

  if (menus.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-slate-400">
        <p className="text-4xl mb-2">📖</p>
        <p className="text-sm">아직 등록된 메뉴가 없습니다.</p>
        <p className="text-[11px] mt-1">사장님이 메뉴와 조리법을 등록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-3">
      <div>
        <h1 className="text-xl font-bold text-slate-100">📖 메뉴 조리 매뉴얼</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          메뉴별 재료·조리 단계 확인. 신입도 보고 따라 만들 수 있어요.
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="메뉴 검색..."
        className="w-full px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-sm text-slate-100 placeholder:text-slate-500"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(ALL)}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
            activeCategory === ALL
              ? 'bg-indigo-500 text-white'
              : 'bg-white/5 text-slate-400 ring-1 ring-white/10'
          }`}
        >
          전체 ({menus.length})
        </button>
        {categories.list.map((c) => {
          const count = menus.filter((m) => m.category === c).length
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                activeCategory === c
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-slate-400 ring-1 ring-white/10'
              }`}
            >
              {c} ({count})
            </button>
          )
        })}
        {categories.hasNone && (
          <button
            onClick={() => setActiveCategory(NONE)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
              activeCategory === NONE
                ? 'bg-indigo-500 text-white'
                : 'bg-white/5 text-slate-400 ring-1 ring-white/10'
            }`}
          >
            미분류
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {filtered.map((m) => {
          const open = openId === m.id
          return (
            <li
              key={m.id}
              className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden"
            >
              <button
                onClick={() => setOpenId(open ? null : m.id)}
                className="w-full text-left px-3 py-3 flex items-start gap-3"
              >
                {m.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.imageUrl}
                    alt={m.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center text-2xl flex-shrink-0">
                    🍽️
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-slate-100">{m.name}</p>
                    {m.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                        {m.category}
                      </span>
                    )}
                    {m.cookingSteps && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
                        📖 조리법
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    재료 {m.recipes.length}개
                  </p>
                </div>
                <span className="text-slate-400 text-xl flex-shrink-0">
                  {open ? '−' : '+'}
                </span>
              </button>

              {open && (
                <div className="px-3 pb-3 space-y-3 border-t border-white/5">
                  {/* 사진 (큰 버전) */}
                  {m.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.imageUrl}
                      alt={m.name}
                      className="w-full max-h-72 object-cover rounded-xl mt-3"
                    />
                  )}

                  {/* 재료 */}
                  {m.recipes.length > 0 ? (
                    <div className="bg-emerald-500/10 ring-1 ring-emerald-400/20 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-emerald-200 mb-2">📦 재료</p>
                      <ul className="space-y-1 text-xs text-slate-200">
                        {m.recipes.map((r, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{r.itemName}</span>
                            <span className="font-mono tabular-nums">
                              {r.qtyUsed} {r.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">레시피 미등록</p>
                  )}

                  {/* 조리 단계 */}
                  {m.cookingSteps ? (
                    <div className="bg-amber-500/10 ring-1 ring-amber-400/20 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-amber-200 mb-2">📖 조리 단계</p>
                      <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                        {m.cookingSteps}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">조리 매뉴얼 미등록</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}