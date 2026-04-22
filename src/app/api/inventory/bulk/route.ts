import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

async function requireOwner() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; role?: string; restaurantId?: string }
    | undefined
  if (!user?.id) return { error: '로그인이 필요합니다.', status: 401 as const }
  if (user.role !== 'OWNER')
    return { error: '사장 권한이 필요합니다.', status: 403 as const }
  if (!user.restaurantId)
    return { error: '사업장 정보가 없습니다.', status: 400 as const }
  return { restaurantId: user.restaurantId }
}

function toNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// POST: 엑셀로 재고 품목 대량 등록
// Columns: 품목명 | 단위 | 단가 | 안전재고 | 현재재고 | 분류 | 거래처명
export async function POST(req: NextRequest) {
  const ctx = await requireOwner()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const form = await req.formData()
  const file = form.get('file')
  const updateExisting = form.get('updateExisting') === 'true'

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: '엑셀 파일을 첨부해주세요.' },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'buffer' })
  } catch {
    return NextResponse.json(
      { error: '엑셀 파일을 읽을 수 없습니다.' },
      { status: 400 }
    )
  }

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json({ error: '시트가 없습니다.' }, { status: 400 })
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[sheetName],
    { defval: null, raw: false }
  )

  const headerMap = (row: Record<string, unknown>) => ({
    name:
      row['품목명'] ?? row['이름'] ?? row['name'] ?? row['Name'] ?? row['NAME'],
    unit: row['단위'] ?? row['unit'] ?? row['Unit'],
    unitPrice:
      row['단가'] ?? row['가격'] ?? row['unitPrice'] ?? row['Price'] ?? null,
    safetyStock:
      row['안전재고'] ??
      row['최소재고'] ??
      row['safetyStock'] ??
      row['SafetyStock'] ??
      null,
    currentStock:
      row['현재재고'] ??
      row['재고'] ??
      row['currentStock'] ??
      row['Stock'] ??
      null,
    category:
      row['분류'] ?? row['카테고리'] ?? row['category'] ?? row['Category'] ?? null,
    supplier:
      row['거래처'] ??
      row['거래처명'] ??
      row['supplier'] ??
      row['Supplier'] ??
      null,
  })

  // Look up suppliers by name to resolve IDs
  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId: ctx.restaurantId },
    select: { id: true, name: true },
  })
  const supplierByName = new Map(
    suppliers.map((s) => [s.name.trim().toLowerCase(), s.id])
  )

  type ParsedRow = {
    name: string
    unit: string
    unitPrice: number | null
    safetyStock: number | null
    currentStock: number
    category: string | null
    supplierId: string | null
  }

  const parsed: ParsedRow[] = []
  const errors: { row: number; reason: string }[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const mapped = headerMap(row)
    const name = mapped.name ? String(mapped.name).trim() : ''
    const unit = mapped.unit ? String(mapped.unit).trim() : ''

    if (!name) {
      errors.push({ row: rowNum, reason: '품목명이 비어있습니다.' })
      return
    }
    if (!unit) {
      errors.push({ row: rowNum, reason: '단위가 비어있습니다.' })
      return
    }

    let supplierId: string | null = null
    if (mapped.supplier) {
      const key = String(mapped.supplier).trim().toLowerCase()
      supplierId = supplierByName.get(key) ?? null
      if (!supplierId) {
        errors.push({
          row: rowNum,
          reason: `거래처 "${mapped.supplier}"를 찾을 수 없습니다. (먼저 거래처 등록 필요)`,
        })
        // 거래처 매칭 실패는 경고만, 품목 자체는 등록
      }
    }

    parsed.push({
      name,
      unit,
      unitPrice: toNumber(mapped.unitPrice),
      safetyStock: toNumber(mapped.safetyStock),
      currentStock: toNumber(mapped.currentStock) ?? 0,
      category: mapped.category ? String(mapped.category).trim() || null : null,
      supplierId,
    })
  })

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: '업로드 가능한 품목이 없습니다.', errors },
      { status: 400 }
    )
  }

  // Handle existing items (optional upsert-style behavior)
  const names = parsed.map((p) => p.name)
  const existing = await prisma.inventoryItem.findMany({
    where: {
      restaurantId: ctx.restaurantId,
      name: { in: names },
      isActive: true,
    },
    select: { id: true, name: true },
  })
  const existingByName = new Map(
    existing.map((e) => [e.name.trim().toLowerCase(), e.id])
  )

  let created = 0
  let updated = 0
  let skipped = 0

  await prisma.$transaction(async (tx) => {
    for (const p of parsed) {
      const key = p.name.trim().toLowerCase()
      const existingId = existingByName.get(key)
      if (existingId) {
        if (updateExisting) {
          await tx.inventoryItem.update({
            where: { id: existingId },
            data: {
              unit: p.unit,
              unitPrice: p.unitPrice,
              safetyStock: p.safetyStock,
              currentStock: p.currentStock,
              category: p.category,
              supplierId: p.supplierId,
            },
          })
          updated++
        } else {
          skipped++
        }
      } else {
        await tx.inventoryItem.create({
          data: {
            restaurantId: ctx.restaurantId,
            name: p.name,
            unit: p.unit,
            unitPrice: p.unitPrice,
            safetyStock: p.safetyStock,
            currentStock: p.currentStock,
            category: p.category,
            supplierId: p.supplierId,
          },
        })
        created++
      }
    }
  })

  return NextResponse.json({
    success: true,
    created,
    updated,
    skipped,
    warnings: errors,
  })
}
