import type { FetchError } from 'ofetch'

/** A plain sentence (shown under a default heading for its kind) or an explicit heading and message. */
export type ToastText = string | { title: string, description?: string }
type Undo = () => unknown | Promise<unknown>
type Kind = 'success' | 'info' | 'warning' | 'error'

const KINDS: Record<Kind, { icon: string, title: string, duration: number }> = {
  success: { icon: 'i-lucide-circle-check', title: 'Success', duration: 5000 },
  info: { icon: 'i-lucide-info', title: 'Notice', duration: 5000 },
  warning: { icon: 'i-lucide-triangle-alert', title: 'Heads up', duration: 7000 },
  error: { icon: 'i-lucide-circle-alert', title: 'Error', duration: 7000 }
}

/** Heading for a failed request, from its HTTP status. */
function errorTitle(error: unknown): string {
  const status = (error as FetchError)?.status
  return ({ 401: 'Signed out', 403: 'Not allowed', 404: 'Not found', 409: 'Conflict', 422: 'Check this', 429: 'Too many tries' } as Record<number, string>)[status ?? 0]
    ?? (status && status >= 500 ? 'Server error' : 'Something went wrong')
}

/**
 * Nuxt UI toasts with a heading, a message, an icon and a colour per kind:
 * `success` (green), `notify` (info, blue), `warn` (amber), `fail` (red). Any of them can carry Undo.
 */
export function useNotify() {
  const toast = useToast()

  function show(kind: Kind, text: ToastText, undo?: Undo) {
    const { title, description } = typeof text === 'string' ? { title: KINDS[kind].title, description: text } : text
    toast.add({
      title,
      description,
      icon: KINDS[kind].icon,
      color: kind,
      duration: undo ? 8000 : KINDS[kind].duration,
      actions: undo
        ? [{
            label: 'Undo',
            color: 'neutral',
            variant: 'outline',
            onClick: async () => {
              await undo()
            }
          }]
        : undefined
    })
  }

  /** Something done or worth knowing, e.g. "Saved." or "PAR-001 is already in CASE-006." */
  function notify(text: ToastText, undo?: Undo) {
    show('info', text, undo)
  }

  /** A scan or save that went through. */
  function success(text: ToastText, undo?: Undo) {
    show('success', text, undo)
  }

  /** Went through, but needs a look, e.g. saved offline or a driver already on the road. */
  function warn(text: ToastText, undo?: Undo) {
    show('warning', text, undo)
  }

  /** Takes a caught error (message pulled from the API body), a ready-made sentence, or a heading and message. */
  function fail(error: unknown, fallback?: string) {
    if (typeof error === 'string') {
      show('error', error)
    } else if (error && typeof error === 'object' && 'title' in error && typeof error.title === 'string') {
      show('error', error as ToastText)
    } else {
      show('error', { title: errorTitle(error), description: errorMessage(error, fallback) })
    }
  }

  return { notify, success, warn, fail }
}
