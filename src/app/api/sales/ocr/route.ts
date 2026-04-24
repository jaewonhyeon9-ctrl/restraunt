import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

interface ParsedSales {
  date: string | null
  totalAmount: number
  cashAmount: number
  cardAmount: number
  deliveryAmount: number
  source: 'POS' | 'BAEMIN' | 'COUPANG_EATS' | 'YOGIYO' | 'UNKNOWN'
  confidence: number
  rawText: string
}

const PROMPT = `당신은 한국 식당의 POS 마감 화면, 배달앱 매출 화면, 정산 영수증을 분석하는 전문가입니다.
이미지에서 매출 정보를 추출하여 **JSON 형식으로만** 응답하세요. 설명, 마크다운, 코드블록 표시는 절대 포함하지 마세요.

추출할 정보:
1. date: 영업일 또는 정산일 (YYYY-MM-DD 형식, 없으면 null)
2. totalAmount: 총 매출 / 총 결제 / 합계 (숫자, 원 단위)
3. cashAmount: 현금 매출 (숫자, 없으면 0)
4. cardAmount: 카드(신용/체크) 매출 (숫자, 없으면 0)
5. deliveryAmount: 배달 매출 (숫자, 없으면 0)
6. source: 이미지 출처 추정
   - "POS": 일반 POS 마감/정산 화면 (현금/카드 구분 있음)
   - "BAEMIN": 배달의민족 정산/매출 화면
   - "COUPANG_EATS": 쿠팡이츠 정산/매출 화면
   - "YOGIYO": 요기요 정산/매출 화면
   - "UNKNOWN": 구분 불가
7. confidence: 인식 신뢰도 (0.0 ~ 1.0)
8. rawText: 이미지에서 읽은 주요 텍스트 (합계 관련)

응답 예시:
{
  "date": "2026-04-25",
  "totalAmount": 532000,
  "cashAmount": 120000,
  "cardAmount": 362000,
  "deliveryAmount": 50000,
  "source": "POS",
  "confidence": 0.93,
  "rawText": "총매출 532,000 / 현금 120,000 / 카드 362,000 / 배달 50,000"
}

중요 규칙:
- 콤마(,)와 "원" 글자는 제거하고 순수 숫자만
- 배달앱(배민/쿠팡이츠/요기요) 화면이면 totalAmount를 전액 deliveryAmount에 할당하고 cash/card는 0
- totalAmount가 분명하지 않으면 cash+card+delivery 합으로 대체
- 할인, 취소, 환불 금액은 차감된 실 매출로 계산 (있으면 반영)
- 여러 날짜가 보이면 가장 최근 날짜 또는 제목에 명시된 날짜 선택
- 숫자를 못 읽으면 해당 필드 0, date는 null
- 신뢰도는 보수적으로 (숫자 흐림, 일부 가려짐 → 0.5 이하)
- JSON 외의 텍스트 금지 (마크다운 \`\`\`json 같은 것도 금지)`

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    const restaurantId = (session.user as { restaurantId?: string }).restaurantId
    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { image } = body as { image?: string }

    if (!image) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}))
      console.error('Gemini API error (sales OCR):', err)
      return NextResponse.json(
        { error: 'OCR 처리 실패: ' + JSON.stringify(err).slice(0, 200) },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()
    const responseText: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!responseText) {
      return NextResponse.json({ error: '인식 결과가 없습니다' }, { status: 422 })
    }

    let parsed: ParsedSales
    try {
      parsed = JSON.parse(responseText) as ParsedSales
    } catch {
      return NextResponse.json(
        { error: '응답 파싱 실패: ' + responseText.slice(0, 200) },
        { status: 502 }
      )
    }

    // 정규화 + 일관성 확인
    const toInt = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
    }

    const normalizedSource: ParsedSales['source'] =
      parsed.source && ['POS', 'BAEMIN', 'COUPANG_EATS', 'YOGIYO', 'UNKNOWN'].includes(parsed.source)
        ? parsed.source
        : 'UNKNOWN'

    let cashAmount = toInt(parsed.cashAmount)
    let cardAmount = toInt(parsed.cardAmount)
    let deliveryAmount = toInt(parsed.deliveryAmount)
    let totalAmount = toInt(parsed.totalAmount)

    // 배달앱 소스면 전액 배달로 귀속
    const isDeliverySource =
      normalizedSource === 'BAEMIN' ||
      normalizedSource === 'COUPANG_EATS' ||
      normalizedSource === 'YOGIYO'
    if (isDeliverySource && totalAmount > 0) {
      deliveryAmount = totalAmount
      cashAmount = 0
      cardAmount = 0
    }

    // total이 0인데 결제수단 합이 있으면 보정
    if (totalAmount === 0) {
      totalAmount = cashAmount + cardAmount + deliveryAmount
    }

    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7

    const normalized: ParsedSales = {
      date: parsed.date || null,
      totalAmount,
      cashAmount,
      cardAmount,
      deliveryAmount,
      source: normalizedSource,
      confidence,
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText.slice(0, 500) : '',
    }

    return NextResponse.json({ parsed: normalized })
  } catch (error) {
    console.error('sales OCR route error:', error)
    return NextResponse.json({ error: 'OCR 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
