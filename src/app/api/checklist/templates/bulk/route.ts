import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ChecklistCategory } from '@prisma/client'
import * as XLSX from 'xlsx'
import { normalizeTime } from '../route'

async function requireOwner() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'OWNER')
    return { error: '사장 권한이 필요합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { restaurantId: user.restaurantId }
}

function normalizeCategory(raw: unknown): ChecklistCategory | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  if (['주방', 'kitchen', 'k'].includes(s)) return 'KITCHEN'
  if (['서빙', '홀', 'hall', 'h'].includes(s)) return 'HALL'
  return null
}

function normalizeText(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  return s || null
}

// 시트명에서 카테고리 자동 감지 (컬럼에 없을 때 fallback)
function detectCategoryFromSheetName(sheetName: string): ChecklistCategory | null {
  const s = sheetName.toLowerCase()
  if (s.includes('주방') || s.includes('kitchen')) return 'KITCHEN'
  if (s.includes('서빙') || s.includes('홀') || s.includes('hall')) return 'HALL'
  return null
}

const HEADER_KEYWORDS = [
  '카테고리', 'category',
  '제목', 'title',
  '항목',
  '체크리스트', 'checklist',
  '설명', 'description',
  '시간대', '타임슬롯', 'timeslot', 'time_slot',
  '시간', '예정시간', 'time', 'scheduledtime',
  '구분',
  '순서', 'order', 'sortorder',
]

const toKey = (v: unknown): string => String(v ?? '').trim().toLowerCase()

function detectHeaderRow(aoa: unknown[][]): number {
  const LIMIT = Math.min(15, aoa.length)
  let best = -1
  let bestHits = 0
  for (let i = 0; i < LIMIT; i++) {
    const row = (aoa[i] ?? []) as unknown[]
    const cells = row.map(toKey).filter(Boolean)
    const hits = cells.filter((c) => HEADER_KEYWORDS.includes(c)).length
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
  return -1
}

type ParsedRow = {
  category: ChecklistCategory
  timeSlot: string | null
  scheduledTime: string | null
  title: string
  description: string | null
  sortOrder: number
}

interface SheetParseResult {
  parsed: ParsedRow[]
  errors: { row: number; reason: string }[]
  headerFound: boolean
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetDefaultCategory: ChecklistCategory | null
): SheetParseResult {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })

  const parsed: ParsedRow[] = []
  const errors: { row: number; reason: string }[] = []

  if (aoa.length === 0) return { parsed, errors, headerFound: false }

  const headerIdx = detectHeaderRow(aoa)
  if (headerIdx < 0) return { parsed, errors, headerFound: false }

  const header = ((aoa[headerIdx] ?? []) as unknown[]).map((c) =>
    String(c ?? '').trim()
  )

  const colCategory = findCol(header, '카테고리', 'category')
  const colTitle = findCol(header, '제목', 'title', '항목')
  const colChecklist = findCol(header, '체크리스트', 'checklist')
  const colDescription = findCol(header, '설명', 'description')
  const colTimeSlot = findCol(header, '시간대', '타임슬롯', '구분', 'timeslot', 'time_slot')
  const colScheduled = findCol(header, '시간', '예정시간', 'time', 'scheduledtime')
  const colOrder = findCol(header, '순서', 'order', 'sortorder')

  // 항목 + 체크리스트 둘 다 있는 경우 매핑 재지정
  const colItemAsTitle = findCol(header, '항목')
  const useItemChecklistPair =
    colChecklist >= 0 && colItemAsTitle >= 0 && colItemAsTitle !== colChecklist
  const titleColFinal = useItemChecklistPair ? colItemAsTitle : colTitle
  const descColFinal = useItemChecklistPair ? colChecklist : colDescription

  if (titleColFinal < 0) return { parsed, errors, headerFound: false }

  const bodyRows = aoa.slice(headerIdx + 1)
  const fillCols = [colTimeSlot, colScheduled].filter((c) => c >= 0)
  const lastValues: Record<number, unknown> = {}

  bodyRows.forEach((row, idx) => {
    const rowNum = idx + headerIdx + 2
    const cells = (row ?? []) as unknown[]

    for (const c of fillCols) {
      const v = cells[c]
      if (v == null || String(v).trim() === '') {
        cells[c] = lastValues[c] ?? null
      } else {
        lastValues[c] = v
      }
    }

    const getCell = (i: number): unknown => (i >= 0 ? cells[i] ?? null : null)

    const title = normalizeText(getCell(titleColFinal))
    if (!title) return

    const excelCat = normalizeCategory(getCell(colCategory))
    const category = excelCat ?? sheetDefaultCategory
    if (!category) {
      errors.push({
        row: rowNum,
        reason: '카테고리를 찾을 수 없습니다 (엑셀 컬럼/시트명/기본값 모두 없음).',
      })
      return
    }

    const description = normalizeText(getCell(descColFinal))
    const timeSlotRaw = normalizeText(getCell(colTimeSlot))
    const scheduledRaw = normalizeText(getCell(colScheduled))

    let scheduledTime: string | null = null
    let timeSlot: string | null = timeSlotRaw
    if (scheduledRaw) {
      const parsedTime = normalizeTime(scheduledRaw)
      if (parsedTime) {
        scheduledTime = parsedTime
      } else if (!timeSlot) {
        timeSlot = scheduledRaw
      } else {
        timeSlot = `${scheduledRaw} · ${timeSlot}`
      }
    }

    const orderRaw = getCell(colOrder)
    const sortOrder =
      typeof orderRaw === 'number'
        ? orderRaw
        : Number.isFinite(Number(orderRaw))
          ? Number(orderRaw)
          : idx

    parsed.push({
      category,
      timeSlot,
      scheduledTime,
      title,
      description,
      sortOrder,
    })
  })

  return { parsed, errors, headerFound: true }
}

