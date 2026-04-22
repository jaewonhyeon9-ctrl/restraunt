'use client'

import { useCallback, useEffect, useState } from 'react'

type Category = 'KITCHEN' | 'HALL'
type NoteType = 'HANDOVER' | 'ANOMALY' | 'OWNER_NOTE' | 'COMPLAINT'

interface DailyNote {
  id: string
  type: NoteType
  category: Category | null
  content: string
  createdAt: string
  user: { id: string; name: string }
}

const NOTE_TYPES: {
  key: NoteType
  label: string
  icon: string
  placeholder: string
  tone: string
}[] = [
  {
    key: 'HANDOVER',
    label: '다음 타임 전달사항',
    icon: '🔁',
    placeholder: '예: 양념치킨 소스 1.5L 남음, 점심 전 보충 필요',
    tone: 'sky',
  },
  {
    key: 'ANOMALY',
    label: '특이사항',
    icon: '⚠️',
    placeholder: '예: 오후 2시 냉장고 문 고장, 임시 고정 중',
    tone: 'amber',
  },
  {
    key: 'OWNER_NOTE',
    label: '사장님께 전달',
    icon: '📣',
    placeholder: '예: 홀 의자 2개 흔들림, 교체 요청',
    tone: 'indigo',
  },
  {
    key: 'COMPLAINT',
    label: '고객 컴플레인',
    icon: '🙋',
    placeholder: '예: 1번 테이블 고객, 음식이 짜다고 환불 요청 → 처리',
    tone: 'rose',
  },
]

const TONE_STYLES: Record<string, { ring: string; text: string; btn: string }> = {
  sky:     { ring: 'ring-sky-400/30',     text: 'text-sky-200',     btn: 'from-sky-500 to-sky-600' },
  amber:   { ring: 'ring-amber-400/30',   text: 'text-amber-200',   btn: 'from-amber-500 to-amber-600' },
  indigo:  { ring: 'ring-indigo-400/30',  text: 'text-indigo-200',  btn: 'from-indigo-500 to-indigo-600' },
  rose:    { ring: 'ring-rose-400/30',    text: 'text-rose-200',    btn: 'from-rose-500 to-rose-600' },
}

export default function DailyNotesSection({ category }: { category: Category }) {
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [drafts, setDrafts] = useState<Record<NoteType, string>>({
    HANDOVER: '',
    ANOMALY: '',
    OWNER_NOTE: '',
    COMPLAINT: '',
  })
  const [submitting, setSubmitting] = useState<NoteType | null>(null)

  const fetchNotes = useCallback(async () => {
    const res = await fetch(`/api/daily-notes?category=${category}`)
    if (res.ok) setNotes(await res.json())
  }, [category])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const submit = async (type: NoteType) => {
    const content = drafts[type].trim()
    if (!content) return
    setSubmitting(type)
    try {
      const res = await fetch('/api/daily-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, category }),
      })
      if (res.ok) {
        setDrafts((d) => ({ ...d, [type]: '' }))
        fetchNotes()
      }
    } finally {
      setSubmitting(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/daily-notes/${id}`, { method: 'DELETE' })
    if (res.ok) fetchNotes()
  }

  return (
    <section className="space-y-3 pt-3">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 px-1">
        메모 / 전달사항
      </h2>

      {NOTE_TYPES.map((nt) => {
        const tone = TONE_STYLES[nt.tone]
        const typeNotes = notes.filter((n) => n.type === nt.key)
        return (
          <div
            key={nt.key}
            className={`rounded-2xl bg-white/5 ring-1 ${tone.ring} p-3.5 space-y-2.5`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{nt.icon}</span>
              <h3 className={`text-sm font-semibold ${tone.text}`}>
                {nt.label}
              </h3>
              {typeNotes.length > 0 && (
                <span className="ml-auto text-[11px] text-slate-500">
                  {typeNotes.length}건
                </span>
              )}
            </div>

            {/* 기존 메모 리스트 */}
            {typeNotes.length > 0 && (
              <ul className="space-y-1.5">
                {typeNotes.map((n) => (
                  <li
                    key={n.id}
                    className="group rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-200 leading-relaxed"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap flex-1">{n.content}</p>
                      <button
                        onClick={() => remove(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-rose-300 hover:text-rose-200 text-[10px] shrink-0"
                      >
                        삭제
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {n.user?.name ?? '알 수 없음'} ·{' '}
                      {new Date(n.createdAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* 입력 */}
            <div className="flex gap-2 items-stretch">
              <textarea
                value={drafts[nt.key]}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [nt.key]: e.target.value }))
                }
                placeholder={nt.placeholder}
                rows={2}
                className="input-field !py-2 !text-xs resize-none flex-1"
              />
              <button
                onClick={() => submit(nt.key)}
                disabled={!drafts[nt.key].trim() || submitting === nt.key}
                className={`shrink-0 rounded-lg px-3 text-xs font-semibold text-white bg-gradient-to-br ${tone.btn} disabled:opacity-40`}
              >
                {submitting === nt.key ? '...' : '등록'}
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
