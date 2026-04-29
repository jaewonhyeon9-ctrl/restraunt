import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE: 본인이 작성한 메모 삭제 (사장은 전부 가능)
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const { id } = await ctx.params

  const note = await prisma.dailyNote.findFirst({
    where: { id, restaurantId: user.restaurantId },
  })
  if (!note) {
    return NextResponse.json(
      { error: '메모를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }
  if (user.role !== 'OWNER' && user.role !== 'MANAGER' && note.userId !== user.id) {
    return NextResponse.json(
      { error: '본인이 작성한 메모만 삭제할 수 있습니다.' },
      { status: 403 }
    )
  }

  await prisma.dailyNote.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
