import type { Row } from '~/types/api'

export interface RateOption {
  v: string
  label: string
  line: Row
}

/** Everything on the rate card as quote lines: packages first, then equipment by the day, then services. */
export function rateCardOptions(card: Row | null): RateOption[] {
  if (!card) {
    return []
  }
  return [
    ...card.packages.map((p: Row) => ({ v: `p${p.id}`, label: `${p.name} package · ${peso(p.price_per_day)}`, line: { description: `${p.name} package`, note: p.items.map((i: Row) => `${i.name} ×${i.count}`).join(', '), unit_rate: p.price_per_day, package_id: p.id } })),
    ...card.classes.map((c: Row) => ({ v: `c${c.id}`, label: `${c.name} · ${peso(c.daily_rate)}`, line: { description: c.name, note: c.unit_note, unit_rate: c.daily_rate, equipment_class_id: c.id } })),
    ...card.services.map((s: Row) => ({ v: `s${s.id}`, label: `${s.name} · ${peso(s.rate)}`, line: { description: s.name, note: s.note, unit_rate: s.rate, service_rate_id: s.id } }))
  ]
}

/** Adds the option as a line, or bumps the quantity when the same line is already there. */
export function addRateLine(lines: Row[], opt: RateOption): void {
  const same = lines.find(l => l.description === opt.line.description && Number(l.unit_rate) === Number(opt.line.unit_rate))
  if (same) {
    same.qty++
  } else {
    lines.push({ ...opt.line, qty: 1 })
  }
}
