// 일별 급여 계산
export function calcDailyWage(
  clockIn: Date,
  clockOut: Date,
  hourlyWage?: number | null,
  monthlyWage?: number | null
): number {
  const workMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000)

  if (hourlyWage) {
    return Math.round((workMinutes / 60) * hourlyWage)
  }

  if (monthlyWage) {
    // 월 209시간 기준 (주 40시간 + 주휴 8시간)
    return Math.round((workMinutes / 60 / 209) * monthlyWage)
  }

  return 0
}

// 월 누적 급여
export function calcMonthlySalary(
  dailyWages: number[],
  monthlyWage?: number | null
): number {
  if (monthlyWage) return monthlyWage
  return dailyWages.reduce((sum, w) => sum + w, 0)
}
