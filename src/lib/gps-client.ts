'use client'

/**
 * 다중 측정 GPS 획득.
 *
 * 짧은 시간(기본 3초) 동안 watchPosition으로 여러 fix를 받아 가장 정확한 값을 선택.
 * 매우 정확한 값(≤10m)을 받으면 조기 종료해 UX 단축.
 *
 * 단일 getCurrentPosition보다 안정적 — 첫 fix는 캐시/셀타워 기반이라 ±100m+ 흔함.
 */
export function acquireBestLocation(
  options: { maxDurationMs?: number; goodEnoughAccuracyM?: number } = {}
): Promise<{ lat: number; lng: number; accuracy: number; samples: number }> {
  const maxDurationMs = options.maxDurationMs ?? 3500
  const goodEnoughAccuracyM = options.goodEnoughAccuracyM ?? 10

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS를 지원하지 않는 기기'))
      return
    }

    let best: { lat: number; lng: number; accuracy: number } | null = null
    let samples = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      resolved = true
      navigator.geolocation.clearWatch(watchId)
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        samples += 1
        const { latitude, longitude, accuracy } = pos.coords
        if (!best || accuracy < best.accuracy) {
          best = { lat: latitude, lng: longitude, accuracy }
        }
        if (best.accuracy <= goodEnoughAccuracyM) {
          finish()
          resolve({ ...best, samples })
        }
      },
      (err) => {
        finish()
        reject(new Error(err.message || '위치를 가져올 수 없어요'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    )

    setTimeout(() => {
      finish()
      if (best) {
        resolve({ ...best, samples })
      } else {
        reject(new Error('위치를 얻지 못했어요 (시간 초과)'))
      }
    }, maxDurationMs)
  })
}
