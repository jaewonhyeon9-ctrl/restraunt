import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkAndConsumeOcrQuota, refundOcrQuota } from '@/lib/ocr-quota'

interface CalendarSaleEntry {
  date: string // YYYY-MM-DD
  amount: number
}

interface CalendarParseResult {
  yearMonth: string | null // "YYYY-MM"
  entries: CalendarSaleEntry[]
  totalAmount: number
  daysWithSales: number
  confidence: number
  rawText?: string
}

const PROMPT = `당신은 한국 식당의 월간 매출 캘린더를 분석하는 전문가입니다.
이미지는 한 달치 매출이 달력(calendar) 형식으로 표시된 화면, 또는 표(table) 형식의 일별 매출 목록일 수 있습니다.

각 날짜 칸에 매출 금액(원)이 적혀있으면 (date, amount) 쌍으로 추출하세요.

응답은 **JSON 형식으로만**, 다른 설명/마크다운/코드블록 금지.

스키마:
{
  "yearMonth": "YYYY-MM" | null,
  "entries": [
    { "date": "YYYY-MM-DD", "amount": <원 단위 정수> },
    ...
  ],
  "totalAmount": <합계>,
  "daysWithSales": <매출 있는 일수>,
  "confidence": <0.0~1.0>,
  "rawText": "이미지에서 읽은 주요 텍스트"
}

규칙:
- 콤마, "원" 글자 제거 후 정수
- 매출이 0원이거나 비어있는 날짜는 entries에서 제외
- 달력 헤더에서 "2026년 4월" 같은 정보 → yearMonth = "2026-04"
- yearMonth 없으면 null로 두고, entries.date도 "MM-DD" 형식이면 안됨 → 대신 그 칸들 스킵
- 같은 날짜가 여러 번 나오면 합산
- "월계" "총합" "합계" 같은 합산 칸은 entries에서 제외 (totalAmount에만 반영)
- 신뢰도는 보수적으로: 흐릿하거나 일부 가려짐 → 0.5 이하
- 토요일/일요일/공휴일 표시 색깔과 무관하게 매출 숫자만 뽑기
- 배달 / 카드 / 현금 구분이 칸 안에 있으면 합산 후 amount 단일 값
- entries 빈 배열이어도 OK (그러면 totalAmount=0, daysWithSales=0)`

export async function POST(req: NextRequest) {
  let consumed = false
  let restaurantIdForRefund: string | undefined

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    const sUser = session.user as {
      id: string
      restaurantId?: string
      activeRestaurantId?: string
    }
    const restaurantId = sUser.activeRestaurantId ?? sUser.restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }
    restaurantIdForRefund = restaurantId

    const body = await req.json()
    const { image } = body as { image?: string }
    if (!image) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })
    }

    // OCR 쿼터 차감 (영수증과 동일 인프라 재사용)
    const quota = await checkAndConsumeOcrQuota(restaurantId)
    if (!quota.ok) {
      return NextResponse.json(
        { error: 'OCR 사용량 한도 초과', ...quota },
        { status: 429 }
      )
    }
    consumed = true

    // 이미지가 data URL이면 base64만 추출
    const base64 = image.startsWith('data:')
      ? image.split(',', 2)[1]
      : image
    const mimeType = image.startsWith('data:')
      ? image.split(';')[0].slice(5)
      : 'image/jpeg'

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: 'application/json',
        },
      }),
    })

    if (!geminiRes.ok) {
      const t = await geminiRes.text()
      throw new Error(`Gemini error: ${geminiRes.status} ${t.slice(0, 200)}`)
    }

    const geminiJson = await geminiRes.json()
    const textOut: string =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

    let parsed: CalendarParseResult
    try {
      parsed = JSON.parse(textOut)
    } catch {
      // 텍스트에 JSON 포함됐을 수 있음 — 추출 시도
      const m = textOut.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('JSON 파싱 실패')
      parsed = JSON.parse(m[0])
    }

    // 기본 검증 + 정리
    const cleaned: CalendarSaleEntry[] = (parsed.entries ?? [])
      .filter(
        (e: CalendarSaleEntry) =>
          /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(e.amount) && e.amount > 0
      )
      .map((e: CalendarSaleEntry) => ({
        date: e.date,
        amount: Math.round(e.amount),
      }))

    const totalAmount = cleaned.reduce((s, e) => s + e.amount, 0)
    const result: CalendarParseResult = {
      yearMonth: parsed.yearMonth ?? null,
      entries: cleaned,
      totalAmount,
      daysWithSales: cleaned.length,
      confidence: parsed.confidence ?? 0,
      rawText: parsed.rawText,
    }

    return NextResponse.json(result)
  } catch (e) {
    if (consumed && restaurantIdForRefund) {
      await refundOcrQuota(restaurantIdForRefund).catch(() => {})
    }
    const msg = e instanceof Error ? e.message : '인식 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
