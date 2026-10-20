import type { Level } from './api'

declare module '#app' {
  interface PageMeta {
    public?: boolean
    guestOnly?: boolean
    module?: string
    level?: Level
    title?: string
    crewHome?: boolean
  }
}

export {}
