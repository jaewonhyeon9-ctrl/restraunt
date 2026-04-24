import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * POST: 사장 회원가입 — 식당(Restaurant) + OWNER User 동시 생성
 * body: { restaurantName, name, email, password, phone? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const restaurantName = String(body.restaurantName ?? '').trim()
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const phone = body.phone ? String(body.phone).trim() : null

    if (!restaurantName) {
      return NextResponse.json({ error: '식당 이름을 입력해주세요.' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: '사장님 이름을 입력해주세요.' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 체크
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다. 로그인을 시도해주세요.' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // 식당 + 사장 동시 생성 (트랜잭션)
    const result = await prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: { name: restaurantName },
      })

      const user = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          email,
          passwordHash,
          name,
          role: 'OWNER',
          phone,
        },
      })

      return { restaurantId: restaurant.id, userId: user.id }
    })

    return NextResponse.json(
      { success: true, ...result, email },
      { status: 201 }
    )
  } catch (e) {
    console.error('[signup] error:', e)
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.', detail: msg },
      { status: 500 }
    )
  }
}
