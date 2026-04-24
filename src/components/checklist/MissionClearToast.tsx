'use client'

import { useEffect, useState } from 'react'

interface ToastData {
  id: number
  xp: number
  combo: number
  message?: string
  perfect?: boolean
}

interface Props {
  toast: ToastData | null
  onDone?: () => void
}

export default function MissionClearToast({ toast, onDone }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const hide = setTimeout(() => setVisible(false), 1600)
    const clear = setTimeout(() => onDone?.(), 2000)
    return () => {
      clearTimeout(hide)
      clearTimeout(clear)
    }
  }, [toast, onDone])

  if (!toast) return null

  if (toast.perfect) {
    return (
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className={`relative text-center transition-transform duration-500 ${
            visible ? 'scale-100' : 'scale-75'
          }`}
        >
          <div className="text-[72px] leading-none mb-2 animate-bounce">🏆</div>
          <div className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent drop-shadow-lg">
            PERFECT DAY!
          </div>
          <div className="text-sm text-amber-200 mt-2 font-semibold">
            {toast.message ?? '오늘 체크리스트 전부 완료! 🎉'}
          </div>
          <div className="text-xs text-amber-300/80 mt-1 tabular-nums">
            +{toast.xp} XP 보너스
          </div>
        </div>
        {/* confetti-like sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-xl animate-ping"
              style={{
                left: `${(i * 83) % 100}%`,
                top: `${(i * 37) % 100}%`,
                animationDelay: `${i * 80}ms`,
                animationDuration: '1.2s',
              }}
            >
              {['✨', '⭐', '🌟', '💫'][i % 4]}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 ring-1 ring-white/20 shadow-lg shadow-indigo-500/40">
        <span className="text-lg">✅</span>
        <span className="text-sm font-bold text-white">
          {toast.message ?? '미션 클리어!'}
        </span>
        <span className="text-xs font-mono font-bold text-amber-200 tabular-nums">
          +{toast.xp} XP
        </span>
        {toast.combo >= 2 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 text-[10px] font-black tabular-nums">
            x{toast.combo} COMBO
          </span>
        )}
      </div>
    </div>
  )
}

export type { ToastData as MissionToastData }
