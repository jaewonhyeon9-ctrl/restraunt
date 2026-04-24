'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('signup') === 'ok') {
      setInfo('회원가입 완료! 가입한 이메일로 로그인해주세요.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        const session = await getSession()
        const role = (session?.user as { role?: string } | undefined)?.role
        router.push(role === 'OWNER' ? '/dashboard' : '/home')
        router.refresh()
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.35)] ring-1 ring-white/10">
            <Image
              src="/icon-512.png"
              alt="오토드림"
              width={80}
              height={80}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-white to-indigo-200 bg-clip-text text-transparent">
            오토드림
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            꿈꾸던 식당 운영, 오토드림이 해드립니다
          </p>
        </div>

        {/* Login card */}
        <div className="ai-border">
          <div className="ai-border-inner p-6 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">로그인</h2>
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Secure
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="input-field"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="input-field"
                />
              </div>

              {info && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <p className="text-sm text-emerald-300">{info}</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          아직 계정이 없으신가요?{' '}
          <Link
            href="/signup"
            className="text-indigo-300 font-semibold hover:text-indigo-200"
          >
            사장님 회원가입
          </Link>
        </p>
        <p className="text-center text-xs text-slate-500 mt-2">
          <Link href="/guide" className="hover:text-slate-300 underline">
            사용 가이드 보기
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          불러오는 중...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
