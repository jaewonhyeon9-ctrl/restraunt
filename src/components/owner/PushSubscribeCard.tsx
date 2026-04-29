'use client'

import { useEffect, useState } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

export default function PushSubscribeCard() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'denied' | 'subscribed' | 'off'>('loading')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'subscribed' : 'off')
    } catch {
      setState('off')
    }
  }

  async function subscribe() {
    setPending(true)
    setError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off')
        setPending(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        })
      }
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          authKey: json.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '구독 저장 실패')
      }
      setState('subscribed')
    } catch (e) {
      setError(e instanceof Error ? e.message : '활성화 실패')
    } finally {
      setPending(false)
    }
  }

  async function unsubscribe() {
    setPending(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' })
        await sub.unsubscribe()
      }
      setState('off')
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패')
    } finally {
      setPending(false)
    }
  }

  if (state === 'loading') return null

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">🔔</span>
        <h3 className="text-sm font-bold text-slate-100">앱 알림 (AI 점장 일일 리포트)</h3>
      </div>

      {state === 'unsupported' && (
        <p className="text-[11px] text-slate-400">이 브라우저는 푸시 알림을 지원하지 않아요. iOS는 16.4+ + 홈 화면 설치 필요.</p>
      )}

      {state === 'denied' && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-[11px] text-amber-200">
          알림이 차단됐어요. 브라우저 설정 → 사이트 권한 → 알림 허용으로 바꿔주세요.
        </div>
      )}

      {state === 'subscribed' && (
        <>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-2 text-[11px] text-emerald-200">
            ✓ 활성화 — 매일 22시 AI 점장 리포트가 도착합니다
          </div>
          <button
            type="button"
            onClick={async () => {
              setPending(true)
              setError(null)
              try {
                const res = await fetch('/api/push/test', { method: 'POST' })
                const body = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(body.error ?? '발송 실패')
                if (body.sent === 0)
                  throw new Error('전송된 디바이스 없음 — 알림을 다시 켜주세요')
              } catch (e) {
                setError(e instanceof Error ? e.message : '테스트 실패')
              } finally {
                setPending(false)
              }
            }}
            disabled={pending}
            className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? '전송 중…' : '🔔 테스트 알림 보내기'}
          </button>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={pending}
            className="w-full text-[11px] text-slate-400 hover:text-red-400 py-1"
          >
            알림 끄기
          </button>
        </>
      )}

      {state === 'off' && (
        <button
          type="button"
          onClick={subscribe}
          disabled={pending}
          className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? '활성화 중…' : '🔔 AI 점장 알림 켜기'}
        </button>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
