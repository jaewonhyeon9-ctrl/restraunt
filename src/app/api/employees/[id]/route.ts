import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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

    const existing = await prisma.user.findFirst({
      where: { id, restaurantId, role: 'EMPLOYEE' },
    })
    if (!existing) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await req.json()
    const { name, phone, hourlyWage, monthlyWage, hireDate, isActive, newPassword } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (hourlyWage !== undefined) updateData.hourlyWage = hourlyWage ? Number(hourlyWage) : null
    if (monthlyWage !== undefined) updateData.monthlyWage = monthlyWage ? Number(monthlyWage) : null
    if (hireDate !== undefined) updateData.hireDate = hireDate ? new Date(hireDate) : null
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)
    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10)
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      hourlyWage: updated.hourlyWage,
      monthlyWage: updated.monthlyWage,
      hireDate: updated.hireDate?.toISOString() ?? null,
      isActive: updated.isActive,
    })
  } catch (error) {
    console.error('PATCH /api/employees/[id] error:', error)
    return NextResponse.json({ error: '직원 정보 수정 실패' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
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

    const existing = await prisma.user.findFirst({
      where: { id, restaurantId, role: 'EMPLOYEE' },
    })
    if (!existing) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/employees/[id] error:', error)
    return NextResponse.json({ error: '직원 비활성화 실패' }, { status: 500 })
  }
}
