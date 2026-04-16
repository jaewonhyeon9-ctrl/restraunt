import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const existing = await prisma.supplier.findFirst({
      where: { id, restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: '거래처를 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const { name, contactName, phone, email, category, paymentDay, note } = body

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: '거래처명은 필수입니다' }, { status: 400 })
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(paymentDay !== undefined && { paymentDay: paymentDay ? Number(paymentDay) : null }),
        ...(note !== undefined && { note: note?.trim() || null }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/suppliers/[id] error:', error)
    return NextResponse.json({ error: '거래처 수정 실패' }, { status: 500 })
  }
}

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
    const existing = await prisma.supplier.findFirst({
      where: { id, restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: '거래처를 찾을 수 없습니다' }, { status: 404 })
    }

    await prisma.supplier.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/suppliers/[id] error:', error)
    return NextResponse.json({ error: '거래처 삭제 실패' }, { status: 500 })
  }
}
