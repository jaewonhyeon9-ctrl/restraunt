import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 현재 식당 위치/반경 조회 (사장 + 직원)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, address: true, lat: true, lng: true, gpsRadius: true },
  })

  if (!restaurant) {
    return NextResponse.json({ error: '사업장을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(restaurant)
}

// PATCH: 식당 위치/반경 업데이트 (사장 전용)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'OWNER') {
    return NextResponse.json({ error: '사장만 설정할 수 있습니다.' }, { status: 403 })
  }

  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  let body: { lat?: number; lng?: number; gpsRadius?: number; address?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { lat, lng, gpsRadius, address } = body

  if (lat != null && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
    return NextResponse.json({ error: '위도 값이 올바르지 않습니다.' }, { status: 400 })
  }
  if (lng != null && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
    return NextResponse.json({ error: '경도 값이 올바르지 않습니다.' }, { status: 400 })
  }
  if (gpsRadius != null && (typeof gpsRadius !== 'number' || gpsRadius < 10 || gpsRadius > 500)) {
    return NextResponse.json({ error: '반경은 10m~500m 사이여야 합니다.' }, { status: 400 })
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      ...(lat != null && { lat }),
      ...(lng != null && { lng }),
      ...(gpsRadius != null && { gpsRadius }),
      ...(address != null && { address }),
    },
    select: { name: true, address: true, lat: true, lng: true, gpsRadius: true },
  })

  return NextResponse.json(updated)
}
