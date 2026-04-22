import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET: 빈 샘플 엑셀 다운로드 (업로드 포맷 가이드)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const rows = [
    {
      카테고리: '주방',
      시간대: '오픈 전',
      시간: '09:00',
      제목: '냉장고 온도 확인',
      설명: '0~4도 유지 여부 점검',
      순서: 1,
    },
    {
      카테고리: '주방',
      시간대: '오전',
      시간: '10:30',
      제목: '재료 입고 검수',
      설명: '상태, 수량 확인 후 서명',
      순서: 2,
    },
    {
      카테고리: '주방',
      시간대: '마감',
      시간: '22:00',
      제목: '가스 밸브 잠금 확인',
      설명: '메인/보조 모두 확인',
      순서: 3,
    },
    {
      카테고리: '서빙',
      시간대: '오픈 전',
      시간: '10:30',
      제목: '테이블 세팅',
      설명: '수저, 냅킨, 메뉴판 비치',
      순서: 1,
    },
    {
      카테고리: '서빙',
      시간대: '피크',
      시간: '12:30',
      제목: '테이블 회전 확인',
      설명: '빈 테이블 10분 내 정리',
      순서: 2,
    },
    {
      카테고리: '서빙',
      시간대: '마감',
      시간: '22:30',
      제목: '테이블/의자 정리',
      설명: '알코올 닦기 + 의자 정돈',
      순서: 3,
    },
  ]

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['카테고리', '시간대', '시간', '제목', '설명', '순서'],
  })
  ws['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 8 },
    { wch: 28 },
    { wch: 36 },
    { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '체크리스트')

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="checklist-sample.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