// POST: 엑셀 파일로 대량 생성 (다중 시트 지원)
// 시트명에 "주방"/"홀" 들어있으면 해당 카테고리로 자동 지정
// 엑셀에 카테고리 컬럼 있으면 그 값 우선
// 둘 다 없으면 FormData의 defaultCategory 사용
export async function POST(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const form = await req.formData()
  const file = form.get('file')
  const replaceExisting = form.get('replaceExisting') === 'true'
  const defaultCategoryRaw = form.get('defaultCategory')
  const defaultCategory = normalizeCategory(defaultCategoryRaw)

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '엑셀 파일을 첨부해주세요.' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: '엑셀 파일을 읽을 수 없습니다.' }, { status: 400 })
  }

  if (wb.SheetNames.length === 0) {
    return NextResponse.json({ error: '시트를 찾을 수 없습니다.' }, { status: 400 })
  }

  interface SheetReport {
    name: string
    category: ChecklistCategory | null
    created: number
    skippedRows: number
    parsed: boolean
    reason?: string
  }

  const sheetReports: SheetReport[] = []
  const allErrors: { sheet: string; row: number; reason: string }[] = []
  const allParsed: ParsedRow[] = []

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    // 시트별 기본 카테고리: 시트명에서 감지 → 없으면 FormData defaultCategory
    const sheetCategory =
      detectCategoryFromSheetName(sheetName) ?? defaultCategory

    const result = parseSheet(sheet, sheetCategory)

    if (!result.headerFound) {
      sheetReports.push({
        name: sheetName,
        category: sheetCategory,
        created: 0,
        skippedRows: 0,
        parsed: false,
        reason: '헤더/제목 컬럼을 찾지 못했습니다.',
      })
      continue
    }

    sheetReports.push({
      name: sheetName,
      category: sheetCategory,
      created: result.parsed.length,
      skippedRows: result.errors.length,
      parsed: true,
    })

    allParsed.push(...result.parsed)
    for (const e of result.errors) {
      allErrors.push({ sheet: sheetName, row: e.row, reason: e.reason })
    }
  }

  if (allParsed.length === 0) {
    return NextResponse.json(
      {
        error: '업로드 가능한 항목이 없습니다.',
        sheets: sheetReports,
        skipped: allErrors,
      },
      { status: 400 }
    )
  }

  let replacedCount = 0
  const created = await prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      const result = await tx.checklistTemplate.updateMany({
        where: { restaurantId: ctx.restaurantId, isActive: true },
        data: { isActive: false },
      })
      replacedCount = result.count
    }
    await tx.checklistTemplate.createMany({
      data: allParsed.map((p) => ({
        restaurantId: ctx.restaurantId,
        title: p.title,
        description: p.description,
        category: p.category,
        timeSlot: p.timeSlot,
        scheduledTime: p.scheduledTime,
        sortOrder: p.sortOrder,
      })),
    })
    return allParsed.length
  })

  return NextResponse.json({
    success: true,
    created,
    replacedCount,
    sheets: sheetReports,
    skipped: allErrors,
  })
}
