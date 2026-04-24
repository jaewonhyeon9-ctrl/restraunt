/**
 * 마감 리포트 → 카카오톡 공유용 200자 이내 요약 텍스트
 * (클라이언트/서버 공용)
 */

export interface ReportSummaryInput {
  restaurantName: string
  date: Date
  sales: {
    total: number
    cash: number
    card: number
    delivery: number
  }
  expenses: {
    variable: number
    fixedDaily: number
    total: number
  }
  netProfit: number
  attendance: {
    workers: number
    totalMinutes: number
  }
  checklist: {
    totalCompleted: number
    totalExpected: number
  }
  pendingOrders: number
  noteCount: number
}

function formatKRW(amount: number): string {
  if (!amount) return '0원'
  if (Math.abs(amount) >= 10000) {
    const man = Math.round(amount / 1000) / 10
    return `${man}만원`
  }
  return `${Math.round(amount).toLocaleString('ko-KR')}원`
}

function formatKRWFull(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원'
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간${m}분`
}

/**
 * 간단 요약 (카카오톡 나에게 보내기용, 200자 이내)
 */
export function buildKakaoSummary(input: ReportSummaryInput): string {
  const d = input.date
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`

  const profitIcon =
    input.netProfit > 0 ? '📈' : input.netProfit < 0 ? '📉' : '➖'

  const lines: string[] = [
    `📊 ${input.restaurantName} ${dateStr} 마감`,
    `💰 매출 ${formatKRW(input.sales.total)}`,
    `💸 지출 ${formatKRW(input.expenses.total)}`,
    `${profitIcon} 순이익 ${formatKRW(input.netProfit)}`,
    `👥 근무 ${input.attendance.workers}명 ${minutesToHours(input.attendance.totalMinutes)}`,
    `✅ 체크리스트 ${input.checklist.totalCompleted}/${input.checklist.totalExpected}`,
  ]
  if (input.pendingOrders > 0) {
    lines.push(`🛒 대기 발주 ${input.pendingOrders}건`)
  }
  if (input.noteCount > 0) {
    lines.push(`📝 메모 ${input.noteCount}건`)
  }

  return lines.join('\n').slice(0, 200)
}

/**
 * 상세 공유 텍스트 (Web Share / 복사 버튼용, 제한 없음)
 */
export function buildDetailedShareText(input: ReportSummaryInput): string {
  const d = input.date
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`
  const lines: string[] = [
    `📊 [${input.restaurantName}] ${dateStr} 마감 리포트`,
    '',
    `💰 매출: ${formatKRWFull(input.sales.total)}`,
  ]
  const parts: string[] = []
  if (input.sales.cash) parts.push(`현금 ${formatKRWFull(input.sales.cash)}`)
  if (input.sales.card) parts.push(`카드 ${formatKRWFull(input.sales.card)}`)
  if (input.sales.delivery)
    parts.push(`배달 ${formatKRWFull(input.sales.delivery)}`)
  if (parts.length > 0) lines.push(`  ${parts.join(' / ')}`)

  lines.push(
    `💸 지출: ${formatKRWFull(input.expenses.total)} (변동 ${formatKRWFull(input.expenses.variable)} + 고정 ${formatKRWFull(input.expenses.fixedDaily)})`
  )
  lines.push(`📈 순이익: ${formatKRWFull(input.netProfit)}`)
  lines.push('')
  lines.push(
    `👥 근무: ${input.attendance.workers}명 / ${minutesToHours(input.attendance.totalMinutes)}`
  )
  lines.push(
    `✅ 체크리스트: ${input.checklist.totalCompleted}/${input.checklist.totalExpected}`
  )
  if (input.pendingOrders > 0) {
    lines.push(`🛒 대기 발주: ${input.pendingOrders}건`)
  }
  if (input.noteCount > 0) {
    lines.push(`📝 메모: ${input.noteCount}건`)
  }
  lines.push('')
  lines.push('— 오토드림')
  return lines.join('\n')
}
