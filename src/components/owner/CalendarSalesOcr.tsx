'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Entry = {
  date: string
  amount: number
  selected: boolean
}

type Props = {
  onClose: () => void
}

export default function CalendarSalesOcr({ onClose }: Props) {
  const router = useRouter()
  const [stage, setStage] = useState<'pick' | 'analyzing' | 'review' | 'saving'>('pick')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [yearMonth, setYearMonth] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<'skip' | 'replace' | 'add'>('skip')

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setImageUrl(URL.createObjectURL(f))
    const reader = new FileReader()
    reader.onload = () => setImageData(reader.result as string)
    reader.readAsDataURL(f)
  }

  async function analyze() {
    if (!imageData) return
    setStage('analyzing')
    setError(null)
    try {
      const res = await fetch('/api/sales/ocr-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? '인식 실패')
      setYearMonth(body.yearMonth)
      setEntries(
        (body.entries as { date: string; amount: number }[]).map((e) => ({
          ...e,
          selected: true,
        }))
      )
      setTotal(body.totalAmount)
      setConfidence(body.confidence)
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : '인식 실패')
      setStage('pick')
    }
  }

  function toggle(i: number) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, selected: !e.selected } : e)))
  }

  function update(i: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  async function save() {
    setStage('saving')
    setError(null)
    try {
      const selected = entries.filter((e) => e.selected)
      if (selected.length === 0) throw new Error('등록할 항목이 없어요')
      const res = await fetch('/api/sales/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: selected.map((e) => ({ date: e.date, amount: e.amount })),
          conflict,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? '저장 실패')
      alert(
        `완료\n신규 ${body.created}건 / 업데이트 ${body.updated}건 / 건너뜀 ${body.skipped}건`
      )
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
      setStage('review')
    }
  }

  const selectedCount = entries.filter((e) => e.selected).length
  const selectedTotal = entries.filter((e) => e.selected).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-5 space-y-3 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+16px)] overscroll-contain">
        <header className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">📅 달력 매출 일괄 등록</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <p className="text-[11px] text-gray-500">
          POS / 배달앱의 월간 매출 캘린더 화면을 캡처하면 한 달치를 한 번에 등록.
        </p>

        {stage === 'pick' && (
          <>
            {imageUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="매출 캘린더" className="w-full h-auto max-h-72 object-contain bg-gray-50" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(null)
                      setImageData(null)
                    }}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-xs text-gray-700"
                  >
                    다른 사진
                  </button>
                  <button
                    type="button"
                    onClick={analyze}
                    className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-semibold text-white"
                  >
                    🔍 분석 시작
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer">
                  <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-5 text-sm text-gray-600 hover:border-orange-400">
                    📷 촬영
                  </span>
                  <input type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />
                </label>
                <label className="cursor-pointer">
                  <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-5 text-sm text-gray-600 hover:border-orange-400">
                    🖼️ 갤러리
                  </span>
                  <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
                </label>
              </div>
            )}
          </>
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-col items-center py-8 gap-2">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">달력 분석 중…</p>
          </div>
        )}

        {(stage === 'review' || stage === 'saving') && (
          <div className="space-y-2">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
              <p>
                <span className="font-semibold">{yearMonth ?? '월 미인식'}</span> · 인식 신뢰도{' '}
                {(confidence * 100).toFixed(0)}%
              </p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                선택 {selectedCount}건 · 합계 {selectedTotal.toLocaleString('ko-KR')}원
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-gray-700 mb-1">중복 시 처리</p>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { v: 'skip', label: '건너뛰기', desc: '기존 유지' },
                  { v: 'replace', label: '덮어쓰기', desc: '교체' },
                  { v: 'add', label: '합산', desc: '+' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setConflict(opt.v)}
                    className={
                      'rounded-lg py-1.5 px-1 text-[10px] font-semibold border ' +
                      (conflict === opt.v
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {entries.map((e, i) => (
                <li key={i} className={'px-3 py-2 flex items-center gap-2 ' + (e.selected ? '' : 'opacity-40')}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={
                      'size-5 rounded flex items-center justify-center border flex-shrink-0 ' +
                      (e.selected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-300 text-transparent')
                    }
                  >
                    ✓
                  </button>
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) => update(i, { date: ev.target.value })}
                    className="text-xs border-0 bg-transparent flex-shrink-0 w-32"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={e.amount.toLocaleString('ko-KR')}
                    onChange={(ev) => {
                      const digits = ev.target.value.replace(/[^\d]/g, '')
                      update(i, { amount: digits ? Number(digits) : 0 })
                    }}
                    className="text-xs text-right tabular-nums border-0 bg-transparent flex-1 min-w-0"
                  />
                  <span className="text-[10px] text-gray-400 flex-shrink-0">원</span>
                </li>
              ))}
              {entries.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-gray-500">
                  인식된 매출이 없어요. 다른 이미지로 시도해주세요.
                </li>
              )}
            </ul>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStage('pick')
                  setEntries([])
                }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-xs text-gray-700"
              >
                다시 분석
              </button>
              <button
                type="button"
                onClick={save}
                disabled={stage === 'saving' || selectedCount === 0}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {stage === 'saving' ? '저장 중…' : `${selectedCount}건 등록`}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
