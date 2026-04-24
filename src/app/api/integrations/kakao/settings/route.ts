import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH: 자동 발송 on/off, 발송 시간 변경
// body: { dailyReportEnabled?: boolean, sendHour?: number (0-23) }
export async function PATCH(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { id?: string } | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const updates: { dailyReportEnabled?: boolean; sendHour?: number } = {}

  if (typeof body.dailyReportEnabled === 'boolean') {
    updates.dailyReportEnabled = body.dailyReportEnabled
  }
  if (typeof body.sendHour === 'number') {
    const h = Math.floor(body.sendHour)
    if (h < 0 || h > 23) {
      return NextResponse.json(
        { error: '발송 시간은 0~23 사이여야 합니다.' },
        { status: 400 }
      )
    }
    updates.sendHour = h
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.kakaoIntegration.update({
    where: { userId: user.id },
    data: updates,
    select: { dailyReportEnabled: true, sendHour: true },
  })

  return NextResponse.json(updated)
}

// DELETE: 연동 해제
export async function DELETE() {
  const session = await auth()
  const user = session?.user as { id?: string } | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  await prisma.kakaoIntegration.deleteMany({ where: { userId: user.id } })
  return NextResponse.json({ success: true })
}
