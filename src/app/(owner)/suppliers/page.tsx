'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import type { ParsedSupplier } from '@/lib/supplier-parser'

interface Supplier {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  category: string | null
  paymentDay: number | null
  note: string | null
  monthlyAmount?: number
}

interface SupplierForm {
  name: string
  contactName: string
  phone: string
  email: string
  category: string
  paymentDay: string
  note: string
}

const EMPTY_FORM: SupplierForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  category: '',
  paymentDay: '',
  note: '',
}

type OcrStep = 'idle' | 'camera' | 'processing' | 'review'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // OCR 상태
  const [ocrStep, setOcrStep] = useState<OcrStep>('idle')
  const [useCamera, setUseCamera] = useState(true)
  const [cameraError, setCameraError] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  async function fetchSuppliers() {
    setLoading(true)
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : [])
    } catch {
      setError('거래처를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  function openEdit(supplier: Supplier) {
    setEditTarget(supplier)
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      category: supplier.category ?? '',
      paymentDay: supplier.paymentDay ? String(supplier.paymentDay) : '',
      note: supplier.note ?? '',
    })
    setError('')
    setShowModal(true)
  }

  function openOcr() {
    setOcrStep('camera')
    setUseCamera(true)
    setCameraError(false)
    setImagePreview(null)
    setOcrError(null)
    setForm(EMPTY_FORM)
    setEditTarget(null)
  }

  const processImage = useCallback(async (base64: string) => {
    setOcrStep('processing')
    setOcrError(null)
    try {
      const res = await fetch('/api/suppliers/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'OCR 처리 실패')
      }
      const data = await res.json()
      const parsed: ParsedSupplier = data.parsed
      setForm({
        name: parsed.name ?? '',
        contactName: parsed.contactName ?? '',
        phone: parsed.phone ?? '',
        email: '',
        category: parsed.category ?? '',
        paymentDay: '',
        note: parsed.businessNumber ? `사업자번호: ${parsed.businessNumber}` : '',
      })
      setOcrStep('review')
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : 'OCR 처리 중 오류가 발생했습니다')
      setOcrStep('camera')
    }
  }, [])

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    setImagePreview(imageSrc)
    processImage(imageSrc.split(',')[1])
  }, [processImage])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImagePreview(result)
      processImage(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }, [processImage])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        category: form.category || undefined,
        paymentDay: form.paymentDay ? Number(form.paymentDay) : undefined,
        note: form.note || undefined,
      }

      const res = await fetch(
        editTarget ? `/api/suppliers/${editTarget.id}` : '/api/suppliers',
        {
          method: editTarget ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '저장 실패')
      }
      setShowModal(false)
      setOcrStep('idle')
      setForm(EMPTY_FORM)
      fetchSuppliers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 거래처를 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '삭제 실패')
      }
      fetchSuppliers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  const now = new Date()
  const thisMonthLabel = `${now.getMonth() + 1}월`

  // OCR 카메라 모달
  if (ocrStep === 'camera' || ocrStep === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => setOcrStep('idle')}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 flex-1">
              {ocrStep === 'processing' ? 'OCR 분석 중' : '거래처 사진 등록'}
            </h1>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-4 space-y-4">
          {ocrError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-red-600">{ocrError}</p>
            </div>
          )}

          {ocrStep === 'processing' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4">
              {imagePreview && (
                <img src={imagePreview} alt="촬영 이미지" className="w-full max-h-48 object-contain rounded-xl opacity-60" />
              )}
              <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">거래처 정보 분석 중...</p>
                <p className="text-xs text-gray-400 mt-1">텍스트를 인식하고 있습니다</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-100">
                  <button
                    onClick={() => { setUseCamera(true); setCameraError(false) }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${useCamera ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'}`}
                  >
                    카메라 촬영
                  </button>
                  <button
                    onClick={() => setUseCamera(false)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${!useCamera ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'}`}
                  >
                    갤러리에서 선택
                  </button>
                </div>

                {useCamera ? (
                  <div className="relative">
                    {!cameraError ? (
                      <>
                        <Webcam
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          screenshotQuality={0.9}
                          videoConstraints={{ facingMode: { ideal: 'environment' }, aspectRatio: 4 / 3 }}
                          onUserMediaError={() => setCameraError(true)}
                          className="w-full"
                        />
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="border-2 border-orange-400 rounded-lg w-4/5 h-3/4 opacity-60" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                        <p className="text-sm">카메라에 접근할 수 없습니다</p>
                        <button onClick={() => setUseCamera(false)} className="mt-2 text-orange-500 text-sm font-medium">
                          갤러리에서 선택하기
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center py-16 cursor-pointer hover:bg-orange-50 transition-colors"
                  >
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">사진 선택</p>
                    <p className="text-xs text-gray-400 mt-1">영수증 또는 거래명세서</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}
              </div>

              {useCamera && !cameraError && (
                <button
                  onClick={capturePhoto}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl text-base flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  촬영
                </button>
              )}

              <p className="text-xs text-center text-gray-400">
                영수증이나 거래명세서의 거래처 정보가 잘 보이도록 촬영해주세요
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // OCR 결과 확인 후 폼 편집
  if (ocrStep === 'review') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => setOcrStep('camera')} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 flex-1">거래처 정보 확인</h1>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-4 space-y-4">
          {imagePreview && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <img src={imagePreview} alt="촬영 이미지" className="w-full max-h-36 object-contain" />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <p className="text-xs text-blue-700">OCR로 인식된 정보입니다. 내용을 확인하고 수정하세요.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  거래처명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예) OO식품"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자명</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="홍길동"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="육류, 채소..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">결제일 (1~31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.paymentDay}
                    onChange={(e) => setForm({ ...form, paymentDay: e.target.value })}
                    placeholder="25"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="사업자번호, 특이사항 등..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="w-full bg-orange-500 text-white font-semibold py-4 rounded-2xl hover:bg-orange-600 disabled:bg-orange-300 transition-colors"
            >
              {submitting ? '등록 중...' : '거래처 등록'}
            </button>

            <button
              type="button"
              onClick={() => setOcrStep('camera')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-2xl text-sm"
            >
              다시 촬영
            </button>
          </form>
        </div>
      </div>
    )
  }

  // 메인 목록 화면
  return (
    <div className="px-4 py-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">거래처 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={openOcr}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            사진 등록
          </button>
          <button
            onClick={openAdd}
            className="text-sm px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium"
          >
            + 직접 추가
          </button>
        </div>
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
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 space-y-4">
          <p className="text-4xl">🏪</p>
          <p>등록된 거래처가 없습니다.</p>
          <button
            onClick={openOcr}
            className="mx-auto flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            영수증/명세서로 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{supplier.name}</span>
                    {supplier.category && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {supplier.category}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {supplier.contactName && (
                      <p className="text-xs text-gray-500">담당자: {supplier.contactName}</p>
                    )}
                    {supplier.phone && (
                      <p className="text-xs text-gray-500">
                        📞{' '}
                        <a href={`tel:${supplier.phone}`} className="text-blue-500">
                          {supplier.phone}
                        </a>
                      </p>
                    )}
                    {supplier.paymentDay && (
                      <p className="text-xs text-gray-400">결제일: 매월 {supplier.paymentDay}일</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(supplier)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id, supplier.name)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-medium"
                    >
                      삭제
                    </button>
                  </div>
                  {supplier.monthlyAmount !== undefined && supplier.monthlyAmount > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{thisMonthLabel} 지출</p>
                      <p className="text-sm font-bold text-orange-600">
                        {supplier.monthlyAmount.toLocaleString()}원
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {supplier.note && (
                <p className="mt-2 text-xs text-gray-400 border-t border-gray-50 pt-2">
                  {supplier.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 직접 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? '거래처 수정' : '거래처 직접 추가'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setError('') }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  거래처명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예) OO식품"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자명</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="홍길동"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="육류, 채소, 음료..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">결제일 (1~31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.paymentDay}
                    onChange={(e) => setForm({ ...form, paymentDay: e.target.value })}
                    placeholder="25"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="특이사항 등..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? '저장 중...' : editTarget ? '수정 완료' : '거래처 추가'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
