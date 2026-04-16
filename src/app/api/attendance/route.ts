import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateDistance } from '@/lib/gps'
import { calcDailyWage } from '@/lib/wage-calculator'

// GET: 오늘 출퇴근 상태 조회
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const userId = session.user.id
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
    select: {
      clockIn: true,
      clockOut: true,
      workMinutes: true,
      dailyWage: true,
    },
  })

  if (!record) {
    return NextResponse.json({ clockIn: null, clockOut: null, workMinutes: null, dailyWage: null })
  }

  return NextResponse.json({
    clockIn: record.clockIn?.toISOString() ?? null,
    clockOut: record.clockOut?.toISOString() ?? null,
    workMinutes: record.workMinutes ?? null,
    dailyWage: record.dailyWage ?? null,
  })
}

// POST: 출퇴근 처리
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

  let body: { type: 'in' | 'out'; lat: number; lng: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { type, lat, lng } = body
  if (!type || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 })
  }

  // 서버측 GPS 검증
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { lat: true, lng: true, gpsRadius: true },
  })

  if (restaurant?.lat && restaurant?.lng) {
    const distance = calculateDistance(lat, lng, restaurant.lat, restaurant.lng)
    const radius = restaurant.gpsRadius ?? 50
    if (distance > radius) {
      return NextResponse.json(
        { error: `식당 반경 ${radius}m 이내에서만 출퇴근이 가능합니다. (현재 ${Math.round(distance)}m)` },
        { status: 400 }
      )
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  if (type === 'in') {
    // 이미 출근 기록이 있는지 확인
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    })
    if (existing?.clockIn) {
      return NextResponse.json({ error: '이미 출근 처리되었습니다.' }, { status: 409 })
    }

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        restaurantId,
        date: today,
        clockIn: now,
        clockInLat: lat,
        clockInLng: lng,
      },
      update: {
        clockIn: now,
        clockInLat: lat,
        clockInLng: lng,
      },
    })

    return NextResponse.json({
      clockIn: record.clockIn?.toISOString() ?? null,
      clockOut: null,
      workMinutes: null,
      dailyWage: null,
    })
  }

  if (type === 'out') {
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (!existing?.clockIn) {
      return NextResponse.json({ error: '출근 기록이 없습니다.' }, { status: 400 })
    }
    if (existing.clockOut) {
      return NextResponse.json({ error: '이미 퇴근 처리되었습니다.' }, { status: 409 })
    }

    // 근무 시간 및 일급 계산
    const workMinutes = Math.floor((now.getTime() - existing.clockIn.getTime()) / 60000)

    // 사용자 임금 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hourlyWage: true, monthlyWage: true },
    })
    const dailyWage = calcDailyWage(existing.clockIn, now, user?.hourlyWage, user?.monthlyWage)

    const record = await prisma.attendance.update({
      where: { userId_date: { userId, date: today } },
      data: {
        clockOut: now,
        clockOutLat: lat,
        clockOutLng: lng,
        workMinutes,
        dailyWage,
      },
    })

    return NextResponse.json({
      clockIn: record.clockIn?.toISOString() ?? null,
      clockOut: record.clockOut?.toISOString() ?? null,
      workMinutes,
      dailyWage,
    })
  }

  return NextResponse.json({ error: '올바르지 않은 type 값입니다.' }, { status: 400 })
}
