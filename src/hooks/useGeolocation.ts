'use client'

import { useState, useEffect, useCallback } from 'react'
import { checkInRange } from '@/lib/gps'

interface GeolocationState {
  lat: number | null
  lng: number | null
  distance: number | null
  accuracy: number | null
  isWithinRange: boolean
  error: string | null
  loading: boolean
}

export function useGeolocation(targetLat?: number, targetLng?: number, radius = 50) {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    distance: null,
    accuracy: null,
    isWithinRange: false,
    error: null,
    loading: true,
  })
  const [refreshTick, setRefreshTick] = useState(0)

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setRefreshTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'GPS를 지원하지 않는 기기입니다.', loading: false }))
      return
    }

    const computeRange = (latitude: number, longitude: number, accuracy: number) => {
      if (targetLat == null || targetLng == null) {
        return { distance: null, isWithinRange: false }
      }
      const result = checkInRange(latitude, longitude, targetLat, targetLng, radius, accuracy)
      return { distance: result.distance, isWithinRange: result.ok }
    }

    // 1) 즉시 한 번 — 신선한 GPS (refresh 트리거 시 maximumAge: 0)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const { distance, isWithinRange } = computeRange(latitude, longitude, accuracy)
        setState({
          lat: latitude,
          lng: longitude,
          distance,
          accuracy,
          isWithinRange,
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.code === 1 ? 'GPS 권한을 허용해주세요.' : 'GPS 오류가 발생했습니다.',
          loading: false,
        }))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )

    // 2) 지속 추적 (배경)
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const { distance, isWithinRange } = computeRange(latitude, longitude, accuracy)
        setState({
          lat: latitude,
          lng: longitude,
          distance,
          accuracy,
          isWithinRange,
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.code === 1 ? 'GPS 권한을 허용해주세요.' : 'GPS 오류가 발생했습니다.',
          loading: false,
        }))
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [targetLat, targetLng, radius, refreshTick])

  return { ...state, refresh }
}
