/**
 * 영수증/거래명세서 중복 감지 지문(fingerprint).
 *
 * 같은 영수증을 두 번 촬영해도(약간 다른 OCR 결과여도) 동일하게 잡히도록,
 * 변동이 적은 강한 신호만 사용한다: 거래처명 + 날짜 + 총액 + 품목 수.
 * 품목 개별 텍스트는 재촬영 시 흔들리므로 지문에 넣지 않는다.
 */
import { createHash } from 'crypto'
import { prisma } from './prisma'

// dedupeHash 컬럼이 아직 마이그레이션되지 않은 환경에서도 OCR/지출이 깨지지 않도록,
// 컬럼 존재 여부를 런타임에 한 번 확인하고 캐시한다. (있으면 true 고정, 없으면 매번 재확인)
let dedupeColumnKnown = false
export async function dedupeColumnAvailable(): Promise<boolean> {
  if (dedupeColumnKnown) return true
  try {
    await prisma.$queryRaw`SELECT "dedupeHash" FROM "ReceiptImage" LIMIT 1`
    dedupeColumnKnown = true
    return true
  } catch {
    return false
  }
}

export interface FingerprintInput {
  supplierName?: string | null
  date?: string | null // YYYY-MM-DD
  total?: number | null
  items?: Array<{ name?: string | null; quantity?: number; totalPrice?: number }>
}

/** 거래처명 정규화 (공백/특수문자 제거, 소문자) */
function normalizeSupplier(s?: string | null): string {
  if (!s) return ''
  return s
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
}

/** 유효 품목 수 (이름이 있는 것만) */
function itemCount(items?: FingerprintInput['items']): number {
  if (!items) return 0
  return items.filter((i) => String(i?.name ?? '').trim().length > 0).length
}

/**
 * 지문이 신뢰할 만한지 — 신호가 약하면(총액 0 + 거래처/날짜 모두 없음)
 * 서로 다른 빈 영수증이 동일 지문이 되어 오탐할 수 있으므로 중복검사를 건너뛴다.
 */
export function isFingerprintReliable(input: FingerprintInput): boolean {
  const total = Math.round(Number(input.total) || 0)
  const hasSupplier = normalizeSupplier(input.supplierName).length > 0
  const hasDate = String(input.date ?? '').slice(0, 10).length === 10
  return total > 0 && (hasSupplier || hasDate)
}

/** 거래처+날짜+총액+품목수 → SHA-256 지문 */
export function computeReceiptFingerprint(input: FingerprintInput): string {
  const supplier = normalizeSupplier(input.supplierName)
  const date = String(input.date ?? '').slice(0, 10)
  const total = Math.round(Number(input.total) || 0)
  const count = itemCount(input.items)
  const basis = `${supplier}|${date}|${total}|${count}`
  return createHash('sha256').update(basis).digest('hex')
}
