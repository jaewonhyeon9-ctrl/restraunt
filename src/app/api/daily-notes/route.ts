import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ChecklistCategory, DailyNoteType } from '@prisma/client'

const VALID_TYPE = new Set([
  'HANDOVER',
  'ANOMALY',
  'OWNER_NOTE',
  'COMPLAINT',
])
const VALID_CATEGORY = new Set(['KITCHEN', 'HALL'])

function parseDateParam(raw: string | null): Date {
  const d = raw ? new Date(raw) : new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// GET: 메모 조회
// query: ?date=YYYY-MM-DD (default: today, sinceDays가 없을 때만 적용)
//        ?sinceDays=N (최근 N일 범위로 조회. 지정 시 date 무시)
//        ?type=HANDOVER|ANOMALY|OWNER_NOTE|COMPLAINT (optional filter)
//        ?category=KITCHEN|HALL (optional filter)
//        ?limit=N (최대 건수, 기본 50)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json(
      { error: '사업장 정보를 찾을 수 없습니다.' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const typeParam = searchParams.get('type')?.toUpperCase()
  const sinceDaysRaw = searchParams.get('sinceDays')
  const limitRaw = searchParams.get('limit')

  const where: {
    restaurantId: string
    date?: Date | { gte: Date; lte: Date }
    category?: ChecklistCategory
    type?: DailyNoteType
  } = { restaurantId }

  if (sinceDaysRaw) {
    const days = Math.max(1, Math.min(90, Number(sinceDaysRaw) || 7))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    where.date = { gte: start, lte: end }
  } else {
    where.date = parseDateParam(searchParams.get('date'))
  }

  if (category && VALID_CATEGORY.has(category)) {
    where.category = category as ChecklistCategory
  }
  if (typeParam && VALID_TYPE.has(typeParam)) {
    where.type = typeParam as DailyNoteType
  }

  const take = Math.max(1, Math.min(200, Number(limitRaw) || 50))

  const notes = await prisma.dailyNote.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    notes.map((n) => ({
      id: n.id,
      type: n.type,
      category: n.category,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      user: n.user,
    }))
  )
}

// POST: 메모 생성
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.' },
      { status: 401 }
    )
  }
  const userId = session.user.id
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json(
      { error: '사업장 정보를 찾을 수 없습니다.' },
      { status: 400 }
    )
  }

  let body: {
    type?: string
    category?: string | null
    content?: string
    date?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const type = body.type?.toUpperCase()
  const content = body.content?.trim()
  if (!type || !VALID_TYPE.has(type)) {
    return NextResponse.json({ error: '메모 타입 오류' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }

  let category: ChecklistCategory | null = null
  if (body.category) {
    const c = body.category.toUpperCase()
    if (!VALID_CATEGORY.has(c)) {
      return NextResponse.json({ error: '카테고리 오류' }, { status: 400 })
    }
    category = c as ChecklistCategory
  }

  const date = parseDateParam(body.date ?? null)

  const note = await prisma.dailyNote.create({
    data: {
      restaurantId,
      userId,
      date,
      type: type as DailyNoteType,
      category,
      content,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(
    {
      id: note.id,
      type: note.type,
      category: note.category,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      user: note.user,
    },
    { status: 201 }
  )
}
