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
  if (user.role !== 'OWNER')
    return { error: '사장 권한이 필요합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { restaurantId: user.restaurantId }
}

// PATCH: 템플릿 수정
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwner()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: {
    title?: string
    description?: string | null
    category?: string
    timeSlot?: string | null
    sortOrder?: number
    isActive?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }

  const existing = await prisma.checklistTemplate.findFirst({
    where: { id, restaurantId: auth.restaurantId },
  })
  if (!existing) {
    return NextResponse.json(
      { error: '항목을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  const data: {
    title?: string
    description?: string | null
    category?: ChecklistCategory
    timeSlot?: string | null
    sortOrder?: number
    isActive?: boolean
  } = {}
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) {
      return NextResponse.json(
        { error: '제목을 입력해주세요.' },
        { status: 400 }
      )
    }
    data.title = t
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null
  }
  if (body.category !== undefined) {
    const c = body.category.toUpperCase()
    if (!VALID_CATEGORY.has(c)) {
      return NextResponse.json({ error: '카테고리 오류' }, { status: 400 })
    }
    data.category = c as ChecklistCategory
  }
  if (body.timeSlot !== undefined) {
    data.timeSlot = body.timeSlot?.trim() || null
  }
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
  if (body.isActive !== undefined) data.isActive = body.isActive

  const updated = await prisma.checklistTemplate.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}

// DELETE: 템플릿 소프트 삭제(isActive=false)
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwner()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  const existing = await prisma.checklistTemplate.findFirst({
    where: { id, restaurantId: auth.restaurantId },
  })
  if (!existing) {
    return NextResponse.json(
      { error: '항목을 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  await prisma.checklistTemplate.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
