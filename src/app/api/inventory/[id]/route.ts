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

// PATCH: 재고 품목 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id } = await params

  const existing = await prisma.inventoryItem.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: '품목을 찾을 수 없습니다.' }, { status: 404 })
  }

  const body = await req.json()
  const {
    name,
    manufacturer,
    unit,
    unitPrice,
    packageWeightG,
    safetyStock,
    currentStock,
    category,
    supplierId,
  } = body

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = String(name).trim()
  if (manufacturer !== undefined)
    data.manufacturer = manufacturer ? String(manufacturer).trim() : null
  if (unit !== undefined) data.unit = String(unit).trim()
  if (unitPrice !== undefined)
    data.unitPrice = unitPrice ? Number(unitPrice) : null
  if (packageWeightG !== undefined)
    data.packageWeightG = packageWeightG ? Number(packageWeightG) : null
  if (safetyStock !== undefined)
    data.safetyStock = safetyStock ? Number(safetyStock) : null
  if (currentStock !== undefined)
    data.currentStock = currentStock != null ? Number(currentStock) : 0
  if (category !== undefined) data.category = category || null
  if (supplierId !== undefined) data.supplierId = supplierId || null

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data,
    include: { supplier: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

// DELETE: 재고 품목 비활성화 (소프트 삭제)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }
  const { id } = await params

  const existing = await prisma.inventoryItem.findFirst({
    where: { id, restaurantId: ctx.restaurantId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: '품목을 찾을 수 없습니다.' }, { status: 404 })
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
