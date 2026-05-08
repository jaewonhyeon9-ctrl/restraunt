import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PRESET_CATEGORIES = [
  '쌀/곡물',
  '육류',
  '해산물',
  '채소',
  '과일',
  '양념/조미료',
  '유제품',
  '음료',
  '면류',
  '주류',
  '기타',
] as const

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  const manufacturer = String(body?.manufacturer ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: '품목명이 필요합니다.' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ category: null, reason: 'AI 키 없음' })
  }

  const prompt = `다음 식자재의 분류 카테고리를 정해주세요.

품목명: ${name}${manufacturer ? `\n제조사: ${manufacturer}` : ''}

선택 가능한 카테고리:
${PRESET_CATEGORIES.map((c) => `- ${c}`).join('\n')}

JSON 형식으로 응답: {"category": "쌀/곡물", "reason": "한 줄 사유"}
`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ category: null, reason: 'AI 호출 실패' })
    }
    const json = await res.json()
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const parsed = JSON.parse(text) as { category?: string; reason?: string }
    const category = String(parsed.category ?? '').trim()
    const matched = PRESET_CATEGORIES.find((c) => c === category) ?? null
    return NextResponse.json({
      category: matched,
      reason: String(parsed.reason ?? '').slice(0, 80),
    })
  } catch {
    return NextResponse.json({ category: null, reason: 'AI 처리 오류' })
  }
}

export async function GET() {
  return NextResponse.json({ categories: PRESET_CATEGORIES })
}
