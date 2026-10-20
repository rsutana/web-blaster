import type { FetchError } from 'ofetch'

type Query = Record<string, string | number | boolean | null | undefined>
type Body = Record<string, unknown> | FormData

/**
 * Every API call goes through here: it prefixes /api/v1 and sends the bearer token via nuxt-auth-sanctum.
 */
export function useApi() {
  const client = useSanctumClient()
  const prefix = '/api/v1'

  return {
    get: <T>(url: string, query?: Query) => client<T>(prefix + url, { method: 'GET', query }),
    post: <T>(url: string, body?: Body) => client<T>(prefix + url, { method: 'POST', body }),
    put: <T>(url: string, body?: Body) => client<T>(prefix + url, { method: 'PUT', body }),
    patch: <T>(url: string, body?: Body) => client<T>(prefix + url, { method: 'PATCH', body }),
    del: <T>(url: string, body?: Body) => client<T>(prefix + url, { method: 'DELETE', body }),
    raw: (url: string, query?: Query) => client.raw(prefix + url, { method: 'GET', query, responseType: 'blob' })
  }
}

interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}

/** Field → first message, for inline form errors. Keys like "items.0" are kept as-is. */
export function fieldErrors(error: unknown): Record<string, string> {
  const data = (error as FetchError<ApiErrorBody>)?.data
  const out: Record<string, string> = {}
  for (const [key, messages] of Object.entries(data?.errors ?? {})) {
    out[key] = messages[0] ?? ''
  }
  return out
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  const data = (error as FetchError<ApiErrorBody>)?.data
  const first = Object.values(data?.errors ?? {})[0]?.[0]
  return first ?? data?.message ?? fallback
}
