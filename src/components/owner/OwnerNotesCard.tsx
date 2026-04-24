'use client'

import { useEffect, useState } from 'react'

interface OwnerNote {
  id: string
  type: string
  category: 'KITCHEN' | 'HALL' | null
  content: string
  createdAt: string
  user: { id: string; name: string } | null
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function OwnerNotesCard() {
  const [notes, setNotes] = useState<OwnerNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch(
          '/api/daily-notes?type=OWNER_NOTE&sinceDays=7&limit=20'
        )
        if (res.ok) {
          const json = await res.json()
          if (Array.isArray(json)) setNotes(json)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [])

  if (loading) {
    return (
      <section className="glass-card p-4">
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </section>
    )
  }

  if (notes.length === 0) return null

  const visible = expanded ? notes : notes.slice(0, 3)

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📣</span>
          <h2 className="text-sm font-semibold text-slate-100">
            사장님께 전달사항
          </h2>
          <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5">
            {notes.length}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">최근 7일</span>
      </div>

      <ul className="space-y-2">
        {visible.map((n) => (
          <li
            key={n.id}
            className="rounded-xl bg-amber-400/5 ring-1 ring-amber-400/20 px-3 py-2.5"
          >
            <p className="text-sm text-slate-100 whitespace-pre-wrap break-words leading-relaxed">
              {n.content}
            </p>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
              <span>
                {n.user?.name ?? '알 수 없음'}
                {n.category && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
                    {n.category === 'KITCHEN' ? '🍳 주방' : '🍽️ 서빙'}
                  </span>
                )}
              </span>
              <span>{formatRelative(n.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>

      {notes.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 text-xs text-slate-400 hover:text-slate-200 py-1.5"
        >
          {expanded ? '접기 ▲' : `${notes.length - 3}개 더 보기 ▼`}
        </button>
      )}
    </section>
  )
}
