import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface GeminiItem {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

interface GeminiReceipt {
  supplierName: string | null
  date: string | null
  items: GeminiItem[]
  total: number
  rawText: string
}

const PROMPT = `당신은 한국 영수증/거래명세서 OCR 전문가입니다.
이미지에서 다음 정보를 정확하게 추출하여 **JSON 형식으로만** 응답하세요. 설명, 마크다운, 추가 텍스트는 절대 포함하지 마세요.

**최우선 목표:** 가게이름(supplierName)과 각 품목의 풀네임(name)을 정확히 뽑아내는 것.

추출할 정보:
1. supplierName: 영수증 상단의 가게/거래처 상호명 (반드시 포함)
2. date: 영수증 날짜 (YYYY-MM-DD 형식, 없으면 null)
3. items: 모든 품목 배열 (영수증에 적힌 모든 구매 품목을 빠짐없이 포함)
   - name: **품목명 전체** (중요: 줄임말이 아닌 영수증에 적힌 전체 이름을 그대로. 수식어/브랜드/규격/용량도 모두 포함. 예: "CJ 백설 정백당 3kg", "서울우유 1L 2개입")
   - quantity: 수량 (숫자, 못 읽으면 1)
   - unit: 단위 (개, kg, g, L, ml, 병, 봉, 팩 등 / 없으면 "개")
   - unitPrice: 단가 (숫자, 원 단위, 못 읽으면 0)
   - totalPrice: 합계금액 (숫자, 원 단위, 못 읽으면 0)
4. total: 총 결제금액 (숫자, 원 단위)
5. rawText: 영수증 전체 텍스트

응답 형식:
{
  "supplierName": "가게이름",
  "date": "2026-04-16",
  "items": [
    {"name": "CJ 백설 정백당 3kg", "quantity": 1, "unit": "개", "unitPrice": 5900, "totalPrice": 5900}
  ],
  "total": 10000,
  "rawText": "영수증 전체 텍스트"
}

중요:
- 품목명은 영수증에 보이는 대로 전체를 적을 것. 앞부분만 자르지 말 것.
- 품목명이 흐리거나 불확실해도 반드시 items에 포함하고, 읽히지 않는 부분은 "?" 로 대체 (예: "양파 ?kg")
- 영수증에 있는 모든 품목을 누락 없이 포함
- 가격에서 콤마(,)와 "원" 글자는 제거하고 숫자만
- 합계, 부가세, 할인, 포인트적립 등은 items에 포함하지 말 것 (오직 실제 구매 품목만)
- JSON 외의 텍스트는 출력하지 말 것`

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
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

    // Gemini 2.5 Flash로 영수증 분석
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
      console.error('Gemini API error:', err)
      return NextResponse.json({ error: 'Gemini OCR 처리 실패: ' + JSON.stringify(err).slice(0, 200) }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const responseText: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!responseText) {
      return NextResponse.json({ error: '인식 결과가 없습니다' }, { status: 422 })
    }

    let parsed: GeminiReceipt
    try {
      parsed = JSON.parse(responseText) as GeminiReceipt
    } catch {
      return NextResponse.json({ error: '응답 파싱 실패: ' + responseText.slice(0, 200) }, { status: 502 })
    }

    // 데이터 정규화 (이름이 비어있어도 항목 유지 - 사용자가 수동 입력 가능)
    const normalizedItems = (parsed.items || []).map((item) => {
      const name = String(item.name || '').trim()
      return {
        name: name.length > 0 ? name : '(품목명 미인식)',
        quantity: Number(item.quantity) || 1,
        unit: String(item.unit || '개'),
        unitPrice: Number(item.unitPrice) || 0,
        totalPrice: Number(item.totalPrice) || 0,
      }
    })

    const normalizedParsed = {
      supplierName: parsed.supplierName || undefined,
      date: parsed.date || undefined,
      items: normalizedItems,
      total: Number(parsed.total) || 0,
      rawText: parsed.rawText || '',
    }

    // ReceiptImage DB 저장
    const userId = session.user.id
    const restaurantId = (session.user as { restaurantId?: string }).restaurantId

    if (!restaurantId) {
      return NextResponse.json({ error: '식당 정보가 없습니다' }, { status: 400 })
    }

    const receipt = await prisma.receiptImage.create({
      data: {
        restaurantId,
        userId,
        imageUrl: `data:image/jpeg;base64,${image.slice(0, 50)}...`,
        ocrRawText: normalizedParsed.rawText,
        ocrParsed: normalizedParsed as object,
        status: 'PROCESSED',
      },
    })

    return NextResponse.json({
      receiptId: receipt.id,
      parsed: normalizedParsed,
      rawText: normalizedParsed.rawText,
    })
  } catch (error) {
    console.error('OCR route error:', error)
    return NextResponse.json(
      { error: 'OCR 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
