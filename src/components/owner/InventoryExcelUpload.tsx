'use client'

import { useState } from 'react'

export default function InventoryExcelUpload({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    created: number
    updated: number
    skipped: number
    warnings: { row: number; reason: string }[]
  } | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    setError('')
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('updateExisting', String(updateExisting))
      const res = await fetch('/api/inventory/bulk', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '업로드 실패')
      } else {
        setResult({
          created: json.created ?? 0,
          updated: json.updated ?? 0,
          skipped: json.skipped ?? 0,
          warnings: json.warnings ?? [],
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-card-strong p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100">
            📥 재고 품목 엑셀 업로드
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          컬럼 순서:{' '}
          <strong className="text-slate-200">품목명</strong>,{' '}
          <strong className="text-slate-200">단위</strong>, 단가, 안전재고,
          현재재고, 분류, 거래처
          <br />
          <span className="text-slate-500">
            거래처는 먼저 거래처 관리에서 등록된 이름과 정확히 같아야 매칭됩니다.
          </span>
        </p>

        <a
          href="/api/inventory/sample"
          className="btn-ghost inline-flex !py-2 !text-xs"
        >
          📥 샘플 엑셀 다운로드
        </a>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-2 file:text-white file:text-xs file:font-semibold hover:file:bg-indigo-600"
          />

          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-500"
            />
            동일한 품목명이 이미 있으면 <strong>덮어쓰기</strong>
          </label>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 ring-1 ring-rose-400/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!file || submitting}
            className="btn-primary w-full"
          >
            {submitting ? '업로드 중...' : '⬆ 엑셀 업로드'}
          </button>
        </form>

        {result && (
          <div className="space-y-2 text-xs border-t border-white/10 pt-3">
            <p className="text-emerald-300">
              ✅ 신규 {result.created}개
              {result.updated > 0 && `, 업데이트 ${result.updated}개`}
              {result.skipped > 0 && `, 건너뜀 ${result.skipped}개`}
            </p>
            {result.warnings.length > 0 && (
              <details className="text-slate-400">
                <summary className="cursor-pointer text-amber-300">
                  ⚠ 경고 {result.warnings.length}건
                </summary>
                <ul className="mt-1 pl-4 list-disc space-y-0.5">
                  {result.warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>
                      {w.row}행: {w.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <button
              onClick={onDone}
              className="btn-ghost w-full !py-2 !text-xs"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
