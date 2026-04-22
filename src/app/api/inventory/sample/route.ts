import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET: 재고 품목 샘플 엑셀 다운로드
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = [
    {
      품목명: '삼겹살',
      단위: 'kg',
      단가: 18000,
      안전재고: 5,
      현재재고: 12,
      분류: '육류',
      거래처: '한돈유통',
    },
    {
      품목명: '양파',
      단위: 'kg',
      단가: 1500,
      안전재고: 10,
      현재재고: 25,
      분류: '채소',
      거래처: '농협',
    },
    {
      품목명: '쌈장',
      단위: '통',
      단가: 12000,
      안전재고: 2,
      현재재고: 6,
      분류: '소스',
      거래처: '한돈유통',
    },
    {
      품목명: '소주(참이슬)',
      단위: '박스',
      단가: 52000,
      안전재고: 3,
      현재재고: 8,
      분류: '주류',
      거래처: '',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      '품목명',
      '단위',
      '단가',
      '안전재고',
      '현재재고',
      '분류',
      '거래처',
    ],
  })
  ws['!cols'] = [
    { wch: 20 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '재고품목')

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="inventory-sample.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
