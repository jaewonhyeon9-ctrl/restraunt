import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  entries: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.number().int().nonnegative().max(2_000_000_000),
        cashAmount: z.number().nonnegative().nullish(),
        cardAmount: z.number().nonnegative().nullish(),
        deliveryAmount: z.number().nonnegative().nullish(),
        note: z.string().max(200).nullish(),
      })
    )
    .min(1)
    .max(100),
  /** 같은 날짜에 매출 있으면 어떻게? */
  conflict: z.enum(['skip', 'replace', 'add']).default('skip'),
})

/**
 * 매출 일괄 등록 (달력 OCR 결과 또는 엑셀 등)
 * conflict 정책으로 기존 매출과 병합 처리.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  const u = session?.user as
    | { id?: string; restaurantId?: string; activeRestaurantId?: string }
    | undefined
  if (!u?.id) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const restaurantId = u.activeRestaurantId ?? u.restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '식당 정보 없음' }, { status: 400 })
  }
  const userId = u.id

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 입력', issues: parsed.error.issues }, { status: 400 })
  }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const e of parsed.data.entries) {
    const date = new Date(e.date + 'T00:00:00.000Z')
    const existing = await prisma.sale.findUnique({
      where: { restaurantId_saleDate: { restaurantId, saleDate: date } },
    })

    if (existing) {
      if (parsed.data.conflict === 'skip') {
        skipped++
        continue
      }
      if (parsed.data.conflict === 'replace') {
        await prisma.sale.update({
          where: { id: existing.id },
          data: {
            amount: e.amount,
            cashAmount: e.cashAmount ?? 0,
            cardAmount: e.cardAmount ?? 0,
            deliveryAmount: e.deliveryAmount ?? 0,
            note: e.note ?? existing.note,
          },
        })
        updated++
      } else {
        // add
        await prisma.sale.update({
          where: { id: existing.id },
          data: {
            amount: { increment: e.amount },
            cashAmount: { increment: e.cashAmount ?? 0 },
            cardAmount: { increment: e.cardAmount ?? 0 },
            deliveryAmount: { increment: e.deliveryAmount ?? 0 },
          },
        })
        updated++
      }
    } else {
      await prisma.sale.create({
        data: {
          restaurantId,
          userId,
          saleDate: date,
          amount: e.amount,
          cashAmount: e.cashAmount ?? 0,
          cardAmount: e.cardAmount ?? 0,
          deliveryAmount: e.deliveryAmount ?? 0,
          note: e.note ?? null,
        },
      })
      created++
    }
  }

  return NextResponse.json({ ok: true, created, updated, skipped })
}
