// HH:mm normalize (accepts "9:30", "09:30", "0930", "9시30분")
export function normalizeTime(raw: string | null): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  const patterns: RegExp[] = [
    /^(\d{1,2}):(\d{2})$/,
    /^(\d{1,2})시\s*(\d{1,2})분?$/,
    /^(\d{1,2})시$/,
    /^(\d{2})(\d{2})$/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const h = Number(m[1])
      const mi = m[2] ? Number(m[2]) : 0
      if (h >= 0 && h < 24 && mi >= 0 && mi < 60) {
        return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      }
    }
  }
  return null
}
