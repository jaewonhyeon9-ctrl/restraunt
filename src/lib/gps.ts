// 하버사인 공식 — 두 좌표 사이의 거리(미터) 계산
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// GPS 정확도 보정 한도 — 너무 큰 오차로 무한대 우회 방지
export const MAX_ACCURACY_BUFFER_M = 200

/**
 * 정확도(accuracy)를 반영한 위치 검증.
 *
 * 허용 거리 = 반경 + min(정확도, MAX_ACCURACY_BUFFER_M)
 *
 * 정확도가 좋으면(±10m) 반경 그대로 적용, 나쁘면(실내 ±100m) 일부 보정 허용.
 * 200m 초과 정확도는 200m로 캡 → 매우 부정확한 위치로 우회 방지.
 */
export function checkInRange(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusM: number,
  accuracyM?: number | null
): {
  ok: boolean
  distance: number
  allowedDistance: number
  accuracyBuffer: number
} {
  const distance = calculateDistance(userLat, userLng, targetLat, targetLng)
  const accuracy = accuracyM != null && accuracyM > 0 ? accuracyM : 0
  const accuracyBuffer = Math.min(accuracy, MAX_ACCURACY_BUFFER_M)
  const allowedDistance = radiusM + accuracyBuffer
  return {
    ok: distance <= allowedDistance,
    distance,
    allowedDistance,
    accuracyBuffer,
  }
}
