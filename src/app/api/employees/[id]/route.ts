import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(
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

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const recent7Start = new Date()
    recent7Start.setHours(0, 0, 0, 0)
    recent7Start.setDate(recent7Start.getDate() - 6)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const employee = await prisma.user.findFirst({
      where: { id, restaurantId, role: 'EMPLOYEE' },
      include: {
        attendance: {
          where: { date: { gte: monthStart, lt: monthEnd } },
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            clockIn: true,
            clockOut: true,
            workMinutes: true,
            dailyWage: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: '직원을 찾을 수 없습니다' }, { status: 404 })
    }

    const monthlyMinutes = employee.attendance.reduce(
      (sum, a) => sum + (a.workMinutes ?? 0),
      0
    )
    const monthlyWage = employee.attendance.reduce(
      (sum, a) => sum + (a.dailyWage ?? 0),
      0
    )

    // 최근 7일 체크리스트 완료 건수
    const recentLogs = await prisma.checklistLog.count({
      where: {
        restaurantId,
        userId: id,
        date: { gte: recent7Start, lte: todayEnd },
        isChecked: true,
      },
    })

    // 오늘 체크한 항목 / 전체 활성 항목
    const activeTemplates = await prisma.checklistTemplate.count({
      where: { restaurantId, isActive: true },
    })
    const todayCompleted = await prisma.checklistLog.count({
      where: {
        restaurantId,
        userId: id,
        date: { gte: todayStart, lte: todayEnd },
        isChecked: true,
      },
    })

    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      hourlyWage: employee.hourlyWage,
      fixedMonthlyWage: employee.monthlyWage,
      hireDate: employee.hireDate?.toISOString() ?? null,
      isActive: employee.isActive,
      monthlyMinutes,
      monthlyWage,
      attendance: employee.attendance.map((a) => ({
        id: a.id,
        date: a.date.toISOString(),
        clockIn: a.clockIn?.toISOString() ?? null,
        clockOut: a.clockOut?.toISOString() ?? null,
        workMinutes: a.workMinutes ?? 0,
        dailyWage: a.dailyWage ?? 0,
      })),
      checklist: {
        todayCompleted,
        todayTotal: activeTemplates,
        recent7DaysCompleted: recentLogs,
      },
    })
  } catch (error) {
    console.error('GET /api/employees/[id] error:', error)
    return NextResponse.json({ error: '직원 조회 실패' }, { status: 500 })
  }
}

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
