import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ChecklistCategory } from '@prisma/client'

const VALID_CATEGORY = new Set(['KITCHEN', 'HALL'])

// GET: 오늘 체크리스트 목록 (템플릿 + 완료 여부)
// query: ?category=KITCHEN|HALL (optional)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const where: {
    restaurantId: string
    isActive: boolean
    category?: ChecklistCategory
  } = { restaurantId, isActive: true }
  if (category && VALID_CATEGORY.has(category)) {
    where.category = category as ChecklistCategory
  }

  // 활성 템플릿 조회 (시간이 있는 것은 시간순, 없는 건 sortOrder)
  const templates = await prisma.checklistTemplate.findMany({
    where,
    orderBy: [
      { scheduledTime: { sort: 'asc', nulls: 'last' } },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  if (templates.length === 0) {
    return NextResponse.json([])
  }

  // 오늘 체크 로그 조회
  const logs = await prisma.checklistLog.findMany({
    where: {
      userId,
      restaurantId,
      date: today,
      templateId: { in: templates.map((t) => t.id) },
    },
  })

  const logMap = new Map(logs.map((l) => [l.templateId, l]))

  const result = templates.map((template) => {
    const log = logMap.get(template.id)
    return {
      templateId: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      timeSlot: template.timeSlot,
      scheduledTime: template.scheduledTime,
      sortOrder: template.sortOrder,
      isChecked: log?.isChecked ?? false,
      checkedAt: log?.checkedAt?.toISOString() ?? null,
    }
  })

  return NextResponse.json(result)
}

// POST: 체크리스트 항목 체크/언체크
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  let body: { templateId: string; isChecked: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { templateId, isChecked } = body
  if (!templateId || typeof isChecked !== 'boolean') {
    return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 })
  }

  // 템플릿 존재 확인
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, restaurantId, isActive: true },
  })
  if (!template) {
    return NextResponse.json({ error: '존재하지 않는 체크리스트 항목입니다.' }, { status: 404 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  const log = await prisma.checklistLog.upsert({
    where: {
      templateId_userId_date: { templateId, userId, date: today },
    },
    create: {
      templateId,
      userId,
      restaurantId,
      date: today,
      isChecked,
      checkedAt: isChecked ? now : null,
    },
    update: {
      isChecked,
      checkedAt: isChecked ? now : null,
    },
  })

  return NextResponse.json({
    templateId: log.templateId,
    isChecked: log.isChecked,
    checkedAt: log.checkedAt?.toISOString() ?? null,
  })
}
