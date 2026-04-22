'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Category = 'KITCHEN' | 'HALL'

interface Template {
  id: string
  title: string
  description: string | null
  category: Category
  timeSlot: string | null
  sortOrder: number
  isActive: boolean
}

const PRESET_SLOTS = ['오픈 전', '오전', '점심', '브레이크', '저녁', '마감']

const CATEGORY_META: Record<Category, { label: string; icon: string; tint: string }> = {
  KITCHEN: { label: '주방', icon: '🍳', tint: 'text-orange-300' },
  HALL: { label: '서빙', icon: '🍽️', tint: 'text-sky-300' },
}

export default function ChecklistAdminPage() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'direct' | 'excel'>('direct')
  const [activeCategory, setActiveCategory] = useState<Category>('KITCHEN')
  const [form, setForm] = useState<{
    title: string
    description: string
    timeSlot: string
  }>({ title: '', description: '', timeSlot: '오픈 전' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [excelResult, setExcelResult] = useState<{
    created: number
    replacedCount: number
    skipped: { row: number; reason: string }[]
  } | null>(null)

  const flash = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/checklist/templates')
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/checklist/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: activeCategory,
          timeSlot: form.timeSlot,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        flash('error', json.error ?? '등록 실패')
      } else {
        flash('success', '항목이 추가되었습니다.')
        setForm({ ...form, title: '', description: '' })
        fetchItems()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/checklist/templates/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      flash('success', '삭제되었습니다.')
      fetchItems()
    } else {
      flash('error', '삭제 실패')
    }
  }

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!excelFile) return
    setSubmitting(true)
    setExcelResult(null)
    try {
      const fd = new FormData()
      fd.append('file', excelFile)
      fd.append('replaceExisting', String(replaceExisting))
      const res = await fetch('/api/checklist/templates/bulk', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        flash('error', json.error ?? '업로드 실패')
      } else {
        flash('success', `${json.created}개 항목이 추가되었습니다.`)
        setExcelResult({
          created: json.created,
          replacedCount: json.replacedCount ?? 0,
          skipped: json.skipped ?? [],
        })
        setExcelFile(null)
        fetchItems()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = useMemo(() => {
    const map: Record<Category, Template[]> = { KITCHEN: [], HALL: [] }
    items.forEach((t) => {
      if (t.category in map) map[t.category].push(t)
    })
    return map
  }, [items])

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          Admin
        </p>
        <h1 className="text-xl font-bold text-slate-100 mt-0.5">
          체크리스트 관리
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          주방·서빙 별로 타임라인에 따라 항목을 등록하세요
        </p>
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            msg.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Mode tabs */}
      <div className="inline-flex p-1 rounded-xl bg-white/5 ring-1 ring-white/5">
        <button
          onClick={() => setMode('direct')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
            mode === 'direct'
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          직접 입력
        </button>
        <button
          onClick={() => setMode('excel')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
            mode === 'excel'
              ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          엑셀 업로드
        </button>
      </div>

      {mode === 'direct' && (
        <>
          {/* Category tabs */}
          <div className="flex gap-2">
            {(['KITCHEN', 'HALL'] as Category[]).map((c) => {
              const meta = CATEGORY_META[c]
              const isActive = activeCategory === c
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-white/10 ring-1 ring-white/20 text-slate-100'
                      : 'bg-white/5 ring-1 ring-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-lg mr-1.5">{meta.icon}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>

          {/* Add form */}
          <form onSubmit={handleAdd} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                {CATEGORY_META[activeCategory].icon}{' '}
                {CATEGORY_META[activeCategory].label} 항목 추가
              </h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                시간대
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SLOTS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setForm({ ...form, timeSlot: s })}
                    className={`px-2.5 py-1 text-xs rounded-lg transition ${
                      form.timeSlot === s
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <input
                  value={form.timeSlot}
                  onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                  placeholder="직접 입력"
                  className="input-field !py-1 !px-2 !text-xs w-28"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                제목
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 냉장고 온도 확인"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                설명 (선택)
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="예: 0~4도 유지 여부 확인"
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? '추가 중...' : '+ 항목 추가'}
            </button>
          </form>
        </>
      )}

      {mode === 'excel' && (
        <form onSubmit={handleExcelUpload} className="glass-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">
            엑셀로 한꺼번에 등록
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            컬럼 순서: <strong className="text-slate-200">카테고리</strong>{' '}
            (주방/서빙), <strong className="text-slate-200">시간대</strong>,{' '}
            <strong className="text-slate-200">제목</strong>, 설명(선택), 순서(선택)
          </p>
          <a
            href="/api/checklist/templates/sample"
            className="btn-ghost inline-flex !py-2 !text-xs"
          >
            📥 샘플 엑셀 다운로드
          </a>

          <div className="pt-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-white file:text-xs file:font-semibold hover:file:bg-indigo-600"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-500"
            />
            기존 체크리스트 모두 삭제 후 새로 등록
          </label>

          <button
            type="submit"
            disabled={!excelFile || submitting}
            className="btn-primary w-full"
          >
            {submitting ? '업로드 중...' : '⬆ 엑셀 업로드'}
          </button>

          {excelResult && (
            <div className="mt-2 text-xs text-slate-300 space-y-1">
              <p>✅ 추가됨: {excelResult.created}개</p>
              {excelResult.replacedCount > 0 && (
                <p>🗑 기존 비활성화: {excelResult.replacedCount}개</p>
              )}
              {excelResult.skipped.length > 0 && (
                <details className="text-slate-400">
                  <summary className="cursor-pointer text-amber-300">
                    ⚠ 건너뛴 행 {excelResult.skipped.length}개
                  </summary>
                  <ul className="mt-1 pl-4 list-disc space-y-0.5">
                    {excelResult.skipped.slice(0, 10).map((s, i) => (
                      <li key={i}>
                        {s.row}행: {s.reason}
                      </li>
                    ))}
                    {excelResult.skipped.length > 10 && (
                      <li className="text-slate-500">
                        외 {excelResult.skipped.length - 10}개
                      </li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}
        </form>
      )}

      {/* Current items */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
          등록된 항목
        </h2>

        {loading ? (
          <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            📋 아직 등록된 항목이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {(['KITCHEN', 'HALL'] as Category[]).map((cat) => {
              const list = grouped[cat]
              if (list.length === 0) return null
              const meta = CATEGORY_META[cat]
              return (
                <div key={cat} className="glass-card p-3">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-base">{meta.icon}</span>
                    <h3 className={`text-sm font-bold ${meta.tint}`}>
                      {meta.label}
                    </h3>
                    <span className="text-xs text-slate-500">
                      ({list.length}개)
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {list.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-2 rounded-lg bg-white/5 ring-1 ring-white/5 px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {t.timeSlot && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 font-medium">
                                {t.timeSlot}
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-100">
                              {t.title}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-rose-300 hover:text-rose-200 px-2 py-1 rounded hover:bg-rose-500/10"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
