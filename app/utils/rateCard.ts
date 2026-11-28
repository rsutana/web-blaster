import type { Row } from '~/types/api'

export interface TruckNeed {
  type: string
  label: string
  count: number
}

export interface RateOption {
  v: string
  label: string
  line: Row
  /** Trucks a package asks for, used to pre-fill the booking's truck picker. Not sent as a quote line. */
  trucks?: TruckNeed[]
}

/** Everything on the rate card as quote lines: packages first, then equipment by the day, then services. */
export function rateCardOptions(card: Row | null): RateOption[] {
  if (!card) {
    return []
  }
  return [
    ...card.packages.map((p: Row) => ({
      v: `p${p.id}`,
      label: `${p.name} package · ${peso(p.price_per_day)}`,
      line: { description: `${p.name} package`, note: p.items.map((i: Row) => `${i.name} ×${i.count}`).join(', '), unit_rate: p.price_per_day, package_id: p.id },
      trucks: p.items.filter((i: Row) => i.type === 'truck').map((i: Row) => ({ type: i.vehicle_type, label: i.name, count: i.count }))
    })),
    ...card.classes.map((c: Row) => ({ v: `c${c.id}`, label: `${c.name} · ${peso(c.daily_rate)}`, line: { description: c.name, note: c.unit_note, unit_rate: c.daily_rate, equipment_class_id: c.id } })),
    ...card.services.map((s: Row) => ({ v: `s${s.id}`, label: `${s.name} · ${peso(s.rate)}`, line: { description: s.name, note: s.note, unit_rate: s.rate, service_rate_id: s.id } }))
  ]
}

/** Icon for each equipment category, shared by the rate-card pickers. */
export const CATEGORY_ICONS: Record<string, string> = {
  sound: 'i-lucide-speaker',
  lights: 'i-lucide-lightbulb',
  staging: 'i-lucide-layers',
  power: 'i-lucide-plug-zap',
  video: 'i-lucide-monitor',
  cables: 'i-lucide-cable',
  other: 'i-lucide-box'
}

/** "2 W. Mic, 1 Stand": what one case of a kind holds. */
export function caseContents(contents: Row[] | null | undefined): string {
  return (contents ?? []).map(c => `${c.count} ${c.name}`).join(', ')
}

/** Icon for a package item or quote line: a truck, a case, a service, or the equipment's category. */
export function rateItemIcon(i: Row, card: Row | null): string {
  if (i.type === 'truck') {
    return 'i-lucide-truck'
  }
  if (i.type === 'case') {
    return 'i-lucide-package'
  }
  if (i.package_id) {
    return 'i-lucide-boxes'
  }
  if (i.service_rate_id) {
    return 'i-lucide-hand-helping'
  }
  const category = i.category ?? card?.classes.find((c: Row) => c.id === i.equipment_class_id)?.category
  return CATEGORY_ICONS[category] ?? 'i-lucide-box'
}

/** The rate card grouped for a searchable USelectMenu. Item values match `rateCardOptions` keys. */
export function rateCardMenuItems(card: Row | null) {
  if (!card) {
    return []
  }
  const groups = [
    [
      { type: 'label' as const, label: 'Packages' },
      ...card.packages.map((p: Row) => ({
        label: p.name,
        value: `p${p.id}`,
        icon: 'i-lucide-boxes',
        description: [`${peso(p.price_per_day)}/day`, p.items.map((i: Row) => `${i.name} ×${i.count}`).join(', ')].filter(Boolean).join(' · ')
      }))
    ],
    [
      { type: 'label' as const, label: 'Equipment' },
      ...card.classes.map((c: Row) => ({
        label: c.name,
        value: `c${c.id}`,
        icon: CATEGORY_ICONS[c.category] ?? 'i-lucide-box',
        description: [`${peso(c.daily_rate)}/day`, c.owned != null ? `${c.free_today} of ${c.owned} free today` : ''].filter(Boolean).join(' · ')
      }))
    ],
    [
      { type: 'label' as const, label: 'Services' },
      ...card.services.map((s: Row) => ({
        label: s.name,
        value: `s${s.id}`,
        icon: 'i-lucide-hand-helping',
        description: [peso(s.rate), s.note].filter(Boolean).join(' · ')
      }))
    ]
  ]
  return groups.filter(g => g.length > 1)
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

/**
 * Tick enough trucks of each type a package needs, keeping trucks already ticked.
 * Owned trucks come before hired ones. Returns the new selection and what couldn't be filled.
 */
export function pickTrucks(all: Row[], picked: number[], needs: TruckNeed[]): { picked: number[], added: Row[], missing: string[] } {
  const next = [...picked]
  const added: Row[] = []
  const missing: string[] = []
  for (const need of needs) {
    const ofType = all.filter(t => t.type === need.type)
    let have = ofType.filter(t => next.includes(t.id)).length
    const spare = ofType
      .filter(t => t.is_active && !next.includes(t.id))
      .sort((a, b) => Number(a.ownership !== 'owned') - Number(b.ownership !== 'owned'))
    for (const t of spare) {
      if (have >= need.count) {
        break
      }
      next.push(t.id)
      added.push(t)
      have++
    }
    if (have < need.count) {
      missing.push(`${need.count - have} ${need.label.toLowerCase()}${need.count - have === 1 ? '' : 's'}`)
    }
  }
  return { picked: next, added, missing }
}

/** Toast text after pre-filling trucks from a package. */
export function truckPickMessage(result: { added: Row[], missing: string[] }, suffix = ''): string | null {
  const parts: string[] = []
  if (result.added.length) {
    parts.push(`${result.added.map(t => t.name).join(', ')} ticked for this package${suffix}.`)
  }
  if (result.missing.length) {
    parts.push(`Not enough trucks free to tick: ${result.missing.join(', ')} short.`)
  }
  return parts.length ? parts.join(' ') : null
}
