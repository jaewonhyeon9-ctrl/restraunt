'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Status {
  configured: boolean
  connected: boolean
  dailyReportEnabled: boolean
  sendHour: number
  lastSentAt: string | null
  tokenValid: boolean
}

const KAKAO_CALLBACK_MESSAGES: Record<string, { text: string; tone: 'ok' | 'err' }> = {
  connected: { text: '카카오톡 연결 완료 🎉', tone: 'ok' },
  denied: { text: '카카오 로그인이 취소되었습니다.', tone: 'err' },
  state_mismatch: { text: '보안 검증 실패. 다시 시도해주세요.', tone: 'err' },
  user_mismatch: { text: '로그인 세션이 일치하지 않습니다.', tone: 'err' },
  failed: { text: '연결에 실패했습니다. 다시 시도해주세요.', tone: 'err' },
  not_configured: { text: '카카오 연동이 아직 설정되지 않았습니다.', tone: 'err' },
  invalid_request: { text: '잘못된 요청입니다.', tone: 'err' },
  unauthenticated: { text: '로그인이 필요합니다.', tone: 'err' },
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

export default function KakaoIntegrationCard() {
  const searchParams = useSearchParams()
  const callbackKey = searchParams.get('kakao')

  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ text: string; tone: 'ok' | 'err' } | null>(
    null
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/kakao/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (callbackKey) {
      const msg = KAKAO_CALLBACK_MESSAGES[callbackKey]
      if (msg) {
        setFlash(msg)
        setTimeout(() => setFlash(null), 4000)
      }
      // URL 정리
      const url = new URL(window.location.href)
      url.searchParams.delete('kakao')
      url.searchParams.delete('detail')
      window.history.replaceState(null, '', url.toString())
    }
  }, [callbackKey])

  async function handleSendNow() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/kakao/send-now', {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setFlash({ text: '카카오톡으로 발송됐습니다 ✅', tone: 'ok' })
        refresh()
      } else {
        setFlash({
          text: json?.error ?? '발송 실패',
          tone: 'err',
        })
      }
    } finally {
      setBusy(false)
      setTimeout(() => setFlash(null), 3500)
    }
  }

  async function handleToggleAuto() {
    if (!status || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/kakao/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyReportEnabled: !status.dailyReportEnabled }),
      })
      if (res.ok) refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleChangeHour(hour: number) {
    if (!status || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/kakao/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendHour: hour }),
      })
      if (res.ok) refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('카카오 연결을 해제하시겠습니까?')) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/kakao/settings', {
        method: 'DELETE',
      })
      if (res.ok) {
        setFlash({ text: '연결 해제됨', tone: 'ok' })
        refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-yellow-400/5 ring-1 ring-yellow-400/20 p-4">
        <div className="h-5 w-32 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  if (!status) return null

  // 카카오 설정 안 된 상태 — 아예 카드 숨김 (운영자가 env 넣기 전)
  if (!status.configured) return null

  return (
    <section className="rounded-2xl bg-gradient-to-br from-yellow-400/15 to-amber-500/5 ring-1 ring-yellow-400/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💬</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-yellow-100">카카오톡 마감 리포트</h2>
          <p className="text-[11px] text-yellow-300/80">
            {status.connected
              ? '매일 자동으로 나에게 카톡 발송'
              : '카카오 연결 후 매일 마감 리포트를 카톡으로 받으세요'}
          </p>
        </div>
      </div>

      {flash && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
            flash.tone === 'ok'
              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
              : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30'
          }`}
        >
          {flash.text}
        </div>
      )}

      {!status.connected ? (
        <a
          href="/api/auth/kakao/start"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#FEE500] text-[#191600] text-sm font-bold shadow active:scale-[0.98] transition"
        >
          <span className="text-lg">🟡</span>
          카카오톡 연결하기
        </a>
      ) : (
        <div className="space-y-3">
          {/* 자동 발송 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">매일 자동 발송</p>
              <p className="text-[10px] text-slate-500">
                {status.dailyReportEnabled
                  ? `매일 ${status.sendHour}시에 카톡으로 보내드려요`
                  : '자동 발송 꺼짐'}
              </p>
            </div>
            <button
              onClick={handleToggleAuto}
              disabled={busy}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                status.dailyReportEnabled ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  status.dailyReportEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 발송 시간 */}
          {status.dailyReportEnabled && (
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">
                발송 시간
              </label>
              <select
                value={status.sendHour}
                onChange={(e) => handleChangeHour(Number(e.target.value))}
                disabled={busy}
                className="w-full bg-white/5 text-slate-100 text-sm rounded-lg px-3 py-2 ring-1 ring-white/10 focus:outline-none focus:ring-yellow-400"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i} className="bg-slate-900">
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          )}

          {status.lastSentAt && (
            <p className="text-[10px] text-slate-400">
              마지막 발송: {formatRelative(status.lastSentAt)}
            </p>
          )}

          {/* 지금 바로 보내기 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSendNow}
              disabled={busy}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-[#FEE500] text-[#191600] disabled:opacity-50 transition active:scale-[0.98]"
            >
              {busy ? '처리 중...' : '지금 보내기'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="px-3 text-xs font-semibold py-2 rounded-lg bg-white/5 text-slate-300 disabled:opacity-50"
            >
              해제
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
