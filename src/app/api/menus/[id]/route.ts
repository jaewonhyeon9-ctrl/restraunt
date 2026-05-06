import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireOwner() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'OWNER' && user.role !== 'MANAGER')
    return { error: '권한이 부족합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { restaurantId: user.restaurantId }
}

// GET: 메뉴 + 레시피 상세
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id } = await params

  const menu = await prisma.menu.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    include: {
      recipes: {
        include: {
          inventoryItem: {
            select: {
              id: true,
              name: true,
              unit: true,
              unitPrice: true,
              packageWeightG: true,
            },
          },
        },
      },
    },
  })
  if (!menu) {
    return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({
    id: menu.id,
    name: menu.name,
    price: menu.price,
    category: menu.category,
    isActive: menu.isActive,
    recipes: menu.recipes.map((r) => ({
      id: r.id,
      inventoryItemId: r.inventoryItemId,
      qtyUsed: r.qtyUsed,
      item: r.inventoryItem,
    })),
  })
}

// PATCH: 메뉴 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id } = await params

  const existing = await prisma.menu.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    price?: number
    category?: string | null
    isActive?: boolean
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name).trim()
  if (body.price !== undefined) data.price = Number(body.price)
  if (body.category !== undefined) data.category = body.category?.trim() || null
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

  const updated = await prisma.menu.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// DELETE: 메뉴 비활성화
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id } = await params

  const existing = await prisma.menu.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 })
  }

  await prisma.menu.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
