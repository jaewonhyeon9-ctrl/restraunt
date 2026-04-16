import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const employees = await prisma.user.findMany({
      where: {
        restaurantId,
        role: 'EMPLOYEE',
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        attendance: {
          where: {
            date: { gte: monthStart, lt: monthEnd },
          },
          select: {
            workMinutes: true,
            dailyWage: true,
          },
        },
      },
    })

    const result = employees.map((emp) => {
      const monthlyMinutes = emp.attendance.reduce(
        (sum, a) => sum + (a.workMinutes ?? 0),
        0
      )
      const monthlyWage = emp.attendance.reduce(
        (sum, a) => sum + (a.dailyWage ?? 0),
        0
      )
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        hourlyWage: emp.hourlyWage,
        fixedMonthlyWage: emp.monthlyWage,
        hireDate: emp.hireDate?.toISOString() ?? null,
        isActive: emp.isActive,
        createdAt: emp.createdAt.toISOString(),
        monthlyMinutes,
        monthlyWage,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/employees error:', error)
    return NextResponse.json({ error: '직원 목록 조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { name, email, password, phone, hourlyWage, monthlyWage, hireDate } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '이름은 필수입니다' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: '이메일은 필수입니다' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: '비밀번호는 필수입니다' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const employee = await prisma.user.create({
      data: {
        restaurantId,
        name: name.trim(),
        email: email.trim(),
        passwordHash,
        role: 'EMPLOYEE',
        phone: phone?.trim() || null,
        hourlyWage: hourlyWage ? Number(hourlyWage) : null,
        monthlyWage: monthlyWage ? Number(monthlyWage) : null,
        hireDate: hireDate ? new Date(hireDate) : null,
      },
    })

    return NextResponse.json(
      {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        hourlyWage: employee.hourlyWage,
        monthlyWage: employee.monthlyWage,
        hireDate: employee.hireDate?.toISOString() ?? null,
        isActive: employee.isActive,
        createdAt: employee.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/employees error:', error)
    return NextResponse.json({ error: '직원 등록 실패' }, { status: 500 })
  }
}
