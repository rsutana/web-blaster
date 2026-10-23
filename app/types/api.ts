export type Level = 'none' | 'own' | 'view' | 'edit' | 'full'
export type Role = 'owner' | 'admin' | 'manager' | 'crew'

export interface AuthUser {
  id: number
  name: string
  first_name: string
  initial: string
  email: string | null
  mobile: string | null
  role: Role
  role_label: string
  personnel_id: number | null
  is_must_change_credential: boolean
  credential_word: string
  home: string
  permissions: Record<string, Level>
  can_see_rates: boolean
  can_see_revenue: boolean
}

export interface Option<T extends string = string> {
  value: T
  label: string
}

export interface Paginated<T> {
  data: T[]
  meta?: Record<string, unknown>
}

/** Rows returned by the API are documented in the resource classes; pages read the fields they need. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>

export interface MapPin {
  lat: number
  lng: number
  label?: string
  color?: string
  /** Draw the geofence around it, in metres. */
  radius?: number
  /** A filled dot for things that move (trucks), a ring for places, a small dot for scans. */
  kind?: 'place' | 'truck' | 'point'
  to?: string
}

/** A truck's route drawn as a line, oldest point first. */
export interface MapPath {
  points: [number, number][]
  color?: string
  label?: string
}
