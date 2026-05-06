import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadImageBuffer } from '@/lib/cloudinary'

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

/** 체크리스트 사진 업로드 — multipart/form-data로 이미지 받아 Cloudinary에 저장. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId
  if (!restaurantId) {
    return NextResponse.json({ error: '사업장 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '이미지 파일을 첨부해주세요.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `사진 용량은 ${MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.` },
      { status: 400 },
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadImageBuffer(
      buffer,
      `autodream/checklist/${restaurantId}`,
    )
    return NextResponse.json({ url: result.url, publicId: result.publicId })
  } catch (err) {
    console.error('checklist photo upload error:', err)
    return NextResponse.json(
      { error: '사진 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
