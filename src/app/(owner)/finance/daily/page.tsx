'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CalendarSalesOcr from '@/components/owner/CalendarSalesOcr'

interface ExpenseItem {
  id: string
  category: 'INGREDIENT' | 'WAGE' | 'UTILITY' | 'RENT' | 'EQUIPMENT' | 'OTHER'
  amount: number
  description: string | null
  supplier?: { name: string } | null
  expenseDate: string
}

interface SaleData {
  id: string
  amount: number
  cashAmount: number
  cardAmount: number
  deliveryAmount: number
  note: string | null
}

interface FixedExpenseItem {
  id: string
  name: string
  category: string
  amount: number
  isDailyCalc: boolean
}

interface WageEmployee {
  id: string
  name: string
  monthlyWage: number
}

interface DailySummary {
  sales: number
  expenses: number
  netProfit: number
  ingredientCost: number
  wageCost: number
  fixedCost: number
  otherCost: number
  fixedDailyTotal: number
}

const CATEGORY_LABEL: Record<string, string> = {
  INGREDIENT: '식재료',
  WAGE: '인건비',
  UTILITY: '공과금',
  RENT: '임대료',
  EQUIPMENT: '설비',
  OTHER: '기타',
}

const CATEGORY_COLOR: Record<string, string> = {
  INGREDIENT: 'bg-orange-100 text-orange-700',
  WAGE: 'bg-blue-100 text-blue-700',
  UTILITY: 'bg-yellow-100 text-yellow-700',
  RENT: 'bg-purple-100 text-purple-700',
  EQUIPMENT: 'bg-gray-100 text-gray-700',
  OTHER: 'bg-green-100 text-green-700',
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`
}

export default function DailyFinancePage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [summary, setSummary] = useState<DailySummary>({
    sales: 0, expenses: 0, netProfit: 0,
    ingredientCost: 0, wageCost: 0, fixedCost: 0, otherCost: 0,
    fixedDailyTotal: 0,
  })
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>([])
  const [wageEmployees, setWageEmployees] = useState<WageEmployee[]>([])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [sale, setSale] = useState<SaleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [saleForm, setSaleForm] = useState({
    amount: '',
    cashAmount: '',
    cardAmount: '',
    deliveryAmount: '',
    note: '',
  })
  const [savingNow, setSavingNow] = useState(false)

  // 엑셀/CSV 업로드
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCalendarOcr, setShowCalendarOcr] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSource, setUploadSource] = useState<'AUTO' | 'POS' | 'BAEMIN' | 'COUPANG_EATS' | 'YOGIYO'>('AUTO')
  const [uploadReplaceExisting, setUploadReplaceExisting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    sheets: { name: string; source: string; days: number; skippedRows: number; parsed: boolean; reason?: string }[]
    totalDays: number
    upserted: number
    merged: number
    dateRange: { start: string; end: string }
    skipped: { sheet: string; row: number; reason: string }[]
  } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // 사진 OCR 입력
  const ocrFileInputRef = useRef<HTMLInputElement>(null)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrSource, setOcrSource] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [expRes, saleRes, fixedRes] = await Promise.all([
        fetch(`/api/expenses?date=${selectedDate}`),
        fetch(`/api/sales?date=${selectedDate}`),
        fetch('/api/fixed-expenses'),
      ])

      const expData = expRes.ok ? await expRes.json() : { expenses: [] }
      const saleData = saleRes.ok ? await saleRes.json() : { sales: [] }
      const fixedData = fixedRes.ok ? await fixedRes.json() : { fixedExpenses: [], wageEmployees: [], totalWages: 0 }

      const expList: ExpenseItem[] = expData.expenses || []
      const saleItem: SaleData | null = saleData.sales?.[0] || null
      const fixedList: FixedExpenseItem[] = fixedData.fixedExpenses || []
      const wageList: WageEmployee[] = fixedData.wageEmployees || []
      const totalWages: number = fixedData.totalWages || 0

      setExpenses(expList)
      setSale(saleItem)
      setFixedExpenses(fixedList)
      setWageEmployees(wageList)

      // 해당 월의 총 날짜 수 계산
      const [y, m] = selectedDate.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()

      // 모든 고정비용의 일일 금액 (일할계산) + 월급제 직원 월급 일할
      const fixedDailyTotal = fixedList
        .reduce((s: number, f: FixedExpenseItem) => s + Math.round(f.amount / daysInMonth), 0)
        + Math.round(totalWages / daysInMonth)

      const totalExpenses = expList.reduce((s: number, e: ExpenseItem) => s + e.amount, 0)
      const totalWithFixed = totalExpenses + fixedDailyTotal
      const totalSales = saleItem?.amount ?? 0

      setSummary({
        sales: totalSales,
        expenses: totalWithFixed,
        netProfit: totalSales - totalWithFixed,
        ingredientCost: expList.filter((e) => e.category === 'INGREDIENT').reduce((s, e) => s + e.amount, 0),
        wageCost: expList.filter((e) => e.category === 'WAGE').reduce((s, e) => s + e.amount, 0),
        fixedCost: expList.filter((e) => ['UTILITY', 'RENT', 'EQUIPMENT'].includes(e.category)).reduce((s, e) => s + e.amount, 0),
        otherCost: expList.filter((e) => e.category === 'OTHER').reduce((s, e) => s + e.amount, 0),
        fixedDailyTotal,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  const openSaleModal = () => {
    if (sale) {
      setSaleForm({
        amount: String(sale.amount),
        cashAmount: String(sale.cashAmount),
        cardAmount: String(sale.cardAmount),
        deliveryAmount: String(sale.deliveryAmount),
        note: sale.note ?? '',
      })
    } else {
      setSaleForm({ amount: '', cashAmount: '', cardAmount: '', deliveryAmount: '', note: '' })
    }
    setShowSaleModal(true)
  }

  const handleOcrPickFile = () => {
    setOcrError(null)
    ocrFileInputRef.current?.click()
  }

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 다시 선택 가능하도록
    if (!file) return
    setOcrProcessing(true)
    setOcrError(null)
    setOcrConfidence(null)
    setOcrSource(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const result = ev.target?.result as string
          const b64 = result.split(',')[1]
          resolve(b64)
        }
        reader.onerror = () => reject(new Error('파일 읽기 실패'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/sales/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const json = await res.json()
      if (!res.ok) {
        setOcrError(json.error ?? 'OCR 실패')
        return
      }
      const p = json.parsed as {
        date: string | null
        totalAmount: number
        cashAmount: number
        cardAmount: number
        deliveryAmount: number
        source: string
        confidence: number
      }

      // OCR 인식 날짜가 있으면 선택 날짜로 반영 (오늘보다 미래면 무시)
      if (p.date) {
        const today = formatDate(new Date())
        if (p.date <= today) setSelectedDate(p.date)
      }

      // 폼 자동 채우기 (기존 값 덮어쓰기)
      setSaleForm({
        amount: String(p.totalAmount || ''),
        cashAmount: String(p.cashAmount || ''),
        cardAmount: String(p.cardAmount || ''),
        deliveryAmount: String(p.deliveryAmount || ''),
        note: '',
      })
      setOcrConfidence(p.confidence)
      setOcrSource(p.source)
    } catch (err) {
      setOcrError((err as Error).message ?? 'OCR 처리 중 오류')
    } finally {
      setOcrProcessing(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('source', uploadSource)
      fd.append('replaceExisting', String(uploadReplaceExisting))
      const res = await fetch('/api/sales/bulk', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? '업로드 실패')
        return
      }
      setUploadResult({
        sheets: json.sheets ?? [],
        totalDays: json.totalDays ?? 0,
        upserted: json.upserted,
        merged: json.merged,
        dateRange: json.dateRange,
        skipped: json.skipped ?? [],
      })
      setUploadFile(null)
      await fetchData()
    } catch (e) {
      setUploadError((e as Error).message ?? '업로드 중 오류')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveSale = async () => {
    const amount = Number(saleForm.amount.replace(/,/g, ''))
    if (!amount) return
    setSavingNow(true)
    try {
      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleDate: selectedDate,
          amount,
          cashAmount: Number(saleForm.cashAmount.replace(/,/g, '')) || 0,
          cardAmount: Number(saleForm.cardAmount.replace(/,/g, '')) || 0,
          deliveryAmount: Number(saleForm.deliveryAmount.replace(/,/g, '')) || 0,
          note: saleForm.note || null,
        }),
      })
      setShowSaleModal(false)
      await fetchData()
    } finally {
      setSavingNow(false)
    }
  }

  const groupedExpenses: Record<string, ExpenseItem[]> = {
    INGREDIENT: [],
    WAGE: [],
    UTILITY: [],
    RENT: [],
    EQUIPMENT: [],
    OTHER: [],
  }
  expenses.forEach((e) => {
    if (groupedExpenses[e.category]) groupedExpenses[e.category].push(e)
    else groupedExpenses.OTHER.push(e)
  })

  const profitColor = summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-500'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex-1">일별 손익</h1>
          <button
            onClick={() => {
              setUploadResult(null)
              setUploadError(null)
              setUploadFile(null)
              setUploadSource('AUTO')
              setUploadReplaceExisting(false)
              setShowUploadModal(true)
            }}
            className="bg-white border border-orange-300 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            📥 POS
          </button>
          <button
            onClick={() => setShowCalendarOcr(true)}
            className="bg-white border border-purple-300 text-purple-600 text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            📅 달력
          </button>
          <button
            onClick={openSaleModal}
            className="bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            매출 입력
          </button>
        </div>
      </div>

      {showCalendarOcr && <CalendarSalesOcr onClose={() => setShowCalendarOcr(false)} />}

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 날짜 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">날짜 선택</label>
          <input
            type="date"
            value={selectedDate}
            max={formatDate(new Date())}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">{formatDisplayDate(selectedDate)}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 요약 카드 3개 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">매출</p>
                <p className="text-base font-bold text-gray-900 truncate">{formatCurrency(summary.sales)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">지출</p>
                <p className="text-base font-bold text-red-500 truncate">{formatCurrency(summary.expenses)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">순이익</p>
                <p className={`text-base font-bold truncate ${profitColor}`}>{formatCurrency(summary.netProfit)}</p>
              </div>
            </div>

            {/* 매출 상세 (있을 때만) */}
            {sale && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-800">매출 상세</h2>
                  <button onClick={openSaleModal} className="text-xs text-orange-500 font-medium">수정</button>
                </div>
                <div className="space-y-2">
                  {[
                    { label: '현금', value: sale.cashAmount },
                    { label: '카드', value: sale.cardAmount },
                    { label: '배달', value: sale.deliveryAmount },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-800">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  {sale.note && (
                    <p className="text-xs text-gray-400 pt-1 border-t border-gray-50">{sale.note}</p>
                  )}
                </div>
              </div>
            )}

            {/* 지출 카테고리별 요약 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">지출 카테고리별 요약</h2>
              <div className="space-y-2">
                {[
                  { key: 'INGREDIENT', label: '식재료', value: summary.ingredientCost },
                  { key: 'WAGE', label: '인건비', value: summary.wageCost },
                  { key: 'FIXED', label: '고정비', value: summary.fixedCost },
                  { key: 'WAGE_MONTHLY', label: '인건비(월급)', value: (() => {
                    const [y, m] = selectedDate.split('-').map(Number)
                    const daysInMonth = new Date(y, m, 0).getDate()
                    const totalWages = wageEmployees.reduce((s, e) => s + e.monthlyWage, 0)
                    return Math.round(totalWages / daysInMonth)
                  })() },
                  { key: 'FIXED_DAILY', label: '고정비(일할)', value: summary.fixedDailyTotal },
                  { key: 'OTHER', label: '기타', value: summary.otherCost },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <div className="flex-1 flex justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-800">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="w-24 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-orange-400 h-1.5 rounded-full"
                        style={{ width: summary.expenses ? `${Math.min(100, (item.value / summary.expenses) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 지출 목록 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">지출 내역</h2>
                <button
                  onClick={() => router.push('/finance/expenses/receipt')}
                  className="text-xs text-orange-500 font-medium"
                >
                  + 영수증 추가
                </button>
              </div>

              {expenses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">지출 내역이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLOR[expense.category] || CATEGORY_COLOR.OTHER}`}>
                        {CATEGORY_LABEL[expense.category] || '기타'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          {expense.description || expense.supplier?.name || '내역 없음'}
                        </p>
                        {expense.supplier && expense.description && (
                          <p className="text-xs text-gray-400">{expense.supplier.name}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 shrink-0">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 고정비용 일할 내역 */}
            {(fixedExpenses.length > 0 || wageEmployees.length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-800">고정비용 (일할계산)</h2>
                  <span className="text-xs text-gray-400">
                    {(() => {
                      const [y, m] = selectedDate.split('-').map(Number)
                      return new Date(y, m, 0).getDate()
                    })()}일 기준
                  </span>
                </div>
                <div className="space-y-2">
                  {fixedExpenses
                    .map((f) => {
                      const [y, m] = selectedDate.split('-').map(Number)
                      const daysInMonth = new Date(y, m, 0).getDate()
                      const dailyAmount = Math.round(f.amount / daysInMonth)
                      return (
                        <div key={f.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLOR[f.category] || CATEGORY_COLOR.OTHER}`}>
                            {CATEGORY_LABEL[f.category] || '기타'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400">
                              월 {formatCurrency(f.amount)} / {daysInMonth}일
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 shrink-0">
                            {formatCurrency(dailyAmount)}
                          </span>
                        </div>
                      )
                    })}
                  {/* 월급제 직원 인건비 */}
                  {wageEmployees.map((emp) => {
                    const [y, m] = selectedDate.split('-').map(Number)
                    const daysInMonth = new Date(y, m, 0).getDate()
                    const dailyWage = Math.round(emp.monthlyWage / daysInMonth)
                    return (
                      <div key={`wage-${emp.id}`} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-blue-100 text-blue-700">
                          월급
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{emp.name}</p>
                          <p className="text-xs text-gray-400">
                            월 {formatCurrency(emp.monthlyWage)} / {daysInMonth}일
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                          {formatCurrency(dailyWage)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between pt-3 mt-2 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">일할 합계</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(summary.fixedDailyTotal)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 매출 입력 모달 */}
      {showSaleModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)] overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">매출 {sale ? '수정' : '입력'}</h3>
              <button onClick={() => setShowSaleModal(false)} className="p-1 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-gray-500">{formatDisplayDate(selectedDate)}</p>

            {/* OCR 촬영/업로드 */}
            <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOcrPickFile}
                  disabled={ocrProcessing}
                  className="flex-1 bg-white border border-orange-400 text-orange-600 text-xs font-semibold py-2 rounded-lg disabled:opacity-60"
                >
                  {ocrProcessing ? '🧠 인식 중...' : '📷 POS 화면 사진으로 자동 입력'}
                </button>
                <input
                  ref={ocrFileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleOcrFile}
                  className="hidden"
                />
              </div>
              {ocrConfidence !== null && !ocrProcessing && (
                <p className="text-[11px] text-gray-600">
                  {ocrSource && ocrSource !== 'UNKNOWN' && (
                    <span className="mr-2 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">
                      {ocrSource === 'POS' ? 'POS' :
                       ocrSource === 'BAEMIN' ? '배민' :
                       ocrSource === 'COUPANG_EATS' ? '쿠팡이츠' :
                       ocrSource === 'YOGIYO' ? '요기요' : ocrSource}
                    </span>
                  )}
                  신뢰도 {Math.round(ocrConfidence * 100)}%
                  {ocrConfidence < 0.7 && (
                    <span className="text-amber-600 ml-1">⚠ 값 꼭 확인해주세요</span>
                  )}
                </p>
              )}
              {ocrError && (
                <p className="text-[11px] text-rose-600">{ocrError}</p>
              )}
            </div>

            {[
              { label: '총 매출액', key: 'amount', required: true },
              { label: '현금', key: 'cashAmount', required: false },
              { label: '카드', key: 'cardAmount', required: false },
              { label: '배달', key: 'deliveryAmount', required: false },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-orange-500">*</span>}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={(saleForm as Record<string, string>)[field.key]}
                  onChange={(e) => setSaleForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <input
                type="text"
                value={saleForm.note}
                onChange={(e) => setSaleForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="선택 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <button
              onClick={handleSaveSale}
              disabled={savingNow || !saleForm.amount}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm"
            >
              {savingNow ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* POS/배달앱 매출 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)] overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">매출 엑셀/CSV 업로드</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              POS 프로그램이나 배달앱(배민/쿠팡이츠/요기요)에서 내보낸 엑셀·CSV 파일을 업로드하면
              날짜별로 자동 집계해서 매출에 반영합니다. 같은 날짜 여러 행은 자동 합산.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">소스 선택</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { v: 'AUTO', label: '자동 감지', icon: '🔎' },
                    { v: 'POS', label: '일반 POS', icon: '🧾' },
                    { v: 'BAEMIN', label: '배민', icon: '🛵' },
                    { v: 'COUPANG_EATS', label: '쿠팡이츠', icon: '🛵' },
                    { v: 'YOGIYO', label: '요기요', icon: '🛵' },
                  ] as const
                ).map((opt) => {
                  const active = uploadSource === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setUploadSource(opt.v)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition ${
                        active
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      <span className="mr-1">{opt.icon}</span>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                배달앱 선택 시 전액 배달매출로 집계됩니다. (같은 날 일반 POS 매출이 이미 있으면 배달 부분만 병합)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">파일 (.xlsx / .xls / .csv)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-white file:text-xs file:font-semibold hover:file:bg-orange-600"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={uploadReplaceExisting}
                onChange={(e) => setUploadReplaceExisting(e.target.checked)}
                className="h-4 w-4 rounded accent-orange-500"
              />
              업로드 범위 내 기존 매출을 완전히 덮어쓰기
              <span className="text-[11px] text-gray-400">(배달앱도 포함)</span>
            </label>

            {uploadError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs px-3 py-2">
                {uploadError}
              </div>
            )}

            {uploadResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs px-3 py-2 space-y-1.5">
                <p className="font-semibold">
                  ✅ {uploadResult.sheets.filter((s) => s.parsed).length}개 시트 / 총 {uploadResult.totalDays}일 집계
                </p>
                <p>
                  기간: {uploadResult.dateRange.start} ~ {uploadResult.dateRange.end}
                </p>
                <p>
                  신규/덮어쓰기: {uploadResult.upserted}건, 병합: {uploadResult.merged}건
                </p>
                <ul className="mt-1 pl-3 space-y-0.5 text-[11px] text-emerald-900/80">
                  {uploadResult.sheets.map((s, i) => (
                    <li key={i}>
                      {s.parsed ? '📄' : '⏭'} <strong>{s.name}</strong>{' '}
                      <span className="text-emerald-700">[{s.source === 'BAEMIN' ? '배민' : s.source === 'COUPANG_EATS' ? '쿠팡이츠' : s.source === 'YOGIYO' ? '요기요' : s.source}]</span>
                      {s.parsed ? ` · ${s.days}일${s.skippedRows > 0 ? ` · 스킵 ${s.skippedRows}` : ''}` : ` · ${s.reason ?? '스킵'}`}
                    </li>
                  ))}
                </ul>
                {uploadResult.skipped.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-amber-700">
                      ⚠ 건너뛴 행 {uploadResult.skipped.length}개
                    </summary>
                    <ul className="mt-1 pl-4 list-disc space-y-0.5">
                      {uploadResult.skipped.slice(0, 10).map((s, i) => (
                        <li key={i}>
                          [{s.sheet}] {s.row}행: {s.reason}
                        </li>
                      ))}
                      {uploadResult.skipped.length > 10 && (
                        <li className="text-gray-500">
                          외 {uploadResult.skipped.length - 10}개
                        </li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm"
            >
              {uploading ? '업로드 중...' : '⬆ 업로드'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
