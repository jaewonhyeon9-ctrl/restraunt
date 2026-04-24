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

// 헤더 후보 키워드 (이 중 2개 이상 포함된 행을 헤더로 간주)
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
  return bestHits >= 2 ? best : 0
}

function findCol(header: string[], ...candidates: string[]): number {
  const norm = header.map(toKey)
  for (const name of candidates) {
    const i = norm.indexOf(name.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

// POST: 엑셀 파일로 대량 생성
// 지원 형식 2가지:
//   1) 샘플 형식: 1행이 헤더, 컬럼 = 카테고리/시간대/시간/제목/설명/순서
//   2) 자유 형식: 헤더가 여러 행 아래에 있고, 컬럼 = 시간/구분/항목/체크리스트 등
//      - 엑셀에 카테고리 컬럼 없으면 form의 defaultCategory 사용
//      - 병합 셀(시간/구분/항목)은 위 값으로 forward-fill
//      - 항목+체크리스트 둘 다 있으면 항목=제목, 체크리스트=설명
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
    return NextResponse.json(
      { error: '엑셀 파일을 첨부해주세요.' },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    return NextResponse.json(
      { error: '엑셀 파일을 읽을 수 없습니다.' },
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

  // array-of-arrays로 읽어서 헤더 자동 탐지
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  })

  if (aoa.length === 0) {
    return NextResponse.json(
      { error: '엑셀이 비어있습니다.' },
      { status: 400 }
    )
  }

  const headerIdx = detectHeaderRow(aoa)
  const header = ((aoa[headerIdx] ?? []) as unknown[]).map((c) =>
    String(c ?? '').trim()
  )

  const colCategory = findCol(header, '카테고리', 'category')
  const colTitle = findCol(header, '제목', 'title', '항목')
  // 체크리스트 컬럼이 별도로 있으면 설명으로 사용
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

  if (titleColFinal < 0) {
    return NextResponse.json(
      {
        error:
          '헤더에서 제목/항목/체크리스트 컬럼을 찾지 못했습니다. 엑셀에 "제목" 또는 "항목" 또는 "체크리스트" 컬럼이 있어야 합니다.',
      },
      { status: 400 }
    )
  }

  const bodyRows = aoa.slice(headerIdx + 1)

  // 병합 셀 forward-fill 대상 컬럼
  const fillCols = [colTimeSlot, colScheduled].filter((c) => c >= 0)
  const lastValues: Record<number, unknown> = {}

  type ParsedRow = {
    category: ChecklistCategory
    timeSlot: string | null
    scheduledTime: string | null
    title: string
    description: string | null
    sortOrder: number
  }

  const parsed: ParsedRow[] = []
  const errors: { row: number; reason: string }[] = []

  bodyRows.forEach((row, idx) => {
    const rowNum = idx + headerIdx + 2 // 1-based + header
    const cells = (row ?? []) as unknown[]

    // forward-fill 먼저
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
    if (!title) return // 빈 제목 → 조용히 스킵 (푸터/빈 행)

    // 카테고리: 엑셀 컬럼 > defaultCategory fallback
    const excelCat = normalizeCategory(getCell(colCategory))
    const category = excelCat ?? defaultCategory
    if (!category) {
      errors.push({
        row: rowNum,
        reason:
          '카테고리를 찾을 수 없습니다. 엑셀에 카테고리 컬럼을 추가하거나 업로드 시 기본 카테고리를 선택해주세요.',
      })
      return
    }

    const description = normalizeText(getCell(descColFinal))
    const timeSlotRaw = normalizeText(getCell(colTimeSlot))
    const scheduledRaw = normalizeText(getCell(colScheduled))

    // 시간 파싱: HH:mm 형태면 scheduledTime에, 자연어면 timeSlot으로 흡수
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

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: '업로드 가능한 항목이 없습니다.', errors },
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
      data: parsed.map((p) => ({
        restaurantId: ctx.restaurantId,
        title: p.title,
        description: p.description,
        category: p.category,
        timeSlot: p.timeSlot,
        scheduledTime: p.scheduledTime,
        sortOrder: p.sortOrder,
      })),
    })
    return parsed.length
  })

  return NextResponse.json({
    success: true,
    created,
    replacedCount,
    skipped: errors,
  })
}
