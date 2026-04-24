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
  return bestHits >= 2 ? best : 0
}

function findCol(header: string[], ...candidates: string[]): number {
  const norm = header.map(toKey)
  // exact match first
  for (const name of candidates) {
    const i = norm.indexOf(name.toLowerCase())
    if (i >= 0) return i
  }
  // substring match
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

// YYYY-MM-DD string 반환 (다양한 입력 허용)
function parseDate(raw: unknown): string | null {
  if (raw == null) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return formatYMD(raw)
  }
  // xlsx serial number (엑셀 날짜는 숫자로 저장됨)
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    // xlsx date serial: days since 1899-12-30
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) {
      return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
  }
  const s = String(raw).trim()
  if (!s) return null

  // 2026-04-25, 2026/04/25, 2026.04.25
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // 04/25, 04-25 → 올해로 간주
  m = s.match(/^(\d{1,2})[-./](\d{1,2})$/)
  if (m) {
    const [, mo, d] = m
    const y = new Date().getFullYear()
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // 2026-04-25 10:30:00 같은 datetime
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) return formatYMD(dt)
  return null
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Source = 'AUTO' | 'POS' | 'BAEMIN' | 'COUPANG_EATS' | 'YOGIYO'

function detectSourceFromSheet(sheetName: string, fileName: string): Source {
  const s = (sheetName + ' ' + fileName).toLowerCase()
  if (s.includes('배민') || s.includes('baemin')) return 'BAEMIN'
  if (s.includes('쿠팡') || s.includes('coupang')) return 'COUPANG_EATS'
  if (s.includes('요기요') || s.includes('yogiyo')) return 'YOGIYO'
  return 'POS'
}

// POST: 매출 엑셀/CSV 대량 업로드
// FormData:
//   file: xlsx/xls/csv
//   source: AUTO | POS | BAEMIN | COUPANG_EATS | YOGIYO (기본 AUTO)
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
    // xlsx는 csv도 인식
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json(
      { error: '파일을 읽을 수 없습니다. (.xlsx / .xls / .csv 지원)' },
      { status: 400 }
    )
  }

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json(
      { error: '시트를 찾을 수 없습니다.' },
      { status: 400 }
    )
  }
  const sheet = wb.Sheets[sheetName]

  const effectiveSource: Source =
    source === 'AUTO' ? detectSourceFromSheet(sheetName, file.name) : source

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  })

  if (aoa.length === 0) {
    return NextResponse.json({ error: '파일이 비어있습니다.' }, { status: 400 })
  }

  const headerIdx = detectHeaderRow(aoa)
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

  if (colDate < 0) {
    return NextResponse.json(
      { error: '날짜 컬럼을 찾지 못했습니다. 헤더에 "날짜", "일자", "영업일" 같은 이름이 있어야 합니다.' },
      { status: 400 }
    )
  }
  if (colAmount < 0 && colCash < 0 && colCard < 0 && colDelivery < 0) {
    return NextResponse.json(
      { error: '매출 컬럼을 찾지 못했습니다. "매출", "총매출", "결제금액" 같은 컬럼이 필요합니다.' },
      { status: 400 }
    )
  }

  const bodyRows = aoa.slice(headerIdx + 1)

  // 날짜별 집계 (같은 날 여러 행이면 합산)
  const perDay = new Map<string, {
    amount: number
    cashAmount: number
    cardAmount: number
    deliveryAmount: number
    rowCount: number
  }>()
  const errors: { row: number; reason: string }[] = []

  bodyRows.forEach((row, idx) => {
    const rowNum = idx + headerIdx + 2
    const cells = (row ?? []) as unknown[]
    const get = (i: number): unknown => (i >= 0 ? cells[i] ?? null : null)

    const dateStr = parseDate(get(colDate))
    if (!dateStr) return // 조용히 스킵 (빈 행 / 합계 행 / 푸터)

    const rawAmount = parseAmount(get(colAmount))
    const cashAmt = parseAmount(get(colCash))
    const cardAmt = parseAmount(get(colCard))
    const deliveryAmt = parseAmount(get(colDelivery))

    // 총매출 컬럼이 없으면 결제수단 합으로 추정
    let amount = rawAmount
    if (amount === 0) {
      amount = cashAmt + cardAmt + deliveryAmt
    }
    if (amount === 0) {
      errors.push({ row: rowNum, reason: '매출 금액이 0 또는 비어있습니다.' })
      return
    }

    // 배달앱 소스면 전액 배달로 귀속
    let cash = cashAmt
    let card = cardAmt
    let delivery = deliveryAmt
    if (effectiveSource === 'BAEMIN' || effectiveSource === 'COUPANG_EATS' || effectiveSource === 'YOGIYO') {
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
      prev.rowCount += 1
    } else {
      perDay.set(dateStr, {
        amount,
        cashAmount: cash,
        cardAmount: card,
        deliveryAmount: delivery,
        rowCount: 1,
      })
    }
  })

  if (perDay.size === 0) {
    return NextResponse.json(
      { error: '업로드 가능한 매출이 없습니다.', errors },
      { status: 400 }
    )
  }

  const sortedDays = [...perDay.keys()].sort()
  const startDate = new Date(sortedDays[0])
  const endDate = new Date(sortedDays[sortedDays.length - 1])
  endDate.setDate(endDate.getDate() + 1)

  // replaceExisting: 업로드 범위 내 기존 매출 조회 후 병합 규칙 결정
  // 기본 정책: upsert (같은 날짜면 덮어쓰기) + 배달앱 소스는 deliveryAmount만 병합
  let upserted = 0
  let merged = 0

  for (const [dateStr, agg] of perDay) {
    const saleDateObj = new Date(dateStr)
    const existing = await prisma.sale.findUnique({
      where: {
        restaurantId_saleDate: {
          restaurantId: ctx.restaurantId,
          saleDate: saleDateObj,
        },
      },
    })

    // 배달앱 소스 + 기존 레코드 존재 → 기존 값 유지하고 deliveryAmount만 덮어쓰기
    const isDeliverySource =
      effectiveSource === 'BAEMIN' ||
      effectiveSource === 'COUPANG_EATS' ||
      effectiveSource === 'YOGIYO'

    if (existing && isDeliverySource && !replaceExisting) {
      const newDelivery = agg.deliveryAmount
      const newAmount = existing.cashAmount + existing.cardAmount + newDelivery
      await prisma.sale.update({
        where: { id: existing.id },
        data: {
          amount: newAmount,
          deliveryAmount: newDelivery,
          userId: ctx.userId,
        },
      })
      merged += 1
      continue
    }

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
  }

  return NextResponse.json({
    success: true,
    source: effectiveSource,
    days: perDay.size,
    upserted,
    merged,
    dateRange: {
      start: sortedDays[0],
      end: sortedDays[sortedDays.length - 1],
    },
    skipped: errors,
  })
}
