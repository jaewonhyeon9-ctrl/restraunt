'use client'

import { useState, useEffect } from 'react'
import { calculateDistance } from '@/lib/gps'

interface GeolocationState {
  lat: number | null
  lng: number | null
  distance: number | null
  isWithinRange: boolean
  error: string | null
  loading: boolean
}

export function useGeolocation(targetLat?: number, targetLng?: number, radius = 50) {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    distance: null,
    isWithinRange: false,
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'GPS를 지원하지 않는 기기입니다.', loading: false }))
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const distance =
          targetLat != null && targetLng != null
            ? calculateDistance(latitude, longitude, targetLat, targetLng)
            : null

        setState({
          lat: latitude,
          lng: longitude,
          distance,
          isWithinRange: distance != null ? distance <= radius : false,
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
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [targetLat, targetLng, radius])

  return state
}
