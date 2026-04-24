'use client'

import { useEffect, useState } from 'react'

interface Usage {
  plan: 'FREE' | 'STANDARD' | 'PRO'
  planLabel: string
  used: number
  limit: number | null
  remaining: number | null
  percent: number
  yearMonth: string
  unlimited: boolean
}

const PLAN_TONE: Record<Usage['plan'], { ring: string; text: string; bg: string }> = {
  FREE: {
    ring: 'ring-slate-400/30',
    text: 'text-slate-300',
    bg: 'from-slate-500/15 to-slate-500/5',
  },
  STANDARD: {
    ring: 'ring-indigo-400/30',
    text: 'text-indigo-300',
    bg: 'from-indigo-500/15 to-indigo-500/5',
  },
  PRO: {
    ring: 'ring-amber-400/30',
    text: 'text-amber-300',
    bg: 'from-amber-500/15 to-amber-500/5',
  },
}

export default function OcrUsageCard() {
  const [data, setData] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/ocr-usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }
  if (!data) return null

  const tone = PLAN_TONE[data.plan]
  const near =
    !data.unlimited && data.limit != null && data.percent >= 80

  return (
    <section
      className={`rounded-2xl bg-gradient-to-br ${tone.bg} ring-1 ${tone.ring} p-4`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📸</span>
          <h2 className="text-sm font-semibold text-slate-100">OCR 사용량</h2>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tone.text} bg-black/20`}
          >
            {data.planLabel}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">이번달</span>
      </div>

      {data.unlimited ? (
        <p className="text-sm text-slate-300">
          이번달 사용: <span className="font-bold tabular-nums">{data.used}회</span>{' '}
          <span className="text-amber-300 text-xs ml-1">무제한</span>
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] text-slate-400">
              {data.used} / {data.limit}회 사용
            </span>
            <span
              className={`text-[11px] font-bold tabular-nums ${
                near ? 'text-amber-300' : 'text-slate-300'
              }`}
            >
              {data.percent}%
            </span>
          </div>
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.percent >= 90
                  ? 'bg-gradient-to-r from-rose-400 to-rose-500'
                  : near
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
              }`}
              style={{ width: `${Math.min(100, data.percent)}%` }}
            />
          </div>
          {near && data.remaining != null && (
            <p className="text-[11px] text-amber-300/90 mt-2">
              ⚠️ 남은 {data.remaining}회. 한도 초과 시 이번달 OCR 사용이 제한됩니다.
            </p>
          )}
        </>
      )}
    </section>
  )
}
