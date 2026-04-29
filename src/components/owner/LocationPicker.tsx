'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  initialLat?: number | null
  initialLng?: number | null
  onChange: (lat: number, lng: number) => void
  height?: string
}

const SEOUL = { lat: 37.5665, lng: 126.978 }

export function LocationPicker({
  initialLat,
  initialLng,
  onChange,
  height = '260px',
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [pos, setPos] = useState<{ lat: number; lng: number }>({
    lat: initialLat ?? SEOUL.lat,
    lng: initialLng ?? SEOUL.lng,
  })

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    async function init() {
      // Leaflet CSS
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.dataset.leaflet = '1'
        document.head.appendChild(link)
      }

      const L = (await import('leaflet')).default

      // 기본 마커 아이콘 fix (webpack/Next 환경)
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })

      if (cancelled || !mapRef.current) return

      const start: [number, number] = [
        initialLat ?? SEOUL.lat,
        initialLng ?? SEOUL.lng,
      ]
      const map = L.map(mapRef.current, {
        center: start,
        zoom: initialLat ? 16 : 13,
        scrollWheelZoom: true,
      })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker(start, { draggable: true, icon: DefaultIcon }).addTo(map)
      markerRef.current = marker

      const handleClick = (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng)
        const next = { lat: e.latlng.lat, lng: e.latlng.lng }
        setPos(next)
        onChange(next.lat, next.lng)
      }
      const handleDrag = () => {
        const ll = marker.getLatLng()
        const next = { lat: ll.lat, lng: ll.lng }
        setPos(next)
        onChange(next.lat, next.lng)
      }
      map.on('click', handleClick)
      marker.on('dragend', handleDrag)

      // 초기 좌표 없으면 부모에 알림 (사용자가 클릭 안 하고 저장하는 경우 방지)
      if (initialLat == null || initialLng == null) {
        onChange(start[0], start[1])
      }

      setLoading(false)

      unsub = () => {
        map.off('click', handleClick)
        marker.off('dragend', handleDrag)
        map.remove()
      }
    }

    init().catch(console.error)
    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('이 기기는 위치 정보를 지원하지 않아요.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const map = mapInstanceRef.current
        const marker = markerRef.current
        if (map && marker) {
          map.setView([lat, lng], 17)
          marker.setLatLng([lat, lng])
        }
        setPos({ lat, lng })
        onChange(lat, lng)
      },
      (err) => {
        alert(`현재 위치를 가져올 수 없어요: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
        <div ref={mapRef} className="absolute inset-0 z-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-xs text-gray-500">
            지도 로딩 중…
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 mono tabular-nums">
          {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
        </p>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
        >
          📍 현재 위치 사용
        </button>
      </div>
      <p className="text-[10px] text-gray-400">
        지도를 클릭하거나 핀을 드래그해서 정확한 매장 위치를 지정하세요. 출퇴근 GPS 검증 기준점이 됩니다.
      </p>
    </div>
  )
}
