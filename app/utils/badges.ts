export interface Tone {
  bg: string
  fg: string
  bd?: string
}

const T = (bg: string, fg: string, bd?: string): Tone => ({ bg, fg, bd: bd ?? bg })

export const TONES = {
  live: T('#C4141C', '#FFFFFF'),
  blue: T('#2F5596', '#FFFFFF'),
  blueTint: T('#E6ECF6', '#244677', '#C3D0E6'),
  black: T('#0B0B0C', '#FFFFFF'),
  grey: T('#ECEEF1', '#3B3F47', '#DADDE3'),
  white: T('#FFFFFF', '#3B3F47', '#9AA0AB'),
  green: T('#E2F2E8', '#1D6B3C'),
  amber: T('#FFF1D6', '#6B4100'),
  redTint: T('#FDE7E8', '#8F0F15')
}

export const EVENT_STATUS: Record<string, { label: string, tone: Tone }> = {
  ongoing: { label: 'Ongoing', tone: TONES.live },
  upcoming: { label: 'Upcoming', tone: TONES.blueTint },
  draft: { label: 'Draft', tone: TONES.white },
  completed: { label: 'Completed', tone: TONES.grey },
  cancelled: { label: 'Cancelled', tone: TONES.black }
}

export const EQUIPMENT_STATUS: Record<string, { label: string, tone: Tone, dot: string }> = {
  available: { label: 'Available', tone: TONES.green, dot: '#1D6B3C' },
  deployed: { label: 'Deployed', tone: TONES.blueTint, dot: '#2F5596' },
  under_repair: { label: 'Under repair', tone: TONES.amber, dot: '#C98A1B' },
  lost: { label: 'Lost', tone: TONES.redTint, dot: '#ED1B24' },
  retired: { label: 'Retired', tone: TONES.grey, dot: '#9AA0AB' },
  overdue: { label: 'Deployed · overdue', tone: TONES.live, dot: '#C4141C' }
}

export const EQUIPMENT_CONDITION: Record<string, { label: string, hint: string, tone: Tone, dot: string }> = {
  good: { label: 'Good', hint: 'No issues', tone: TONES.green, dot: '#1D6B3C' },
  minor_wear: { label: 'Minor wear', hint: 'Scuffs, works fine', tone: TONES.amber, dot: '#C98A1B' },
  damaged: { label: 'Damaged', hint: 'Needs a look', tone: TONES.redTint, dot: '#C4141C' }
}

export const BOOKING_STAGE: Record<string, Tone> = {
  quote: TONES.amber,
  quote_draft: TONES.amber,
  quote_sent: TONES.amber,
  inquiry: TONES.amber,
  contract: TONES.blueTint,
  contract_sent: TONES.blueTint,
  confirmed: TONES.blue,
  ongoing: TONES.live,
  done: TONES.grey,
  completed: TONES.grey,
  cancelled: TONES.black,
  none: TONES.grey
}

export const PAYMENT_STATUS: Record<string, Tone> = {
  not_invoiced: TONES.grey,
  deposit_due: TONES.amber,
  deposit_paid: TONES.blueTint,
  overdue: TONES.live,
  paid_in_full: TONES.green,
  no_charge: TONES.grey,
  nothing_due: TONES.grey
}

export const USAGE_BADGE: Record<string, Tone> = {
  deployed: TONES.blueTint,
  returned: TONES.green,
  removed: TONES.redTint,
  swap: TONES.grey
}

export const RUN_STATUS: Record<string, Tone> = {
  draft: TONES.amber,
  finalized: TONES.blueTint,
  paid: TONES.green
}

export const INVOICE_STATUS: Record<string, Tone> = {
  paid: TONES.green,
  unpaid: TONES.amber,
  part_paid: TONES.blueTint,
  draft: TONES.grey,
  overdue: TONES.live,
  void: TONES.grey
}

/** Calendar / Gantt chips: live | conf | quote | done | cancel */
export const CAL_STYLE: Record<string, { bg: string, fg: string, bd: string, head: string }> = {
  live: { bg: '#C4141C', fg: '#FFFFFF', bd: '#C4141C', head: '#C4141C' },
  conf: { bg: '#2F5596', fg: '#FFFFFF', bd: '#2F5596', head: '#2F5596' },
  quote: { bg: '#FFFFFF', fg: '#244677', bd: '#2F5596', head: '#0B0B0C' },
  done: { bg: '#ECEEF1', fg: '#3B3F47', bd: '#9AA0AB', head: '#3B3F47' },
  cancel: { bg: '#0B0B0C', fg: '#FFFFFF', bd: '#0B0B0C', head: '#0B0B0C' }
}

export const TRIP_STATUS: Record<string, Tone> = {
  loading: TONES.amber,
  in_transit: TONES.live,
  arrived: TONES.blueTint,
  closed: TONES.grey,
  cancelled: TONES.black
}

export const TRIP_DIRECTION: Record<string, Tone> = {
  outbound: TONES.blue,
  return: TONES.black
}

export const LOCATION_STATE: Record<string, Tone> = {
  in_warehouse: TONES.green,
  in_transit: TONES.live,
  on_site: TONES.blueTint,
  repair: TONES.amber,
  missing: TONES.redTint,
  retired: TONES.grey
}

/** Trip colours on maps: on the road red, arrived blue, loading amber. */
export const TRIP_COLOR: Record<string, string> = {
  loading: '#C98A1B',
  in_transit: '#C4141C',
  arrived: '#2F5596',
  closed: '#9AA0AB',
  cancelled: '#9AA0AB'
}
