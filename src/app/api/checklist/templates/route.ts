import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ChecklistCategory } from '@prisma/client'

const VALID_CATEGORY = new Set(['KITCHEN', 'HALL'])

async function requireOwner() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'OWNER' && user.role !== 'MANAGER')
    return { error: '사장 권한이 필요합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { userId: user.id, restaurantId: user.restaurantId }
}

// GET: 템플릿 목록 (category 필터 선택)
export async function GET(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const where: {
    restaurantId: string
    isActive: boolean
    category?: ChecklistCategory
  } = { restaurantId: ctx.restaurantId, isActive: true }

  if (category && VALID_CATEGORY.has(category)) {
    where.category = category as ChecklistCategory
  }

  const templates = await prisma.checklistTemplate.findMany({
    where,
    orderBy: [
      { category: 'asc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return NextResponse.json(templates)
}

// POST: 템플릿 생성
export async function POST(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  let body: {
    title?: string
    description?: string | null
    category?: string
    timeSlot?: string | null
    scheduledTime?: string | null
    sortOrder?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const title = body.title?.trim()
  const category = body.category?.toUpperCase()

  if (!title) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  }
  if (!category || !VALID_CATEGORY.has(category)) {
    return NextResponse.json(
      { error: '카테고리는 KITCHEN 또는 HALL이어야 합니다.' },
      { status: 400 }
    )
  }

  const scheduledTime = normalizeTime(body.scheduledTime ?? null)
  if (body.scheduledTime && !scheduledTime) {
    return NextResponse.json(
      { error: '시간은 HH:mm 형식이어야 합니다. (예: 09:30)' },
      { status: 400 }
    )
  }

  const template = await prisma.checklistTemplate.create({
    data: {
      restaurantId: ctx.restaurantId,
      title,
      description: body.description?.trim() || null,
      category: category as ChecklistCategory,
      timeSlot: body.timeSlot?.trim() || null,
      scheduledTime,
      sortOrder: body.sortOrder ?? 0,
    },
  })

  return NextResponse.json(template, { status: 201 })
}

// HH:mm normalize (accepts "9:30", "09:30", "0930", "9시30분")
export function normalizeTime(raw: string | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  const patterns: RegExp[] = [
    /^(\d{1,2}):(\d{2})$/,
    /^(\d{1,2})시\s*(\d{1,2})분?$/,
    /^(\d{1,2})시$/,
    /^(\d{2})(\d{2})$/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const h = Number(m[1])
      const mi = m[2] ? Number(m[2]) : 0
      if (h >= 0 && h < 24 && mi >= 0 && mi < 60) {
        return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      }
    }
  }
  return null
}
