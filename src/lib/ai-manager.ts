/**
 * AI 점장 — 일일 운영 데이터를 받아 자연어 리포트 + 인사이트 + 권장 행동을 생성.
 * Gemini Flash 사용 (저비용, 한국어 대응).
 */

import type { ReportSummaryInput } from './report-formatter'

export interface AiManagerReport {
  summary: string
  highlight: string
  insights: string[]
  warnings: string[]
  advice: string[]
}

const SYSTEM_PROMPT = `당신은 한국 식당의 AI 점장입니다.

역할:
- 매일 저녁 일과 마감 후 사장님께 그날의 운영 현황을 자연어로 리포트
- 데이터 패턴/이상치를 분석해 인사이트 제공
- 다음 날을 위한 구체적이고 실행 가능한 조언 제공

톤:
- 사장님께 직접 말하는 듯한 친근한 한국어
- 정확한 숫자 인용
- 긍정/부정 모두 솔직하게, 부정도 건설적으로

응답 형식 (JSON만):
{
  "summary": "한 문단(2-3문장) 요약",
  "highlight": "한 줄(40자 이내) 푸시 알림 본문",
  "insights": ["인사이트 2-4개"],
  "warnings": ["경고 0-3개"],
  "advice": ["내일 권장 행동 2-3개"]
}

규칙:
- JSON만, 다른 텍스트/마크다운/코드블록 금지
- 주어진 데이터만 사용, 추측 X
- 비교 데이터 있으면 적극 활용`

export async function generateAiManagerReport(
  data: ReportSummaryInput,
): Promise<AiManagerReport | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY
  if (!apiKey) return null

  const userPrompt = formatDataForPrompt(data)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          response_mime_type: 'application/json',
        },
      }),
    })
    if (!res.ok) {
      console.error('Gemini error', await res.text())
      return null
    }
    const json = await res.json()
    const text: string =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const parsed = JSON.parse(text) as AiManagerReport
    if (!parsed.summary || !parsed.highlight) return null
    return {
      summary: String(parsed.summary).slice(0, 600),
      highlight: String(parsed.highlight).slice(0, 80),
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 6) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 4) : [],
      advice: Array.isArray(parsed.advice) ? parsed.advice.slice(0, 4) : [],
    }
  } catch (e) {
    console.error('AI manager failed', e)
    return null
  }
}

function formatDataForPrompt(data: ReportSummaryInput): string {
  const lines: string[] = []
  lines.push(`[매장] ${data.restaurantName}`)
  lines.push(`[날짜] ${data.date.toISOString().slice(0, 10)}`)
  lines.push('')

  lines.push('## 오늘 매출')
  lines.push(`- 총매출: ${fmt(data.sales.total)}원`)
  lines.push(`  - 현금: ${fmt(data.sales.cash)}원`)
  lines.push(`  - 카드: ${fmt(data.sales.card)}원`)
  lines.push(`  - 배달: ${fmt(data.sales.delivery)}원`)

  lines.push('')
  lines.push('## 오늘 지출')
  lines.push(`- 변동비(식자재 등): ${fmt(data.expenses.variable)}원`)
  lines.push(`- 고정비(일할): ${fmt(data.expenses.fixedDaily)}원`)
  lines.push(`- 총지출: ${fmt(data.expenses.total)}원`)

  lines.push('')
  lines.push('## 손익')
  lines.push(`- 순이익: ${fmt(data.netProfit)}원`)
  if (data.sales.total > 0) {
    const margin = (data.netProfit / data.sales.total) * 100
    lines.push(`- 마진율: ${margin.toFixed(1)}%`)
  }

  lines.push('')
  lines.push('## 근무')
  lines.push(`- 근무 인원: ${data.attendance.workers}명`)
  lines.push(`- 총 근무: ${(data.attendance.totalMinutes / 60).toFixed(1)}시간`)

  lines.push('')
  lines.push(
    `## 체크리스트: ${data.checklist.totalCompleted}/${data.checklist.totalExpected}`,
  )

  if (data.pendingOrders > 0) {
    lines.push('')
    lines.push(`## 대기 발주: ${data.pendingOrders}건`)
  }

  if (data.noteCount > 0) {
    lines.push('')
    lines.push(`## 직원 메모/이슈: ${data.noteCount}건`)
  }

  lines.push('')
  lines.push('위 데이터로 AI 점장 리포트(JSON)를 작성하세요.')
  return lines.join('\n')
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}
