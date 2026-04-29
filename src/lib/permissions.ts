/**
 * 직급 기반 권한 헬퍼.
 *
 * 직급 체계:
 *  - OWNER:    사장 (매장 소유주, 모든 권한, 일일 AI 점장 리포트 수신)
 *  - MANAGER:  점장 (사장과 동일 권한, 단 일일 리포트 수신은 안 함)
 *  - DEPUTY:   대리 (영수증 OCR 가능, 기본 직원 권한 + 일부 사장 화면)
 *  - STAFF:    사원 (기본 직원 권한)
 *  - EMPLOYEE: (deprecated 호환용, STAFF와 동일 취급)
 */

export type RoleValue = 'OWNER' | 'MANAGER' | 'DEPUTY' | 'STAFF' | 'EMPLOYEE'

const NORMALIZED: Record<RoleValue, RoleValue> = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  DEPUTY: 'DEPUTY',
  STAFF: 'STAFF',
  EMPLOYEE: 'STAFF', // 호환 매핑
}

export function normalizeRole(role: string | null | undefined): RoleValue {
  if (!role) return 'STAFF'
  return NORMALIZED[role as RoleValue] ?? 'STAFF'
}

export const ROLE_LABEL: Record<RoleValue, string> = {
  OWNER: '사장',
  MANAGER: '점장',
  DEPUTY: '대리',
  STAFF: '사원',
  EMPLOYEE: '사원',
}

/** 사장 화면(/owner)에 접근할 수 있는 직급 — 사장 + 점장 */
export function canAccessOwnerArea(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return r === 'OWNER' || r === 'MANAGER'
}

/** 사장(매장 소유주) 전용 — 매장 추가, 사용자/직원 관리, 일일 리포트 수신 */
export function isOwnerOnly(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'OWNER'
}

/** 점장과 사장 구분 — 일일 리포트는 사장만 받음 */
export function canReceiveDailyReport(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'OWNER'
}

/** 영수증 OCR — 사장 / 점장 / 대리 */
export function canScanReceipt(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return r === 'OWNER' || r === 'MANAGER' || r === 'DEPUTY'
}

/** 매출 입력 — 사장 / 점장 (대리는 보조 입력만 가능 시 별도 정책) */
export function canEnterSales(role: string | null | undefined): boolean {
  return canAccessOwnerArea(role)
}

/** 재고 관리 — 사장 / 점장 / 대리 */
export function canManageInventory(role: string | null | undefined): boolean {
  return canScanReceipt(role)
}

/** 직원 관리 (CRUD) — 사장 / 점장 */
export function canManageEmployees(role: string | null | undefined): boolean {
  return canAccessOwnerArea(role)
}

/** 새 매장 추가 — 사장 전용 */
export function canCreateRestaurant(role: string | null | undefined): boolean {
  return isOwnerOnly(role)
}

/** 출퇴근 화면 — 모든 직원 + (보기용으로) 사장도 */
export function canClockInOut(role: string | null | undefined): boolean {
  // 일단 모든 사용자 허용 (사장도 자기 출퇴근 기록 가능)
  return true
}

/** 직급 선택 옵션 (사용자 등록/수정 폼용) */
export const ROLE_OPTIONS: { value: RoleValue; label: string; description: string }[] = [
  { value: 'OWNER', label: '사장', description: '매장 소유주 · 일일 리포트 수신' },
  { value: 'MANAGER', label: '점장', description: '사장과 동일 권한 (리포트 제외)' },
  { value: 'DEPUTY', label: '대리', description: '영수증 OCR + 직원 권한' },
  { value: 'STAFF', label: '사원', description: '기본 출퇴근 + 체크리스트' },
]
