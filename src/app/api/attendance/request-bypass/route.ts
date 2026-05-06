import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

/**
 * 직원이 GPS로 출퇴근 거부됐을 때 사장에게 GPS 검증 우회 요청 푸시 발송.
 *
 * Body: { type: 'in'|'out', distance?: number, accuracy?: number }
 */
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

  let body: { type?: 'in' | 'out'; distance?: number; accuracy?: number }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  // 해당 매장의 모든 OWNER/MANAGER 찾기 (다점포 사장 + 점장도 받음)
  const owners = await prisma.userRestaurant.findMany({
    where: {
      restaurantId,
      role: { in: ['OWNER', 'MANAGER'] },
    },
    select: { userId: true },
  })
  if (owners.length === 0) {
    return NextResponse.json({ error: '매장 사장을 찾을 수 없습니다.' }, { status: 404 })
  }

  const employeeName = me?.name ?? '직원'
  const typeText = body.type === 'out' ? '퇴근' : '출근'
  const distanceText =
    typeof body.distance === 'number'
      ? ` (현재 거리 ${Math.round(body.distance)}m`
      : ''
  const accuracyText =
    typeof body.accuracy === 'number' && body.accuracy > 0
      ? `, 정확도 ±${Math.round(body.accuracy)}m`
      : ''
  const closingText = distanceText ? ')' : ''

  const payload = {
    title: `📍 ${employeeName} ${typeText} GPS 막힘`,
    body:
      `${employeeName}님이 GPS로 ${typeText}이 거부됐습니다${distanceText}${accuracyText}${closingText}. ` +
      `매장 탭에서 GPS 검증을 끄거나 반경을 키워주세요.`,
    url: '/restaurants',
  }

  let totalSent = 0
  let totalRemoved = 0
  await Promise.all(
    owners.map(async (o) => {
      const r = await sendPushToUser(o.userId, payload)
      totalSent += r.sent
      totalRemoved += r.removed
    }),
  )

  return NextResponse.json({ ok: true, sent: totalSent, removed: totalRemoved })
}
