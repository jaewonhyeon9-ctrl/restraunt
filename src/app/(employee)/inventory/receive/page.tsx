'use client'

import { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useRouter } from 'next/navigation'
import type { ParsedReceipt } from '@/lib/receipt-parser'

interface EditableItem {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

interface DuplicateInfo {
  receiptId: string
  status?: string
  hasExpense?: boolean
  amount: number | null
  expenseDate: string | Date | null
}

type Step = 'capture' | 'processing' | 'review' | 'saving'

const fmtDate = (d: string | Date | null) => {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  } catch {
    return String(d)
  }
}

export default function EmployeeReceivePage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [useCamera, setUseCamera] = useState(true)
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [editTotal, setEditTotal] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editItems, setEditItems] = useState<EditableItem[]>([])
  const [supplierInput, setSupplierInput] = useState('')

  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [success, setSuccess] = useState(false)

  const processImage = useCallback(async (base64: string) => {
    setStep('processing')
    setError(null)
    setDuplicate(null)
    try {
      const res = await fetch('/api/expenses/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'OCR 처리 실패')
      }
      const data = await res.json()
      const parsed: ParsedReceipt = data.parsed
      setReceiptId(data.receiptId || null)
      setParsedReceipt(parsed)
      setEditTotal(String(parsed.total || ''))
      setEditDate(parsed.date || new Date().toISOString().slice(0, 10))
      setEditItems(parsed.items.map((item) => ({ ...item })))
      setSupplierInput(parsed.supplierName || '')
      // OCR 단계에서 이미 동일 영수증이 등록돼 있으면 경고
      if (data.duplicate && data.duplicate.hasExpense) {
        setDuplicate(data.duplicate)
      }
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR 처리 중 오류가 발생했습니다')
      setStep('capture')
    }
  }, [])

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    const base64 = imageSrc.split(',')[1]
    setImagePreview(imageSrc)
    processImage(base64)
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

  const handleSave = async (force = false) => {
    setStep('saving')
    setError(null)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          supplierName: supplierInput || undefined,
          category: 'INGREDIENT',
          amount: Number(editTotal) || 0,
          expenseDate: editDate,
          autoInventory: true,
          items: editItems,
          force,
        }),
      })
      if (res.status === 409) {
        const err = await res.json().catch(() => ({}))
        setDuplicate(err.duplicate || { receiptId: '', amount: null, expenseDate: null })
        setError('이미 등록된 거래명세서입니다. 같은 물건을 두 번 입고하지 않도록 막았습니다.')
        setStep('review')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '저장 실패')
      }
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다')
      setStep('review')
    }
  }

  const updateItem = (idx: number, field: keyof EditableItem, value: string | number) => {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }
  const removeItem = (idx: number) => setEditItems((prev) => prev.filter((_, i) => i !== idx))
  const addItem = () =>
    setEditItems((prev) => [...prev, { name: '', quantity: 1, unit: '개', unitPrice: 0, totalPrice: 0 }])

  // 입고 완료 화면
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">📦</div>
        <h1 className="text-xl font-bold text-gray-900">입고 등록 완료!</h1>
        <p className="text-sm text-gray-500">
          {editItems.length}개 품목이 재고에 반영됐어요.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button
            onClick={() => {
              setSuccess(false)
              setStep('capture')
              setImagePreview(null)
              setParsedReceipt(null)
              setEditItems([])
              setEditTotal('')
              setSupplierInput('')
              setReceiptId(null)
              setDuplicate(null)
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3.5 rounded-2xl"
          >
            계속 입고하기
          </button>
          <button
            onClick={() => router.push('/inventory/check')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-2xl"
          >
            재고 현황 보기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => (step === 'review' ? setStep('capture') : router.back())}
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">
            {step === 'capture' ? '물건 입고 등록' : step === 'processing' ? '명세서 분석 중' : '입고 내용 확인'}
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {step === 'capture' && (
          <p className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
            물건이 도착하면 <b>거래명세서·영수증</b>을 촬영하세요. 품목이 자동으로 재고에 입고됩니다.
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 중복 경고 배너 */}
        {duplicate && (step === 'review') && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-amber-800">⚠️ 이미 등록된 거래명세서일 수 있어요</p>
            <p className="text-xs text-amber-700">
              {fmtDate(duplicate.expenseDate)} ·{' '}
              {duplicate.amount != null ? `${duplicate.amount.toLocaleString()}원` : '동일 내역'}으로 이미 입고된 기록이 있습니다.
              같은 물건을 두 번 등록하면 재고가 부풀려집니다.
            </p>
          </div>
        )}

        {/* 촬영 단계 */}
        {step === 'capture' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setUseCamera(true)}
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
                        screenshotQuality={0.95}
                        forceScreenshotSourceSize
                        videoConstraints={{
                          facingMode: { ideal: 'environment' },
                          width: { ideal: 1920 },
                          height: { ideal: 1440 },
                          aspectRatio: 4 / 3,
                        }}
                        onUserMediaError={() => setCameraError(true)}
                        className="w-full rounded-none"
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="border-2 border-orange-400 rounded-lg w-4/5 h-3/4 opacity-60" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
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
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
              )}
            </div>

            {useCamera && !cameraError && (
              <button
                onClick={capturePhoto}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl text-base"
              >
                거래명세서 촬영
              </button>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4">
            {imagePreview && <img src={imagePreview} alt="명세서" className="w-full max-h-48 object-contain rounded-xl opacity-60" />}
            <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-800">명세서 분석 중...</p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && parsedReceipt && (
          <div className="space-y-4">
            {imagePreview && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <img src={imagePreview} alt="명세서" className="w-full max-h-40 object-contain" />
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>
              <div>
                <label className="block text-xs text-gray-500 mb-1">거래처</label>
                <input
                  type="text"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="거래처명"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">날짜</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">총 금액</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editTotal}
                    onChange={(e) => setEditTotal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">입고 품목 ({editItems.length})</h2>
                <button onClick={addItem} className="text-xs text-orange-500 font-medium">+ 추가</button>
              </div>
              {editItems.length > 0 ? (
                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <textarea
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                          placeholder="품목명"
                          rows={2}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white resize-y"
                        />
                        <button onClick={() => removeItem(idx)} className="shrink-0 p-1 text-gray-400 hover:text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400">수량</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">단위</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
                  + 품목 추가
                </button>
              )}
            </div>

            {duplicate ? (
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/inventory/check')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-2xl"
                >
                  중복이네요, 등록 취소
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={step === 'saving'}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-3.5 rounded-2xl text-sm"
                >
                  {step === 'saving' ? '등록 중...' : '다른 거래입니다 — 그래도 입고'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSave(false)}
                disabled={!editTotal || step === 'saving'}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-4 rounded-2xl text-base"
              >
                {step === 'saving' ? '입고 처리 중...' : '입고 등록'}
              </button>
            )}

            <button
              onClick={() => setStep('capture')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-2xl text-sm"
            >
              다시 촬영
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
