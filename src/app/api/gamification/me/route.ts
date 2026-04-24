import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const XP_PER_CHECK = 10
const PERFECT_BONUS_XP = 100
const LEVEL_STEP_XP = 100

// GET: 현재 로그인 유저의 이번달 XP/레벨/오늘 달성 카테고리 반환
export async function GET() {
  const session = await auth()
  const user = session?.user as
    | { id?: string; restaurantId?: string }
    | undefined
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (!user.restaurantId) {
    return NextResponse.json({ error: '사업장 정보가 없습니다.' }, { status: 400 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // 이번달 체크 개수
  const monthlyChecks = await prisma.checklistLog.count({
    where: {
      restaurantId: user.restaurantId,
      userId: user.id,
      isChecked: true,
      date: { gte: monthStart, lt: monthEnd },
    },
  })

  // 오늘 체크한 항목들 (카테고리 포함)
  const todayLogs = await prisma.checklistLog.findMany({
    where: {
      restaurantId: user.restaurantId,
      userId: user.id,
      isChecked: true,
      date: { gte: todayStart, lte: todayEnd },
    },
    include: { template: { select: { category: true } } },
  })

  // 활성 템플릿 카테고리별 개수
  const templates = await prisma.checklistTemplate.findMany({
    where: { restaurantId: user.restaurantId, isActive: true },
    select: { category: true },
  })
  const totalByCat: Record<string, number> = {}
  templates.forEach((t) => {
    const c = t.category ?? 'UNCATEGORIZED'
    totalByCat[c] = (totalByCat[c] ?? 0) + 1
  })

  const doneByCat: Record<string, number> = {}
  todayLogs.forEach((l) => {
    const c = l.template?.category ?? 'UNCATEGORIZED'
    doneByCat[c] = (doneByCat[c] ?? 0) + 1
  })

  // 오늘 100% 완료한 카테고리 (KITCHEN, HALL)
  const perfectedToday: string[] = []
  for (const cat of ['KITCHEN', 'HALL']) {
    const total = totalByCat[cat] ?? 0
    const done = doneByCat[cat] ?? 0
    if (total > 0 && done >= total) perfectedToday.push(cat)
  }

  const baseXp = monthlyChecks * XP_PER_CHECK

  // 이번달 perfect day 추정: 오늘 기준 완료된 카테고리 × PERFECT_BONUS
  // (간단한 추정; 전체 복원을 위해서는 날짜별 집계 필요하지만 비용 대비 가치 낮음)
  const perfectBonus = perfectedToday.length * PERFECT_BONUS_XP
  const monthlyXp = baseXp + perfectBonus

  const level = Math.floor(monthlyXp / LEVEL_STEP_XP) + 1
  const xpInLevel = monthlyXp % LEVEL_STEP_XP

  return NextResponse.json({
    monthlyXp,
    level,
    xpInLevel,
    xpToNextLevel: LEVEL_STEP_XP - xpInLevel,
    monthlyChecks,
    perfectedToday,
    todayCompleted: todayLogs.length,
  })
}
