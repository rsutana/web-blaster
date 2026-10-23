const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const pesoFmt2 = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₱9,390 · − ₱150 · ₱128,956.80 (cents only when present, or forced). */
export function peso(value: number | string | null | undefined, cents = false): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const n = Number(value)
  const abs = Math.abs(n)
  const text = cents || abs % 1 > 0.001 ? pesoFmt2.format(abs) : pesoFmt.format(abs)
  return (n < 0 ? '− ' : '') + '₱' + text
}

export function num(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0'
  }
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

export function plural(count: number, one: string, many?: string): string {
  return `${count} ${count === 1 ? one : (many ?? one + 's')}`
}

/** 0 → 'just now', 45 → '45 min ago', 125 → '2 hr 5 min ago', 4133 → '2 days ago'. */
export function minutesAgo(minutes: number): string {
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h} hr${m ? ` ${m} min` : ''} ago`
  }
  const days = Math.floor(minutes / 1440)
  return days < 14 ? `${plural(days, 'day')} ago` : `${plural(Math.floor(days / 7), 'week')} ago`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function longDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "09175550114" → "0917 555 0114" */
export function phone(value: string | null | undefined): string {
  if (!value) {
    return ''
  }
  const d = value.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : value
}

export function moneyInput(value: string): string {
  return value.replace(/[^0-9.]/g, '')
}
