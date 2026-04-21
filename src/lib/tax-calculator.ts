import { prisma } from '@/lib/prisma'

/**
 * 세무 계산 라이브러리 (일반과세자 기준, 대한민국 2026년)
 *
 * 가정:
 * - Sale.amount 는 부가세 포함가(공급대가)로 저장
 * - Expense.amount 도 부가세 포함가로 저장
 * - 부가세율 10% → 포함가에서 추출 시 × 10/110
 */

export const VAT_RATE = 0.1
export const VAT_EXTRACT = 10 / 110

// 신용카드매출세액공제: 음식점업 1.3%, 연 1000만원 한도
export const CARD_DEDUCTION_RATE = 0.013
export const CARD_DEDUCTION_ANNUAL_LIMIT = 10_000_000

// 종합소득세 누진세율표 (2026년 기준)
// [과세표준 상한, 세율, 누진공제]
const INCOME_TAX_BRACKETS: Array<[number, number, number]> = [
  [14_000_000, 0.06, 0],
  [50_000_000, 0.15, 1_260_000],
  [88_000_000, 0.24, 5_760_000],
  [150_000_000, 0.35, 15_440_000],
  [300_000_000, 0.38, 19_940_000],
  [500_000_000, 0.40, 25_940_000],
  [1_000_000_000, 0.42, 35_940_000],
  [Infinity, 0.45, 65_940_000],
]

export interface VatBreakdown {
  grossSales: number // 총 매출 (부가세 포함)
  supplyAmount: number // 공급가액 (부가세 제외)
  salesVat: number // 매출세액
  grossPurchases: number // 공제대상 매입 합계 (부가세 포함)
  purchaseVat: number // 매입세액
  cardSales: number // 카드+배달 매출 합계
  cardDeduction: number // 신용카드매출세액공제(1.3%)
  expectedVat: number // 최종 납부예상 부가세
}

export interface IncomeTaxBreakdown {
  revenue: number // 연 매출 (부가세 제외, 공급가액 기준)
  totalExpenses: number // 연 경비 (부가세 제외)
  taxableIncome: number // 과세표준
  appliedRate: number // 적용 최고세율
  estimatedTax: number // 예상 종합소득세
  localTax: number // 지방소득세 10%
}

function extractVat(vatIncluded: number): number {
  return Math.round(vatIncluded * VAT_EXTRACT)
}

function supplyOnly(vatIncluded: number): number {
  return vatIncluded - extractVat(vatIncluded)
}

/**
 * 특정 기간의 부가세 계산
 */
export async function calculateVat(
  restaurantId: string,
  startDate: Date,
  endDate: Date,
  opts?: { cardDeductionUsedThisYear?: number }
): Promise<VatBreakdown> {
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        restaurantId,
        saleDate: { gte: startDate, lt: endDate },
      },
    }),
    prisma.expense.findMany({
      where: {
        restaurantId,
        expenseDate: { gte: startDate, lt: endDate },
        isVatDeductible: true,
      },
    }),
  ])

  const grossSales = sales.reduce((s, x) => s + x.amount, 0)
  const cardSales = sales.reduce((s, x) => s + x.cardAmount + x.deliveryAmount, 0)
  const grossPurchases = expenses.reduce((s, x) => s + x.amount, 0)

  const salesVat = extractVat(grossSales)
  const supplyAmount = grossSales - salesVat
  const purchaseVat = extractVat(grossPurchases)

  // 신용카드매출세액공제 (연 한도 체크)
  const used = opts?.cardDeductionUsedThisYear ?? 0
  const remainingLimit = Math.max(0, CARD_DEDUCTION_ANNUAL_LIMIT - used)
  const cardDeduction = Math.min(
    Math.round(cardSales * CARD_DEDUCTION_RATE),
    remainingLimit
  )

  const expectedVat = Math.max(0, salesVat - purchaseVat - cardDeduction)

  return {
    grossSales,
    supplyAmount,
    salesVat,
    grossPurchases,
    purchaseVat,
    cardSales,
    cardDeduction,
    expectedVat,
  }
}

/**
 * 특정 날짜 하루의 부가세
 */
export async function calculateDailyVat(restaurantId: string, date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return calculateVat(restaurantId, start, end)
}

/**
 * 특정 월의 부가세
 */
export async function calculateMonthlyVat(
  restaurantId: string,
  year: number,
  month: number // 1-12
) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return calculateVat(restaurantId, start, end)
}

/**
 * 분기 부가세 (1분기: 1~3월, 2분기: 4~6월 ...)
 * 신고일: 1기확정 7/25, 2기확정 1/25
 */
export async function calculateQuarterlyVat(
  restaurantId: string,
  year: number,
  quarter: 1 | 2 | 3 | 4
) {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 1)
  return calculateVat(restaurantId, start, end)
}

/**
 * 연 누적 예상 종합소득세
 * 단순추정: 공급가액(부가세 제외) 매출 - 공급가액 경비 = 과세표준으로 가정
 * (실제로는 기본공제/세액공제 등 추가되지만 사업자 추정치로 충분)
 */
export async function calculateEstimatedIncomeTax(
  restaurantId: string,
  year: number,
  upToDate?: Date
): Promise<IncomeTaxBreakdown> {
  const start = new Date(year, 0, 1)
  const end = upToDate ?? new Date(year + 1, 0, 1)

  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { restaurantId, saleDate: { gte: start, lt: end } },
    }),
    prisma.expense.findMany({
      where: { restaurantId, expenseDate: { gte: start, lt: end } },
    }),
  ])

  // 공급가액 기준으로 환산
  const revenue = sales.reduce((s, x) => s + supplyOnly(x.amount), 0)
  const totalExpenses = expenses.reduce((s, x) => {
    // 인건비 등 부가세 없는 항목은 전액 경비
    if (x.category === 'WAGE') return s + x.amount
    return s + supplyOnly(x.amount)
  }, 0)

  const taxableIncome = Math.max(0, revenue - totalExpenses)

  let estimatedTax = 0
  let appliedRate = 0
  for (const [limit, rate, deduction] of INCOME_TAX_BRACKETS) {
    if (taxableIncome <= limit) {
      estimatedTax = Math.round(taxableIncome * rate - deduction)
      appliedRate = rate
      break
    }
  }
  estimatedTax = Math.max(0, estimatedTax)
  const localTax = Math.round(estimatedTax * 0.1)

  return {
    revenue,
    totalExpenses,
    taxableIncome,
    appliedRate,
    estimatedTax,
    localTax,
  }
}

/**
 * 다음 부가세 신고일까지 남은 일수
 * 일반과세자: 4/25(1기예정), 7/25(1기확정), 10/25(2기예정), 1/25(2기확정)
 */
export function nextVatFilingDate(today = new Date()): { label: string; date: Date; daysLeft: number } {
  const y = today.getFullYear()
  const candidates = [
    { label: '1기 예정신고', date: new Date(y, 3, 25) },
    { label: '1기 확정신고', date: new Date(y, 6, 25) },
    { label: '2기 예정신고', date: new Date(y, 9, 25) },
    { label: '2기 확정신고', date: new Date(y + 1, 0, 25) },
  ]
  for (const c of candidates) {
    if (c.date >= today) {
      const daysLeft = Math.ceil(
        (c.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      return { ...c, daysLeft }
    }
  }
  const fallback = candidates[candidates.length - 1]
  return { ...fallback, daysLeft: 0 }
}
