/**
 * Requests that couldn't reach the server (no signal at the venue) wait in this browser and are sent when it's back.
 * Each entry keeps the phone's own clock and GPS, so the server records when it really happened.
 */
interface Queued {
  id: string
  url: string
  body: Record<string, unknown>
  at: string
}

const KEY = 'bpa.offline-queue'

function read(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Queued[]
  } catch {
    return []
  }
}

function write(items: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Storage full or blocked: the request is lost, as it would be without the queue.
  }
}

export function useOfflineQueue(send: (url: string, body: Record<string, unknown>) => Promise<unknown>) {
  const pending = ref(0)
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  let flushing = false

  function refresh() {
    pending.value = read().length
  }

  function isNetworkError(e: unknown): boolean {
    const err = e as { response?: unknown, statusCode?: number }
    return !navigator.onLine || (!err?.response && !err?.statusCode)
  }

  /** Send now, or keep it for later when there's no connection. Returns false when queued. */
  async function run(url: string, body: Record<string, unknown>): Promise<unknown | false> {
    const withClock = { device_at: new Date().toISOString(), ...body }
    try {
      return await send(url, withClock)
    } catch (e) {
      if (isNetworkError(e)) {
        write([...read(), { id: crypto.randomUUID(), url, body: withClock, at: withClock.device_at }])
        refresh()
        return false
      }
      throw e
    }
  }

  async function flush() {
    if (flushing || !navigator.onLine) {
      return
    }
    flushing = true
    try {
      for (const item of read()) {
        try {
          await send(item.url, item.body)
        } catch (e) {
          if (isNetworkError(e)) {
            break
          }
        }
        write(read().filter(q => q.id !== item.id))
        refresh()
      }
    } finally {
      flushing = false
    }
  }

  function onOnline() {
    online.value = true
    flush()
  }
  function onOffline() {
    online.value = false
  }

  onMounted(() => {
    refresh()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    flush()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })

  return { run, flush, pending, online }
}
