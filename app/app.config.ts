const TOKEN_KEY = 'bpa.token'

/**
 * Bearer token kept in localStorage (SPA). Crew phones stay signed in until the token expires on the API.
 */
const localTokenStorage = {
  async get() {
    if (import.meta.server) {
      return undefined
    }
    return window.localStorage.getItem(TOKEN_KEY) ?? undefined
  },
  async set(_app: unknown, token?: string) {
    if (import.meta.server) {
      return
    }
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_KEY)
    }
  }
}

export default defineAppConfig({
  sanctum: {
    tokenStorage: localTokenStorage
  },
  ui: {
    colors: {
      primary: 'blaster',
      secondary: 'ink',
      success: 'pine',
      info: 'blaster',
      warning: 'amber',
      error: 'live',
      neutral: 'ink'
    },
    button: {
      slots: { base: 'rounded-md font-semibold justify-center' }
    },
    slideover: {
      slots: {
        overlay: 'bg-[rgba(11,11,12,0.6)]',
        content: 'sm:max-w-[480px] w-full shadow-[-12px_0_32px_rgba(0,0,0,0.3)] divide-y-0 ring-0'
      }
    },
    modal: {
      slots: {
        overlay: 'bg-[rgba(11,11,12,0.6)]',
        content: 'ring-0 divide-y-0 shadow-[0_16px_48px_rgba(0,0,0,0.35)] rounded-lg overflow-hidden'
      }
    },
    toast: {
      slots: {
        root: 'bg-white ring ring-[#DADDE3] border-l-4 rounded-lg shadow-[0_8px_24px_rgba(11,11,12,0.18)] p-3.5 pe-3',
        title: 'text-[15px] font-bold text-[#0B0B0C]',
        description: 'text-[14px] text-[#3B3F47]',
        icon: 'size-6',
        close: 'text-[#565B66]'
      },
      variants: {
        color: {
          success: { root: 'border-l-success' },
          info: { root: 'border-l-info' },
          warning: { root: 'border-l-warning' },
          error: { root: 'border-l-error' },
          neutral: { root: 'border-l-[#0B0B0C]' }
        }
      }
    }
  }
})
