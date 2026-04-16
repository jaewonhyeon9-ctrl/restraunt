'use client'

import { useEffect, useState } from 'react'

interface Employee {
  id: string
  name: string
  email: string
  phone: string | null
  hourlyWage: number | null
  fixedMonthlyWage: number | null
  hireDate: string | null
  isActive: boolean
  createdAt: string
  monthlyMinutes: number
  monthlyWage: number
}

interface EmployeeForm {
  name: string
  email: string
  password: string
  phone: string
  wageType: 'hourly' | 'monthly' | 'none'
  wageAmount: string
  hireDate: string
}

const EMPTY_FORM: EmployeeForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  wageType: 'none',
  wageAmount: '',
  hireDate: '',
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [changePassword, setChangePassword] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [showInactive])

  async function fetchEmployees() {
    setLoading(true)
    try {
      const url = showInactive ? '/api/employees?includeInactive=true' : '/api/employees'
      const res = await fetch(url)
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch {
      setError('직원 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setChangePassword(false)
    setError('')
    setShowModal(true)
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp)
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      phone: emp.phone ?? '',
      wageType: emp.hourlyWage != null ? 'hourly' : emp.fixedMonthlyWage != null ? 'monthly' : 'none',
      wageAmount: emp.hourlyWage != null
        ? String(emp.hourlyWage)
        : emp.fixedMonthlyWage != null
        ? String(emp.fixedMonthlyWage)
        : '',
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
    })
    setChangePassword(false)
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone || undefined,
        hourlyWage: form.wageType === 'hourly' && form.wageAmount ? Number(form.wageAmount) : null,
        monthlyWage: form.wageType === 'monthly' && form.wageAmount ? Number(form.wageAmount) : null,
        hireDate: form.hireDate || undefined,
      }

      if (!editTarget) {
        payload.email = form.email
        payload.password = form.password
      }

      if (editTarget && changePassword && form.password) {
        payload.newPassword = form.password
      }

      const url = editTarget ? `/api/employees/${editTarget.id}` : '/api/employees'
      const method = editTarget ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }

      setShowModal(false)
      fetchEmployees()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(emp: Employee) {
    if (!confirm(`"${emp.name}" 직원을 퇴직 처리하시겠습니까?\n비활성화 후에도 데이터는 보존됩니다.`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '비활성화 실패')
      }
      fetchEmployees()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '비활성화 실패')
    }
  }

  const now = new Date()
  const thisMonthLabel = `${now.getMonth() + 1}월`

  return (
    <div className="px-4 py-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">직원 관리</h1>
        <button
          onClick={openAdd}
          className="text-sm px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium"
        >
          + 직원 추가
        </button>
      </div>

      {/* 비활성 직원 토글 */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
            showInactive
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-white text-gray-500 border-gray-200'
          }`}
        >
          {showInactive ? '전체 표시 중' : '퇴직 직원 포함'}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-3">
          <div className="text-5xl">👥</div>
          <p className="text-base font-medium text-gray-500">등록된 직원이 없습니다</p>
          <p className="text-sm">직원을 추가해 근무 현황을 관리하세요</p>
          <button
            onClick={openAdd}
            className="inline-block mt-2 bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
          >
            + 첫 직원 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${
                !emp.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-base ${emp.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {emp.name}
                    </span>
                    {!emp.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                        퇴직
                      </span>
                    )}
                  </div>

                  {emp.phone && (
                    <p className="text-xs text-gray-500 mb-0.5">
                      <a href={`tel:${emp.phone}`} className="text-blue-500">
                        {emp.phone}
                      </a>
                    </p>
                  )}

                  {/* 급여 유형 */}
                  <p className="text-xs text-gray-400">
                    {emp.hourlyWage != null
                      ? `시급 ${emp.hourlyWage.toLocaleString()}원`
                      : emp.fixedMonthlyWage != null
                      ? `월급 ${emp.fixedMonthlyWage.toLocaleString()}원`
                      : '급여 미설정'}
                  </p>

                  {emp.hireDate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      입사일: {emp.hireDate.slice(0, 10)}
                    </p>
                  )}
                </div>

                {/* 이번달 통계 */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{thisMonthLabel} 근무</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {minutesToHours(emp.monthlyMinutes)}
                  </p>
                  {emp.monthlyWage > 0 && (
                    <>
                      <p className="text-xs text-gray-400 mt-1">{thisMonthLabel} 급여</p>
                      <p className="text-sm font-bold text-orange-600">
                        {emp.monthlyWage.toLocaleString()}원
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* 버튼 */}
              {emp.isActive && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => openEdit(emp)}
                    className="flex-1 text-xs py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeactivate(emp)}
                    className="flex-1 text-xs py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors"
                  >
                    퇴직 처리
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 바텀시트 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div
            className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? '직원 정보 수정' : '직원 추가'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 이름 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                {/* 이메일 (추가 시에만 수정 가능) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="employee@example.com"
                    required={!editTarget}
                    disabled={!!editTarget}
                    className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                      editTarget ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                {/* 비밀번호 */}
                {!editTarget ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      비밀번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="비밀번호를 입력하세요"
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-medium text-gray-600">비밀번호 변경</label>
                      <button
                        type="button"
                        onClick={() => {
                          setChangePassword((v) => !v)
                          setForm({ ...form, password: '' })
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          changePassword ? 'bg-orange-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            changePassword ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    {changePassword && (
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="새 비밀번호를 입력하세요"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    )}
                  </div>
                )}

                {/* 전화번호 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                {/* 급여 유형 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">급여 유형</label>
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                    {(['none', 'hourly', 'monthly'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm({ ...form, wageType: type, wageAmount: '' })}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          form.wageType === type
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {type === 'none' ? '미설정' : type === 'hourly' ? '시급' : '월급'}
                      </button>
                    ))}
                  </div>
                  {form.wageType !== 'none' && (
                    <div className="mt-2">
                      <input
                        type="number"
                        min="0"
                        value={form.wageAmount}
                        onChange={(e) => setForm({ ...form, wageAmount: e.target.value })}
                        placeholder={form.wageType === 'hourly' ? '시급 금액 (원)' : '월급 금액 (원)'}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  )}
                </div>

                {/* 입사일 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">입사일</label>
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="pb-4 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-orange-500 text-white font-semibold py-3.5 rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition-colors text-base"
                  >
                    {submitting
                      ? '저장 중...'
                      : editTarget
                      ? '수정 완료'
                      : '직원 추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
