import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

async function requireAuth() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { userId: user.id, restaurantId: user.restaurantId }
}

const HEADER_KEYWORDS = [
  '날짜', '일자', '영업일', '주문일', '주문일자', '거래일', '거래일자', '결제일', '결제일자',
  'date',
  '매출', '매출액', '총매출', '총매출액', '합계', '총액', '판매금액', '결제금액', '정산금액', '실수령액',
  'amount', 'total', 'sales',
  '현금', '카드', '배달', '신용카드', '체크카드',
  'cash', 'card', 'delivery',
  '주문번호', '주문수',
]

const toKey = (v: unknown): string =>
  String(v ?? '').replace(/\s+/g, '').trim().toLowerCase()

function detectHeaderRow(aoa: unknown[][]): number {
  const LIMIT = Math.min(15, aoa.length)
  let best = -1
  let bestHits = 0
  for (let i = 0; i < LIMIT; i++) {
    const row = (aoa[i] ?? []) as unknown[]
    const cells = row.map(toKey).filter(Boolean)
    const hits = cells.filter((c) =>
      HEADER_KEYWORDS.some((k) => c === k.toLowerCase() || c.includes(k.toLowerCase()))
    ).length
    if (hits > bestHits) {
      best = i
      bestHits = hits
    }
  }
  return bestHits >= 2 ? best : -1
}

