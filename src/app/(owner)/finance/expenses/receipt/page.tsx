'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { useRouter } from 'next/navigation'
import type { ParsedReceipt } from '@/lib/receipt-parser'

interface Supplier {
  id: string
  name: string
}

interface EditableItem {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

type Step = 'capture' | 'processing' | 'review' | 'saving'

export default function ReceiptOCRPage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('capture')
  const [useCamera, setUseCamera] = useState(true)
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // 수정 가능한 폼 상태
  const [editTotal, setEditTotal] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editItems, setEditItems] = useState<EditableItem[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [supplierInput, setSupplierInput] = useState('')
  const [autoInventory, setAutoInventory] = useState(true)
  const [expenseCategory, setExpenseCategory] = useState('INGREDIENT')
  const [description, setDescription] = useState('')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState(false)

  // 거래처 목록 로드
  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => r.ok ? r.json() : { suppliers: [] })
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
  }, [])

  const processImage = useCallback(async (base64: string) => {
    setStep('processing')
    setError(null)
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

      // 폼 초기화
      setEditTotal(String(parsed.total || ''))
      setEditDate(parsed.date || new Date().toISOString().slice(0, 10))
      setEditItems(parsed.items.map((item) => ({ ...item })))
      setSupplierInput(parsed.supplierName || '')

      // 거래처 자동 매칭
      if (parsed.supplierName) {
        const found = suppliers.find((s) =>
          s.name.includes(parsed.supplierName!) || parsed.supplierName!.includes(s.name)
        )
        if (found) setSelectedSupplierId(found.id)
      }

      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR 처리 중 오류가 발생했습니다')
      setStep('capture')
    }
  }, [suppliers])

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return
    // base64에서 data:image/jpeg;base64, 제거
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
      const base64 = result.split(',')[1]
      processImage(base64)
    }
    reader.readAsDataURL(file)
  }, [processImage])

  const handleSave = async () => {
    setStep('saving')
    setError(null)
    try {
      const supplierId = selectedSupplierId || null
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          supplierId,
          supplierName: supplierId ? undefined : (supplierInput || undefined),
          category: expenseCategory,
          amount: Number(editTotal) || 0,
          expenseDate: editDate,
          description: description || undefined,
          autoInventory,
          items: editItems,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '저장 실패')
      }

      router.push('/finance/daily')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다')
      setStep('review')
    }
  }

  const updateItem = (idx: number, field: keyof EditableItem, value: string | number) => {
    setEditItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const removeItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addItem = () => {
    setEditItems((prev) => [...prev, { name: '', quantity: 1, unit: '개', unitPrice: 0, totalPrice: 0 }])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => step === 'review' ? setStep('capture') : router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">
            {step === 'capture' ? '영수증 촬영' : step === 'processing' ? 'OCR 분석 중' : '내용 확인'}
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 촬영 단계 */}
        {step === 'capture' && (
          <div className="space-y-4">
            {/* 카메라 / 갤러리 탭 */}
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
                        screenshotQuality={0.9}
                        videoConstraints={{ facingMode: { ideal: 'environment' }, aspectRatio: 4 / 3 }}
                        onUserMediaError={() => setCameraError(true)}
                        className="w-full rounded-none"
                      />
                      {/* 가이드 오버레이 */}
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
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG 파일</p>
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

            {/* 촬영 버튼 */}
            {useCamera && !cameraError && (
              <button
                onClick={capturePhoto}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl text-base flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                영수증 촬영
              </button>
            )}

            <p className="text-xs text-center text-gray-400">
              영수증이 밝고 선명하게 나오도록 촬영해주세요
            </p>
          </div>
        )}

        {/* OCR 처리 중 */}
        {step === 'processing' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4">
            {imagePreview && (
              <img src={imagePreview} alt="영수증" className="w-full max-h-48 object-contain rounded-xl opacity-60" />
            )}
            <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">영수증 분석 중...</p>
              <p className="text-xs text-gray-400 mt-1">텍스트를 인식하고 있습니다</p>
            </div>
          </div>
        )}

        {/* 리뷰 단계 */}
        {step === 'review' && parsedReceipt && (
          <div className="space-y-4">
            {/* 미리보기 */}
            {imagePreview && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <img src={imagePreview} alt="영수증" className="w-full max-h-40 object-contain" />
              </div>
            )}

            {/* 기본 정보 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>

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

              <div>
                <label className="block text-xs text-gray-500 mb-1">지출 카테고리</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  <option value="INGREDIENT">식재료</option>
                  <option value="WAGE">인건비</option>
                  <option value="UTILITY">공과금</option>
                  <option value="RENT">임대료</option>
                  <option value="EQUIPMENT">설비</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">메모</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="선택 입력"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            {/* 거래처 선택 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">거래처</h2>

              {suppliers.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">등록된 거래처 선택</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value)
                      if (e.target.value) {
                        const s = suppliers.find((s) => s.id === e.target.value)
                        if (s) setSupplierInput(s.name)
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  >
                    <option value="">선택 안함</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {!selectedSupplierId && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {parsedReceipt.supplierName ? 'OCR 인식 거래처' : '거래처명 직접 입력'}
                  </label>
                  <input
                    type="text"
                    value={supplierInput}
                    onChange={(e) => setSupplierInput(e.target.value)}
                    placeholder="거래처명 입력"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}
            </div>

            {/* 품목 목록 */}
            {editItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-800">품목 목록</h2>
                  <button onClick={addItem} className="text-xs text-orange-500 font-medium">+ 추가</button>
                </div>

                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                          placeholder="품목명"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white mr-2"
                        />
                        <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
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
                        <div>
                          <label className="text-xs text-gray-400">금액</label>
                          <input
                            type="number"
                            value={item.totalPrice}
                            onChange={(e) => updateItem(idx, 'totalPrice', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {editItems.length === 0 && (
                  <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors">
                    + 품목 추가
                  </button>
                )}
              </div>
            )}

            {/* 재고 자동 입고 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">재고 자동 입고</p>
                  <p className="text-xs text-gray-400 mt-0.5">품목을 재고에 자동으로 반영합니다</p>
                </div>
                <button
                  onClick={() => setAutoInventory((v) => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${autoInventory ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoInventory ? 'translate-x-6' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={!editTotal || step === 'saving'}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-4 rounded-2xl text-base"
            >
              {step === 'saving' ? '저장 중...' : '확인 및 저장'}
            </button>

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
