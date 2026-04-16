import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
      include: {
        expenses: {
          where: {
            expenseDate: { gte: monthStart, lte: monthEnd },
          },
          select: { amount: true },
        },
      },
    })

    const result = suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      email: s.email,
      category: s.category,
      paymentDay: s.paymentDay,
      note: s.note,
      monthlyAmount: s.expenses.reduce((sum, e) => sum + e.amount, 0),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/suppliers error:', error)
    return NextResponse.json({ error: '거래처 조회 실패' }, { status: 500 })
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
    const { name, contactName, phone, email, category, paymentDay, note } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '거래처명은 필수입니다' }, { status: 400 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        restaurantId,
        name: name.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        category: category?.trim() || null,
        paymentDay: paymentDay ? Number(paymentDay) : null,
        note: note?.trim() || null,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('POST /api/suppliers error:', error)
    return NextResponse.json({ error: '거래처 등록 실패' }, { status: 500 })
  }
}
