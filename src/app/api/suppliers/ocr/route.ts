import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  checkAndConsumeOcrQuota,
  refundOcrQuota,
  PLAN_LABEL,
} from '@/lib/ocr-quota'

interface GeminiSupplier {
  name: string | null
  phone: string | null
  address: string | null
  businessNumber: string | null
  contactName: string | null
  category: string | null
  rawText: string
}

const PROMPT = `당신은 한국 거래명세서/영수증/명함 OCR 전문가입니다.
이미지에서 거래처 정보를 추출하여 **JSON 형식으로만** 응답하세요.

추출할 정보:
- name: 상호명/회사명
- phone: 전화번호
- address: 주소
- businessNumber: 사업자등록번호 (000-00-00000 형식)
- contactName: 담당자/대표자 이름
- category: 업종 카테고리 (육류/채소/수산/음료/양념/식자재/기타)
- rawText: 전체 텍스트

응답 형식:
{
  "name": "...",
  "phone": "...",
  "address": "...",
  "businessNumber": "...",
  "contactName": "...",
  "category": "...",
  "rawText": "..."
}

없는 정보는 null로 처리하세요. JSON 외 텍스트는 출력하지 마세요.`

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

    // OCR 월 한도 체크 + 사용량 1 증가
    const quota = await checkAndConsumeOcrQuota(restaurantId)
    if (!quota.ok) {
      return NextResponse.json(
        {
          error: 'OCR 월 한도 초과',
          detail: `${PLAN_LABEL[quota.plan]} 플랜은 월 ${quota.limit}회까지 OCR 사용 가능합니다. (이번달 사용: ${quota.used}회)`,
          quota,
        },
        { status: 402 }
      )
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
                { inline_data: { mime_type: 'image/jpeg', data: image } },
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
      await refundOcrQuota(restaurantId)
      return NextResponse.json({ error: 'OCR 처리에 실패했습니다' }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const responseText: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!responseText) {
      await refundOcrQuota(restaurantId)
      return NextResponse.json({ error: '인식 결과가 없습니다' }, { status: 422 })
    }

    let parsed: GeminiSupplier
    try {
      parsed = JSON.parse(responseText) as GeminiSupplier
    } catch {
      await refundOcrQuota(restaurantId)
      return NextResponse.json({ error: '응답 파싱 실패' }, { status: 502 })
    }

    const normalized = {
      name: parsed.name || undefined,
      phone: parsed.phone || undefined,
      address: parsed.address || undefined,
      businessNumber: parsed.businessNumber || undefined,
      contactName: parsed.contactName || undefined,
      category: parsed.category || undefined,
      rawText: parsed.rawText || '',
    }

    return NextResponse.json({ parsed: normalized, rawText: normalized.rawText })
  } catch (error) {
    console.error('POST /api/suppliers/ocr error:', error)
    return NextResponse.json({ error: 'OCR 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
