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

function normalizeTimeSlot(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  return s || null
}

// POST: 엑셀 파일로 대량 생성
// Expected columns (row 1 = header):
//   카테고리 | 시간대 | 제목 | 설명 | 순서
//   Category | TimeSlot | Title | Description | Order (aliases supported)
//   - replaceExisting=true(form)면 현재 활성 항목을 모두 비활성화 후 새로 추가
export async function POST(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const form = await req.formData()
  const file = form.get('file')
  const replaceExisting = form.get('replaceExisting') === 'true'

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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  })

  // Accept Korean/English column names
  const headerMap = (row: Record<string, unknown>) => ({
    category:
      row['카테고리'] ?? row['category'] ?? row['Category'] ?? row['CATEGORY'],
    timeSlot:
      row['시간대'] ??
      row['타임슬롯'] ??
      row['timeSlot'] ??
      row['TimeSlot'] ??
      row['time_slot'] ??
      null,
    scheduledTime:
      row['시간'] ??
      row['예정시간'] ??
      row['time'] ??
      row['Time'] ??
      row['scheduledTime'] ??
      null,
    title:
      row['제목'] ?? row['항목'] ?? row['title'] ?? row['Title'] ?? row['TITLE'],
    description:
      row['설명'] ?? row['description'] ?? row['Description'] ?? null,
    sortOrder: row['순서'] ?? row['sortOrder'] ?? row['Order'] ?? null,
  })

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

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // +1 header, +1 human-readable
    const mapped = headerMap(row)
    const category = normalizeCategory(mapped.category)
    const title = mapped.title ? String(mapped.title).trim() : ''

    if (!title) {
      errors.push({ row: rowNum, reason: '제목이 비어있습니다.' })
      return
    }
    if (!category) {
      errors.push({
        row: rowNum,
        reason: '카테고리는 주방 또는 서빙이어야 합니다.',
      })
      return
    }

    parsed.push({
      category,
      timeSlot: normalizeTimeSlot(mapped.timeSlot),
      scheduledTime: mapped.scheduledTime
        ? normalizeTime(String(mapped.scheduledTime))
        : null,
      title,
      description: mapped.description
        ? String(mapped.description).trim() || null
        : null,
      sortOrder:
        typeof mapped.sortOrder === 'number'
          ? mapped.sortOrder
          : Number(mapped.sortOrder) || idx,
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