function findCol(header: string[], ...candidates: string[]): number {
  const norm = header.map(toKey)
  for (const name of candidates) {
    const i = norm.indexOf(name.toLowerCase())
    if (i >= 0) return i
  }
  for (const name of candidates) {
    const i = norm.findIndex((h) => h.includes(name.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

function parseAmount(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return Math.round(raw)
  const s = String(raw).replace(/[,\s₩원]/g, '').trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseDate(raw: unknown): string | null {
  if (raw == null) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return formatYMD(raw)
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) {
      return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
  }
  const s = String(raw).trim()
  if (!s) return null

  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  m = s.match(/^(\d{1,2})[-./](\d{1,2})$/)
  if (m) {
    const [, mo, d] = m
    const y = new Date().getFullYear()
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return formatYMD(dt)
  return null
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Source = 'AUTO' | 'POS' | 'BAEMIN' | 'COUPANG_EATS' | 'YOGIYO'
type ResolvedSource = Exclude<Source, 'AUTO'>

function detectSourceFromName(...names: string[]): ResolvedSource {
  const s = names.join(' ').toLowerCase()
  if (s.includes('배민') || s.includes('baemin') || s.includes('배달의민족')) return 'BAEMIN'
  if (s.includes('쿠팡') || s.includes('coupang')) return 'COUPANG_EATS'
  if (s.includes('요기요') || s.includes('yogiyo')) return 'YOGIYO'
  return 'POS'
}

interface DayAgg {
  amount: number
  cashAmount: number
  cardAmount: number
  deliveryAmount: number
}

interface SheetParseResult {
  perDay: Map<string, DayAgg>
  errors: { row: number; reason: string }[]
  headerFound: boolean
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetSource: ResolvedSource
): SheetParseResult {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  })

  const perDay = new Map<string, DayAgg>()
  const errors: { row: number; reason: string }[] = []

  if (aoa.length === 0) return { perDay, errors, headerFound: false }

  const headerIdx = detectHeaderRow(aoa)
  if (headerIdx < 0) return { perDay, errors, headerFound: false }

  const header = ((aoa[headerIdx] ?? []) as unknown[]).map((c) =>
    String(c ?? '').trim()
  )

  const colDate = findCol(header, '날짜', '일자', '영업일', '주문일자', '주문일', '거래일자', '거래일', '결제일자', '결제일', 'date')
  const colAmount = findCol(
    header,
    '총매출', '총매출액', '총액', '합계',
    '매출액', '매출',
    '결제금액', '판매금액', '정산금액', '실수령액',
    'amount', 'total', 'sales'
  )
  const colCash = findCol(header, '현금', '현금매출', 'cash')
  const colCard = findCol(header, '카드', '카드매출', '신용카드', '체크카드', 'card')
  const colDelivery = findCol(header, '배달', '배달매출', 'delivery')

  if (colDate < 0) return { perDay, errors, headerFound: false }
  if (colAmount < 0 && colCash < 0 && colCard < 0 && colDelivery < 0) {
    return { perDay, errors, headerFound: false }
  }

  const bodyRows = aoa.slice(headerIdx + 1)
  const isDeliverySource =
    sheetSource === 'BAEMIN' || sheetSource === 'COUPANG_EATS' || sheetSource === 'YOGIYO'

  bodyRows.forEach((row, idx) => {
    const rowNum = idx + headerIdx + 2
    const cells = (row ?? []) as unknown[]
    const get = (i: number): unknown => (i >= 0 ? cells[i] ?? null : null)

    const dateStr = parseDate(get(colDate))
    if (!dateStr) return

    const rawAmount = parseAmount(get(colAmount))
    const cashAmt = parseAmount(get(colCash))
    const cardAmt = parseAmount(get(colCard))
    const deliveryAmt = parseAmount(get(colDelivery))

    let amount = rawAmount
    if (amount === 0) amount = cashAmt + cardAmt + deliveryAmt
    if (amount === 0) {
      errors.push({ row: rowNum, reason: '매출 금액이 0 또는 비어있습니다.' })
      return
    }

    // 배달앱 소스 시트 → 전액 배달로 귀속
    let cash = cashAmt
    let card = cardAmt
    let delivery = deliveryAmt
    if (isDeliverySource) {
      delivery = amount
      cash = 0
      card = 0
    }

    const prev = perDay.get(dateStr)
    if (prev) {
      prev.amount += amount
      prev.cashAmount += cash
      prev.cardAmount += card
      prev.deliveryAmount += delivery
    } else {
      perDay.set(dateStr, { amount, cashAmount: cash, cardAmount: card, deliveryAmount: delivery })
    }
  })

  return { perDay, errors, headerFound: true }
}

// POST: 매출 엑셀/CSV 대량 업로드 (다중 시트 지원)
// FormData:
//   file: xlsx/xls/csv
//   source: AUTO | POS | BAEMIN | COUPANG_EATS | YOGIYO (기본 AUTO = 시트별 자동 감지)
//   replaceExisting: 'true' | 'false' — 업로드 범위의 기존 매출 덮어쓰기
export async function POST(req: NextRequest) {
  const ctx = await requireAuth()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const form = await req.formData()
  const file = form.get('file')
  const sourceRaw = (form.get('source') as string | null) ?? 'AUTO'
  const source: Source = (['AUTO', 'POS', 'BAEMIN', 'COUPANG_EATS', 'YOGIYO'] as const).includes(
    sourceRaw as Source
  )
    ? (sourceRaw as Source)
    : 'AUTO'
  const replaceExisting = form.get('replaceExisting') === 'true'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일을 첨부해주세요.' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json(
      { error: '파일을 읽을 수 없습니다. (.xlsx / .xls / .csv 지원)' },
      { status: 400 }
    )
  }

  if (wb.SheetNames.length === 0) {
    return NextResponse.json({ error: '시트를 찾을 수 없습니다.' }, { status: 400 })
  }

  interface SheetReport {
    name: string
    source: ResolvedSource
    days: number
    skippedRows: number
    parsed: boolean
    reason?: string
  }

  const sheetReports: SheetReport[] = []
  const allErrors: { sheet: string; row: number; reason: string }[] = []
  const perDayTotal = new Map<string, DayAgg>()

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    // 시트별 소스: source가 명시적이면 그대로, AUTO면 시트명 + 파일명으로 감지
    const sheetSource: ResolvedSource =
      source === 'AUTO'
        ? detectSourceFromName(sheetName, file.name)
        : source

    const result = parseSheet(sheet, sheetSource)

    if (!result.headerFound) {
      sheetReports.push({
        name: sheetName,
        source: sheetSource,
        days: 0,
        skippedRows: 0,
        parsed: false,
        reason: '헤더/매출 컬럼을 찾지 못했습니다.',
      })
      continue
    }

    // 누적
    for (const [date, agg] of result.perDay) {
      const prev = perDayTotal.get(date)
      if (prev) {
        prev.amount += agg.amount
        prev.cashAmount += agg.cashAmount
        prev.cardAmount += agg.cardAmount
        prev.deliveryAmount += agg.deliveryAmount
      } else {
        perDayTotal.set(date, { ...agg })
      }
    }

    sheetReports.push({
      name: sheetName,
      source: sheetSource,
      days: result.perDay.size,
      skippedRows: result.errors.length,
      parsed: true,
    })

    for (const e of result.errors) {
      allErrors.push({ sheet: sheetName, row: e.row, reason: e.reason })
    }
  }

  if (perDayTotal.size === 0) {
    return NextResponse.json(
      {
        error: '업로드 가능한 매출이 없습니다.',
        sheets: sheetReports,
        skipped: allErrors,
      },
      { status: 400 }
    )
  }

  const sortedDays = [...perDayTotal.keys()].sort()

  let upserted = 0
  let merged = 0

  for (const [dateStr, agg] of perDayTotal) {
    const saleDateObj = new Date(dateStr)
    const existing = await prisma.sale.findUnique({
      where: {
        restaurantId_saleDate: {
          restaurantId: ctx.restaurantId,
          saleDate: saleDateObj,
        },
      },
    })

    if (!existing || replaceExisting) {
      await prisma.sale.upsert({
        where: {
          restaurantId_saleDate: {
            restaurantId: ctx.restaurantId,
            saleDate: saleDateObj,
          },
        },
        create: {
          restaurantId: ctx.restaurantId,
          userId: ctx.userId,
          saleDate: saleDateObj,
          amount: agg.amount,
          cashAmount: agg.cashAmount,
          cardAmount: agg.cardAmount,
          deliveryAmount: agg.deliveryAmount,
        },
        update: {
          userId: ctx.userId,
          amount: agg.amount,
          cashAmount: agg.cashAmount,
          cardAmount: agg.cardAmount,
          deliveryAmount: agg.deliveryAmount,
        },
      })
      upserted += 1
    } else {
      // 병합: 0이 아닌 필드만 덮어쓰기 (배민-only 파일 올리면 배달만 갱신, POS 유지)
      const newCash = agg.cashAmount > 0 ? agg.cashAmount : existing.cashAmount
      const newCard = agg.cardAmount > 0 ? agg.cardAmount : existing.cardAmount
      const newDelivery = agg.deliveryAmount > 0 ? agg.deliveryAmount : existing.deliveryAmount
      const newAmount = newCash + newCard + newDelivery
      await prisma.sale.update({
        where: { id: existing.id },
        data: {
          userId: ctx.userId,
          amount: newAmount,
          cashAmount: newCash,
          cardAmount: newCard,
          deliveryAmount: newDelivery,
        },
      })
      merged += 1
    }
  }

  return NextResponse.json({
    success: true,
    sheets: sheetReports,
    totalDays: perDayTotal.size,
    upserted,
    merged,
    dateRange: {
      start: sortedDays[0],
      end: sortedDays[sortedDays.length - 1],
    },
    skipped: allErrors,
  })
}
