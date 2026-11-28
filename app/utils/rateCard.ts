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
    ...card.packages.map((p: Row) => ({
      v: `p${p.id}`,
      label: `${p.name} package · ${peso(p.price_per_day)}`,
      line: { description: `${p.name} package`, note: p.items.map((i: Row) => `${i.name} ×${i.count}`).join(', '), unit_rate: p.price_per_day, package_id: p.id }
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

/** Icon for a package item or quote line: a truck, a case, a crew role, a service, or the equipment's category. */
export function rateItemIcon(i: Row, card: Row | null): string {
  if (i.type === 'truck') {
    return 'i-lucide-truck'
  }
  if (i.type === 'case') {
    return 'i-lucide-package'
  }
  if (i.type === 'crew') {
    return 'i-lucide-hard-hat'
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

/** How package contents are grouped on screen, whatever order lines were added in. Cases sit with equipment. */
export const PACKAGE_ITEM_GROUPS = [
  { key: 'equipment', label: 'Equipment', types: ['class', 'case'] },
  { key: 'truck', label: 'Trucks', types: ['truck'] },
  { key: 'crew', label: 'Crew', types: ['crew'] }
]

/** Package items split into the groups above, keeping the order they were added in within each group. Empty groups are dropped. */
export function groupPackageItems(items: Row[]) {
  return PACKAGE_ITEM_GROUPS
    .map(g => ({ ...g, items: items.filter(i => g.types.includes(i.type ?? 'class')) }))
    .filter(g => g.items.length)
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
