'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    restaurantName: '',
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: form.restaurantName,
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? '회원가입에 실패했습니다.')
        setLoading(false)
        return
      }

      // 가입 성공 → 자동 로그인 → 대시보드
      const signed = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })
      if (signed?.error) {
        // 가입은 됐으나 자동 로그인 실패 → 로그인 페이지로
        router.push('/login?signup=ok')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-16 w-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.3)] ring-1 ring-white/10">
            <Image
              src="/icon-512.png"
              alt="오토드림"
              width={64}
              height={64}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-white to-indigo-200 bg-clip-text text-transparent">
            오토드림 회원가입
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            식당 운영을 자동화하는 첫걸음
          </p>
        </div>

        <div className="ai-border">
          <div className="ai-border-inner p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  식당 이름 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.restaurantName}
                  onChange={(e) => update('restaurantName', e.target.value)}
                  placeholder="예: 오토드림 식당"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  사장님 이름 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="홍길동"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  이메일 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="owner@example.com"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  비밀번호 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="6자 이상"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  비밀번호 확인 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.passwordConfirm}
                  onChange={(e) => update('passwordConfirm', e.target.value)}
                  placeholder="다시 한번 입력"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  전화번호 (선택)
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="input-field"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-1"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    가입 중...
                  </>
                ) : (
                  '사장으로 시작하기'
                )}
              </button>
            </form>

            <p className="text-[11px] text-slate-500 text-center mt-4 leading-relaxed">
              가입 시 오토드림 <Link href="/privacy" className="underline hover:text-slate-300">개인정보처리방침</Link>에<br />
              동의하는 것으로 간주됩니다
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link
            href="/login"
            className="text-indigo-300 font-semibold hover:text-indigo-200"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
