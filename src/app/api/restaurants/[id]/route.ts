import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  address: z.string().max(120).nullish(),
})

/** 특정 매장 정보 변경 — 해당 매장의 OWNER만 가능 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const userId = session.user.id
  const { id: restaurantId } = await params

  const access = await prisma.userRestaurant.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { role: true },
  })
  if (!access || access.role !== 'OWNER') {
    return NextResponse.json({ error: '해당 매장의 사장만 수정할 수 있습니다.' }, { status: 403 })
  }

  const json = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { name, address } = parsed.data
  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      ...(name != null && { name: name.trim() }),
      ...(address !== undefined && { address: address?.trim() || null }),
    },
    select: { id: true, name: true, address: true },
  })

  return NextResponse.json({ ok: true, restaurant: updated })
}
