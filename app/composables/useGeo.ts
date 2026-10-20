/**
 * Best-effort phone location. A scan never waits long for it and never fails without it.
 */
export interface GpsFix {
  latitude?: number
  longitude?: number
  accuracy?: number
  captured_at?: string
  source?: 'device' | 'denied' | 'unavailable'
}

const MAX_AGE_MS = 60_000
let last: { fix: GpsFix, at: number } | null = null

function toFix(p: GeolocationPosition): GpsFix {
  return {
    latitude: Number(p.coords.latitude.toFixed(7)),
    longitude: Number(p.coords.longitude.toFixed(7)),
    accuracy: Math.round(p.coords.accuracy),
    captured_at: new Date(p.timestamp).toISOString(),
    source: 'device'
  }
}

export function useGeo() {
  const state = useState<GpsFix | null>('geo-last', () => null)

  /** One fix, reused for a minute so bulk scanning stays fast. */
  function fix(timeout = 6000): Promise<GpsFix> {
    if (last && Date.now() - last.at < MAX_AGE_MS) {
      return Promise.resolve(last.fix)
    }
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ source: 'unavailable' })
        return
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const f = toFix(p)
          last = { fix: f, at: Date.now() }
          state.value = f
          resolve(f)
        },
        e => resolve({ source: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: true, timeout, maximumAge: MAX_AGE_MS }
      )
    })
  }

  /** Continuous tracking for a running trip. Returns a stop function. */
  function watch(onFix: (f: GpsFix, p: GeolocationPosition) => void, onError?: (denied: boolean) => void): () => void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError?.(false)
      return () => {}
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const f = toFix(p)
        last = { fix: f, at: Date.now() }
        state.value = f
        onFix(f, p)
      },
      e => onError?.(e.code === e.PERMISSION_DENIED),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }

  /** Keep the screen on while a trip is shared, so the phone keeps sending. */
  async function keepAwake(): Promise<(() => void) | null> {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
      const lock = await nav.wakeLock?.request('screen')
      return lock ? () => void lock.release() : null
    } catch {
      return null
    }
  }

  function label(f: GpsFix | null | undefined): string {
    if (!f) {
      return 'Getting location…'
    }
    if (f.source === 'denied') {
      return 'Location off'
    }
    if (f.latitude === undefined) {
      return 'No GPS'
    }
    return `GPS ±${f.accuracy ?? '?'} m`
  }

  return { fix, watch, keepAwake, label, last: state }
}

/** Metres between two points. */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
