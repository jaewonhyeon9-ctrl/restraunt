import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { ExpenseCategory } from '@prisma/client'

// PATCH: 고정비용 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.fixedExpense.findFirst({
      where: { id, restaurantId, isActive: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '고정비용을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const { name, category, amount, billingDay, isDailyCalc } = body as {
      name?: string
      category?: ExpenseCategory
      amount?: number
      billingDay?: number | null
      isDailyCalc?: boolean
    }

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: '이름은 필수입니다' }, { status: 400 })
    }

    if (billingDay !== undefined && billingDay !== null && (billingDay < 1 || billingDay > 31)) {
      return NextResponse.json({ error: '납부일은 1~31 사이여야 합니다' }, { status: 400 })
    }

    const updated = await prisma.fixedExpense.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(amount !== undefined && { amount }),
        ...(billingDay !== undefined && { billingDay }),
        ...(isDailyCalc !== undefined && { isDailyCalc }),
      },
    })

    return NextResponse.json({ fixedExpense: updated })
  } catch (error) {
    console.error('PATCH /api/fixed-expenses/[id] error:', error)
    return NextResponse.json({ error: '고정비용 수정 실패' }, { status: 500 })
  }
}

// DELETE: 고정비용 비활성화 (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.fixedExpense.findFirst({
      where: { id, restaurantId, isActive: true },
    })
    if (!existing) {
      return NextResponse.json({ error: '고정비용을 찾을 수 없습니다' }, { status: 404 })
    }

    await prisma.fixedExpense.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/fixed-expenses/[id] error:', error)
    return NextResponse.json({ error: '고정비용 삭제 실패' }, { status: 500 })
  }
}
