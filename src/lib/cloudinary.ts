import { v2 as cloudinary } from 'cloudinary'

let configured = false
function ensureConfigured() {
  if (configured) return
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

/**
 * 이미지 buffer를 Cloudinary에 업로드.
 *
 * @param buffer 원본 이미지 바이트
 * @param folder Cloudinary 폴더명 (예: 'autodream/checklist')
 * @param publicId 선택. 미지정 시 자동 생성
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
  ensureConfigured()
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        // 자동 포맷 / 압축 (Cloudinary가 알아서 최적화)
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
          // 최대 1600px 가로
          { width: 1600, crop: 'limit' },
        ],
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary 업로드 실패'))
          return
        }
        resolve({ url: result.secure_url, publicId: result.public_id })
      },
    )
    upload.end(buffer)
  })
}
