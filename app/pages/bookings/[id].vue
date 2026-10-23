<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'book', title: 'Booking' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can, canSeeRevenue } = useAuthUser()

const b = ref<Row | null>(null)
const rateCard = ref<Row | null>(null)
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'quote')
const lines = ref<Row[]>([])
const discount = ref('0')
const vat = ref(true)
const surcharges = ref<Row[]>([])
const addSel = ref('')
const contract = reactive<Record<string, string>>({})
const milestone = reactive({ label: '', date: '' })
const payOpen = ref(false)
const saving = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function hydrate(data: Row) {
  b.value = data
  useHead({ title: `${data.code} · ${data.name} · Blaster Pro Audio` })
  lines.value = data.quote.lines.map((l: Row) => ({ ...l }))
  discount.value = String(data.quote.discount_pct)
  vat.value = data.quote.is_vat_enabled
  surcharges.value = data.quote.surcharges.map((s: Row) => ({ ...s }))
  Object.assign(contract, Object.fromEntries(Object.entries(data.contract?.fields ?? {}).map(([k, v]) => [k, (v as string | null) ?? ''])))
}

async function load() {
  hydrate((await api.get<{ data: Row }>(`/bookings/${route.params.id}`)).data)
}
onMounted(async () => {
  await load()
  rateCard.value = (await api.get<{ data: Row }>('/rate-card')).data
})

const canEdit = computed(() => can('book', 'edit') && b.value?.stage !== 'cancelled')
const canMoney = computed(() => can('inv', 'view'))
const tabs = computed(() => {
  if (!b.value) {
    return []
  }
  const t = [{ key: 'quote', label: 'Quotation', badge: `v${b.value.quote.version}` }]
  if (can('contract')) {
    t.push({ key: 'contract', label: 'Contract', badge: b.value.is_signed ? 'Signed' : 'Unsigned' })
  }
  t.push({ key: 'timeline', label: 'Timeline', badge: String(b.value.milestones.length) })
  if (canMoney.value) {
    t.push({ key: 'payments', label: 'Payments', badge: b.value.is_deposit_paid ? 'Deposit in' : (b.value.schedule[0]?.status_label ?? '') })
    t.push({ key: 'invoices', label: 'Invoices', badge: String(b.value.invoices.length) })
  }
  return t
})
const steps = computed(() => ['Inquiry', 'Quote', 'Contract', 'Deposit', 'Confirmed', 'Event'].map((label, i) => {
  const idx = b.value!.pipeline_index
  const done = i < idx || (i === 5 && b.value!.stage === 'completed')
  const current = i === idx
  return { label, bar: done ? '#2F5596' : current ? '#ED1B24' : '#3B3F47', fg: done || current ? '#FFFFFF' : '#9EA3AD', w: current ? 700 : 500 }
}))
const stagePill = computed(() => b.value?.stage_key === 'confirmed' || b.value?.stage_key === 'ongoing' ? '#2F5596' : b.value?.stage_key === 'cancelled' ? '#C4141C' : '#3B3F47')

const rateOptions = computed(() => rateCardOptions(rateCard.value))

let timer: ReturnType<typeof setTimeout> | undefined
function saveQuote() {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    saving.value = true
    try {
      const res = await api.put<{ data: Row }>(`/bookings/${b.value!.id}/quote`, {
        lines: lines.value.map(l => ({ id: l.id, description: l.description, note: l.note, unit_rate: l.unit_rate, qty: l.qty, package_id: l.package_id ?? null, equipment_class_id: l.equipment_class_id ?? null, service_rate_id: l.service_rate_id ?? null })),
        discount_pct: Math.min(100, Math.max(0, Number(discount.value) || 0)),
        is_vat_enabled: vat.value,
        surcharges: surcharges.value.map(s => ({ kind: s.kind, is_enabled: s.is_enabled, quantity: Number(s.quantity) || 1 }))
      })
      hydrate(res.data)
    } catch (e) {
      fail(e)
    } finally {
      saving.value = false
    }
  }, 350)
}

function qty(l: Row, delta: number) {
  l.qty = Math.max(1, l.qty + delta)
  saveQuote()
}

function removeLine(l: Row) {
  lines.value = lines.value.filter(x => x !== l)
  saveQuote()
}

function addLine() {
  const opt = rateOptions.value.find(o => o.v === addSel.value)
  if (!opt) {
    return
  }
  addRateLine(lines.value, opt)
  addSel.value = ''
  saveQuote()
}

const latestQuote = computed(() => b.value?.quote.latest_version ?? null)
/** A new version is needed when there's none yet or the lines changed since the last one. */
const needsGenerate = computed(() => !latestQuote.value || b.value?.quote.is_dirty)
const quoteBusy = ref(false)

async function generateQuote() {
  quoteBusy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/bookings/${b.value!.id}/quote-versions`, {})
    hydrate(res.data)
    notify(`Quote v${res.data.quote.version} generated (${peso(res.data.quote.total, true)}). Download it or send it to the client.`)
  } catch (e) {
    fail(e)
  } finally {
    quoteBusy.value = false
  }
}

async function sendQuote() {
  quoteBusy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/quote-versions/${latestQuote.value!.id}/dispatches`, {})
    hydrate(res.data)
    notify(`Quote v${latestQuote.value!.version} sent to ${res.data.quote.sent_to ?? 'the client'}.`)
  } catch (e) {
    fail(e)
  } finally {
    quoteBusy.value = false
  }
}

async function convert() {
  try {
    const res = await api.post<{ data: Row }>(`/bookings/${b.value!.id}/invoices`, { kind: 'auto' })
    await load()
    notify(`${res.data.number} drafted for ${peso(res.data.amount, true)}.`)
    tab.value = 'invoices'
  } catch (e) {
    fail(e)
  }
}

async function saveContract() {
  try {
    const res = await api.put<{ data: Row }>(`/bookings/${b.value!.id}/contract`, { ...contract })
    hydrate(res.data)
    notify('Contract saved. Change logged in contracts history.')
  } catch (e) {
    fail(e)
  }
}

async function attach(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) {
    return
  }
  const fd = new FormData()
  fd.append('file', f)
  try {
    hydrate((await api.post<{ data: Row }>(`/bookings/${b.value!.id}/attachments`, fd)).data)
    notify('Stage plot attached.')
  } catch (err) {
    fail(err)
  } finally {
    (e.target as HTMLInputElement).value = ''
  }
}

async function removeAttachment(a: Row) {
  try {
    await api.del(`/attachments/${a.id}`)
    await load()
  } catch (e) {
    fail(e)
  }
}

async function resendLink() {
  try {
    hydrate((await api.post<{ data: Row }>(`/bookings/${b.value!.id}/signing-link`)).data)
    notify(`Signing link sent${b.value!.contract.link_sent_count > 1 ? ' again' : ''} to ${contract.contact_email || b.value!.client.email}.`)
  } catch (e) {
    fail(e)
  }
}

async function markSigned() {
  try {
    const res = await api.post<{ data: Row, meta: { is_confirmed_now: boolean } }>(`/bookings/${b.value!.id}/signature`, {})
    hydrate(res.data)
    notify(res.meta.is_confirmed_now ? 'Contract signed. Booking confirmed.' : 'Contract signed. Waiting on the deposit to confirm.')
  } catch (e) {
    fail(e)
  }
}

async function toggleMilestone(m: Row) {
  if (m.is_locked || !canEdit.value) {
    return
  }
  try {
    await api.patch(`/milestones/${m.id}`, { is_done: !m.is_done })
    await load()
  } catch (e) {
    fail(e)
  }
}

async function addMilestone() {
  if (!milestone.label.trim()) {
    return
  }
  try {
    await api.post(`/bookings/${b.value!.id}/milestones`, { label: milestone.label, due_on: milestone.date || null })
    milestone.label = ''
    milestone.date = ''
    await load()
    notify('Milestone added.')
  } catch (e) {
    fail(e)
  }
}

async function onPaid(p: Row) {
  await load()
  notify(`${peso(p.amount, true)} recorded.${p.is_booking_confirmed ? ' Booking confirmed.' : (b.value!.is_deposit_paid && !b.value!.is_signed ? ' Deposit complete. Waiting on the signed contract.' : '')}`)
}

async function balanceInvoice() {
  try {
    const res = await api.post<{ data: Row }>(`/bookings/${b.value!.id}/invoices`, { kind: 'balance' })
    await load()
    notify(`${res.data.number} drafted for the balance of ${peso(res.data.amount, true)}.`)
  } catch (e) {
    fail(e)
  }
}

const CONTRACT_GROUPS = [
  { title: 'Event details', fields: [['event_name', 'Event name', true], ['event_date_text', 'Date'], ['venue_address', 'Venue address']] },
  { title: 'Contact person', fields: [['contact_name_role', 'Name & role'], ['contact_mobile', 'Mobile'], ['contact_email', 'Email']] },
  { title: 'Schedule', fields: [['load_in', 'Load-in'], ['show_time', 'Show time'], ['load_out', 'Load-out']] },
  { title: 'Technical requirements', fields: [['power_requirements', 'Power requirements', true], ['stage_size', 'Stage size'], ['crew_note', 'Crew']] }
] as const
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!b"
      variant="booking"
    />
    <template v-else>
      <NuxtLink
        to="/bookings"
        class="inline-flex min-h-8 items-center gap-1.5 self-start text-sm font-semibold"
      >
        <UIcon
          name="i-lucide-chevron-left"
          class="size-3.5"
        />All bookings
      </NuxtLink>

      <header class="flex flex-col gap-4 rounded-lg bg-[#0B0B0C] px-[22px] py-5 text-white">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-1.5">
            <span class="flex items-center gap-2 text-[13px] text-[#C9CCD2]"><span class="font-mono">{{ b.code }}</span><span
              class="rounded px-2 py-0.5 text-xs font-bold tracking-[.04em] text-white uppercase"
              :style="{ background: stagePill }"
            >{{ b.stage_label }}</span></span>
            <h1 class="font-display m-0 text-[40px] leading-none font-extrabold uppercase">
              {{ b.name }}
            </h1>
            <span class="text-[15px] text-[#C9CCD2]">{{ b.client.name }} · {{ b.long_dates }} · {{ [b.venue_name, b.venue_city].filter(Boolean).join(', ') }}</span>
          </div>
          <div
            v-if="canSeeRevenue"
            class="flex flex-wrap gap-5"
          >
            <div
              v-for="[l, v, c] in [['Total', b.quote.total, ''], ['Paid', b.paid, ''], ['Balance', b.balance, 'text-[#FF8A8F]']]"
              :key="l"
              class="flex flex-col"
            >
              <span class="text-xs font-bold tracking-[.06em] text-[#9EA3AD] uppercase">{{ l }}</span>
              <span
                class="font-display text-[30px] font-extrabold"
                :class="c"
              >{{ peso(v, true) }}</span>
            </div>
          </div>
        </div>
        <ol
          aria-label="Booking progress"
          class="m-0 grid list-none grid-cols-6 gap-1 p-0"
        >
          <li
            v-for="s in steps"
            :key="s.label"
            class="flex flex-col gap-1.5 text-[13px]"
            :style="{ color: s.fg, fontWeight: s.w }"
          >
            <span
              aria-hidden="true"
              class="h-1.5 rounded-sm"
              :style="{ background: s.bar }"
            />{{ s.label }}
          </li>
        </ol>
      </header>

      <div
        v-if="b.is_confirmed"
        role="status"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-[6px] border-[#1D6B3C] bg-[#E2F2E8] px-4 py-3.5 text-[#1D6B3C]"
      >
        <span class="font-semibold">Contract signed and deposit received. This booking is confirmed and now appears under Events.</span>
        <NuxtLink
          v-if="b.event_id"
          :to="`/events/${b.event_id}`"
          class="font-bold text-[#1D6B3C]"
        >Open event</NuxtLink>
      </div>

      <div
        role="tablist"
        aria-label="Booking sections"
        class="flex flex-wrap gap-1 border-b-2 border-[#DADDE3]"
      >
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key"
          class="-mb-0.5 min-h-11 cursor-pointer border-0 border-b-[3px] bg-transparent px-4 text-[15px] font-bold"
          :class="tab === t.key ? 'border-[#2F5596] text-[#0B0B0C]' : 'border-transparent text-[#565B66]'"
          @click="tab = t.key"
        >
          {{ t.label }}<span
            class="ml-2 rounded px-1.5 py-0.5 text-xs font-bold"
            :class="tab === t.key ? 'bg-[#E6ECF6] text-[#244677]' : 'bg-[#ECEEF1] text-[#3B3F47]'"
          >{{ t.badge }}</span>
        </button>
      </div>

      <!-- Quotation -->
      <div
        v-if="tab === 'quote'"
        class="flex flex-wrap items-start gap-[18px]"
      >
        <section
          aria-label="Quote lines"
          class="card min-w-0 flex-[999_1_520px]"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#DADDE3] px-4 py-3.5">
            <h2 class="font-display m-0 text-2xl font-extrabold uppercase">
              Quotation
            </h2>
            <span class="flex items-center gap-2 text-[13px]"><span class="text-[#565B66]">{{ b.quote.sent_label }}</span><span
              v-if="b.quote.is_dirty && latestQuote"
              class="rounded bg-[#FFF1D6] px-2 py-0.5 font-bold text-[#6B4100]"
            >Changed since v{{ latestQuote.version }}</span><span
              v-if="saving"
              class="text-[#565B66]"
            >Saving…</span></span>
          </div>
          <div class="tbl-wrap">
            <table
              class="tbl"
              style="min-width: 600px"
            >
              <thead>
                <tr>
                  <th>Item</th><th class="text-right">
                    Rate
                  </th><th class="text-center">
                    Qty
                  </th><th class="text-right">
                    Amount
                  </th><th><span class="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(l, i) in lines"
                  :key="l.id ?? 'n' + i"
                >
                  <td data-cell="title">
                    <b>{{ l.description }}</b><div class="text-[13px] text-[#565B66]">
                      {{ l.note }}
                    </div>
                  </td>
                  <td
                    data-label="Rate"
                    class="text-right whitespace-nowrap"
                  >
                    {{ peso(l.unit_rate) }}
                  </td>
                  <td data-label="Qty">
                    <div class="flex items-center justify-center gap-1">
                      <button
                        v-if="canEdit"
                        type="button"
                        aria-label="Fewer"
                        class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
                        @click="qty(l, -1)"
                      >
                        −
                      </button>
                      <span class="min-w-8 text-center font-semibold">{{ l.qty }}</span>
                      <button
                        v-if="canEdit"
                        type="button"
                        aria-label="More"
                        class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
                        @click="qty(l, 1)"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td
                    data-label="Amount"
                    class="text-right font-bold whitespace-nowrap"
                  >
                    {{ peso(Number(l.unit_rate) * l.qty) }}
                  </td>
                  <td
                    data-cell="actions"
                    class="text-right"
                  >
                    <button
                      v-if="canEdit"
                      type="button"
                      aria-label="Remove line"
                      class="inline-flex size-8 cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
                      @click="removeLine(l)"
                    >
                      <UIcon
                        name="i-lucide-x"
                        class="size-4"
                      />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <UiEmpty
            v-if="!lines.length"
            text="No lines yet. Add a package or items from the rate card."
          />
          <div
            v-if="canEdit"
            class="flex flex-wrap items-center gap-2 border-t border-[#DADDE3] px-4 py-3"
          >
            <label
              for="add-line"
              class="text-sm font-semibold"
            >Add from rate card</label>
            <select
              id="add-line"
              v-model="addSel"
              class="ctl ctl-sm"
              style="width: auto; max-width: 320px"
            >
              <option value="">
                Choose…
              </option>
              <option
                v-for="o in rateOptions"
                :key="o.v"
                :value="o.v"
              >
                {{ o.label }}
              </option>
            </select>
            <button
              type="button"
              class="btn btn-outline-blue btn-sm"
              :disabled="!addSel"
              @click="addLine"
            >
              Add line
            </button>
            <NuxtLink
              to="/bookings/packages"
              class="ml-auto text-sm font-semibold"
            >Edit rates</NuxtLink>
          </div>
        </section>

        <aside
          aria-label="Pricing"
          class="flex min-w-0 flex-[1_1_320px] flex-col gap-3"
        >
          <section class="card flex flex-col gap-3 p-4">
            <h3 class="h-section m-0 text-lg">
              Discount
            </h3>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="discount"
                inputmode="decimal"
                aria-label="Discount percent"
                class="ctl ctl-sm"
                style="width: 72px"
                :disabled="!canEdit"
                @change="saveQuote"
              >% off equipment &amp; services
            </label>
            <h3 class="h-section mt-1 mb-0 text-lg">
              Add-ons &amp; surcharges
            </h3>
            <template
              v-for="s in surcharges"
              :key="s.kind"
            >
              <label class="flex min-h-10 cursor-pointer items-start gap-2.5 text-sm">
                <input
                  v-model="s.is_enabled"
                  type="checkbox"
                  class="mt-0.5 size-5 flex-none accent-[#2F5596]"
                  :disabled="!canEdit"
                  @change="saveQuote"
                >
                <span class="flex-1"><b>{{ s.label }}</b><span class="block text-[13px] text-[#565B66]">{{ s.note }}</span></span>
                <span class="font-bold whitespace-nowrap">{{ peso(s.amount) }}</span>
              </label>
              <label
                v-if="s.is_enabled && (s.kind === 'overtime' || s.kind === 'extra_day')"
                class="flex items-center gap-2 pl-[30px] text-sm"
              >{{ s.kind === 'overtime' ? 'OT hours' : 'Extra days' }}
                <input
                  v-model="s.quantity"
                  inputmode="numeric"
                  class="ctl ctl-sm"
                  style="width: 60px; min-height: 36px"
                  @change="saveQuote"
                >
              </label>
            </template>
            <label class="flex min-h-10 cursor-pointer items-center gap-2.5 border-t border-[#EEF0F2] pt-2 text-sm">
              <input
                v-model="vat"
                type="checkbox"
                class="size-5 accent-[#2F5596]"
                :disabled="!canEdit"
                @change="saveQuote"
              >Add 12% VAT
            </label>
          </section>
          <section class="flex flex-col gap-1.5 rounded-lg bg-[#0B0B0C] p-4 text-sm text-white">
            <div
              v-for="[l, v] in [['Subtotal', peso(b.quote.subtotal, true)], [`Discount (${num(b.quote.discount_pct)}%)`, '− ' + peso(b.quote.discount, true)], ['Add-ons & surcharges', peso(b.quote.surcharge_total, true)], ['Net of VAT', peso(b.quote.net, true)], ['VAT 12%', peso(b.quote.vat, true)]]"
              :key="l"
              class="flex justify-between"
            >
              <span class="text-[#C9CCD2]">{{ l }}</span><span>{{ v }}</span>
            </div>
            <div class="mt-0.5 flex items-baseline justify-between border-t border-[#3B3F47] pt-2">
              <b class="tracking-[.04em] uppercase">Total</b><span class="figure text-[32px]">{{ peso(b.quote.total, true) }}</span>
            </div>
            <div class="flex justify-between text-[#C9CCD2]">
              <span>{{ num(b.quote.deposit_pct) }}% deposit</span><span>{{ peso(b.quote.deposit, true) }}</span>
            </div>
          </section>
          <div
            v-if="canEdit || latestQuote"
            class="flex flex-wrap gap-2"
          >
            <button
              v-if="canEdit && needsGenerate"
              type="button"
              class="btn btn-primary flex-[1_1_140px]"
              style="min-height: 48px"
              :disabled="!lines.length || saving || quoteBusy"
              @click="generateQuote"
            >
              Generate quote
            </button>
            <NuxtLink
              v-if="latestQuote"
              :to="`/quotes/${latestQuote.id}`"
              class="btn flex-[1_1_140px]"
              :class="needsGenerate ? 'btn-secondary' : 'btn-primary'"
              style="min-height: 48px"
            >
              <UIcon
                name="i-lucide-download"
                class="size-[18px]"
              />Download quote v{{ latestQuote.version }}
            </NuxtLink>
            <button
              v-if="canEdit && latestQuote"
              type="button"
              class="btn btn-secondary flex-[1_1_140px]"
              style="min-height: 48px"
              :disabled="quoteBusy"
              @click="sendQuote"
            >
              {{ latestQuote.is_sent ? 'Send again' : 'Send quote' }} v{{ latestQuote.version }}
            </button>
            <button
              v-if="canEdit && can('inv', 'edit')"
              type="button"
              class="btn btn-strong flex-[1_1_140px] font-bold"
              style="min-height: 48px"
              :disabled="!lines.length"
              @click="convert"
            >
              Convert to invoice
            </button>
          </div>
          <p class="m-0 text-[13px] text-[#565B66]">
            Generating saves a new quote version to the history log. Download it as a PDF, or send it to the client by email (optional).
          </p>
        </aside>
      </div>

      <!-- Contract -->
      <div
        v-if="tab === 'contract' && b.contract"
        class="flex flex-wrap items-start gap-[18px]"
      >
        <section class="card flex min-w-0 flex-[999_1_520px] flex-col gap-5 p-4">
          <div
            v-for="g in CONTRACT_GROUPS"
            :key="g.title"
            class="flex flex-col gap-3"
          >
            <h3 class="h-section m-0 text-lg">
              {{ g.title }}
            </h3>
            <div
              class="grid gap-3"
              style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))"
            >
              <UiField
                v-for="[key, label, wide] in g.fields"
                :key="key"
                :label="label"
                :style="wide ? 'grid-column: 1 / -1' : ''"
              >
                <input
                  v-model="contract[key]"
                  type="text"
                  class="ctl"
                  :disabled="!can('contract', 'edit')"
                >
              </UiField>
            </div>
          </div>
          <div class="flex flex-col gap-2.5">
            <h3 class="h-section m-0 text-lg">
              Client tech rider &amp; stage plot
            </h3>
            <div
              v-for="a in b.contract.attachments"
              :key="a.id"
              class="flex items-center gap-3 rounded-md border border-[#DADDE3] p-3"
            >
              <UIcon
                name="i-lucide-file-text"
                class="size-6 text-[#B4121A]"
              />
              <a
                :href="a.url"
                target="_blank"
                rel="noopener"
                class="flex-1 font-semibold"
              >{{ a.name }}<span class="block text-[13px] font-normal text-[#565B66]">{{ a.size }} · {{ a.date }}</span></a>
              <button
                v-if="can('contract', 'edit')"
                type="button"
                aria-label="Remove file"
                class="inline-flex size-8 cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
                @click="removeAttachment(a)"
              >
                <UIcon
                  name="i-lucide-x"
                  class="size-4"
                />
              </button>
            </div>
            <button
              v-if="can('contract', 'edit')"
              type="button"
              class="btn min-h-11 border-2 border-dashed border-[#B9BEC7] bg-white font-semibold text-[#2F5596]"
              @click="fileInput?.click()"
            >
              + Attach stage plot or rider
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".pdf,image/*"
              class="sr-only"
              @change="attach"
            >
          </div>
          <div class="flex flex-col gap-2 rounded-md bg-[#F2F3F5] p-3.5 text-sm">
            <h3 class="h-section m-0 text-lg">
              Add-ons, surcharges &amp; terms
            </h3>
            <p class="m-0">
              Surcharges in this contract: <b>{{ b.quote.surcharges.filter((s: Row) => s.is_enabled).map((s: Row) => s.label).join(', ') || 'none' }}</b> · <button
                type="button"
                class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#2F5596] underline"
                @click="tab = 'quote'"
              >
                Change in quotation
              </button>
            </p>
            <ul class="m-0 flex flex-col gap-1 pl-4 text-[#3B3F47]">
              <li>Rush fee if confirmed less than 14 days before the event.</li>
              <li>Overtime per hour after the agreed load-out.</li>
              <li>Holiday surcharge on regular / special non-working holidays.</li>
              <li>Extra days at 50% of the package rate per day.</li>
              <li>{{ num(b.deposit_pct) }}% deposit locks the date; balance due 7 days after the event.</li>
              <li>Cancellation within 14 days forfeits the deposit.</li>
            </ul>
          </div>
          <button
            v-if="can('contract', 'edit')"
            type="button"
            class="btn btn-primary self-start"
            style="min-height: 48px"
            @click="saveContract"
          >
            Save contract
          </button>
        </section>
        <aside class="card flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-4">
          <h3 class="h-section m-0 text-lg">
            E-signature
          </h3>
          <div
            class="flex gap-2.5 rounded-md p-3 text-sm"
            :class="b.contract.company_signed ? 'bg-[#E2F2E8] text-[#1D6B3C]' : 'bg-[#F2F3F5] text-[#3B3F47]'"
          >
            <UIcon
              :name="b.contract.company_signed ? 'i-lucide-check' : 'i-lucide-clock'"
              class="mt-0.5 size-5 flex-none"
            />
            <span><b>Blaster Pro Audio</b><span class="block">{{ b.contract.company_signed ?? 'Signs when the link is sent' }}</span></span>
          </div>
          <div
            class="flex gap-2.5 rounded-md p-3 text-sm"
            :class="b.is_signed ? 'bg-[#E2F2E8] text-[#1D6B3C]' : 'bg-[#FFF1D6] text-[#6B4100]'"
          >
            <span
              aria-hidden="true"
              class="mt-1.5 size-2.5 flex-none rounded-full"
              :class="b.is_signed ? 'bg-[#1D6B3C]' : 'bg-[#B26B00]'"
            />
            <span><b>{{ b.client.name }}</b><span class="block">{{ b.is_signed ? b.contract.client_signed : (b.contract.link_sent ? 'Waiting · ' + b.contract.link_sent : 'Not sent yet') }}</span></span>
          </div>
          <template v-if="!b.is_signed && can('contract', 'edit')">
            <button
              type="button"
              class="btn btn-outline-blue"
              @click="resendLink"
            >
              {{ b.contract.link_sent ? 'Resend signing link' : 'Send signing link' }}
            </button>
            <button
              type="button"
              class="btn btn-dark"
              @click="markSigned"
            >
              Mark signed (paper copy)
            </button>
          </template>
          <a
            :href="b.contract.signing_url"
            target="_blank"
            rel="noopener"
            class="text-sm font-semibold"
          >Open the client's signing page</a>
          <p class="m-0 text-[13px] text-[#565B66]">
            The client signs on their phone from the emailed link. Name, time and IP are saved with the signature.
          </p>
        </aside>
      </div>

      <!-- Timeline -->
      <section
        v-if="tab === 'timeline'"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2 class="h-section m-0">
            Project timeline
          </h2>
        </div>
        <ol class="m-0 flex list-none flex-col p-4">
          <li
            v-for="(m, i) in (b.milestones as Row[])"
            :key="m.id"
            class="grid grid-cols-[88px_28px_1fr] gap-3"
          >
            <span
              class="pt-0.5 text-sm font-semibold"
              :class="m.is_done ? 'text-[#565B66]' : 'text-[#0B0B0C]'"
            >{{ m.date }}</span>
            <span class="flex flex-col items-center">
              <button
                type="button"
                :aria-pressed="m.is_done"
                :aria-label="`${m.label}: ${m.is_done ? 'done' : 'not done'}`"
                :disabled="m.is_locked || !canEdit"
                class="flex size-6 flex-none items-center justify-center rounded-full border-2"
                :class="[m.is_done ? 'border-[#2F5596] bg-[#2F5596] text-white' : 'border-[#B9BEC7] bg-white', m.is_locked ? 'cursor-default' : 'cursor-pointer']"
                @click="toggleMilestone(m)"
              >
                <UIcon
                  v-if="m.is_done"
                  name="i-lucide-check"
                  class="size-3.5"
                />
              </button>
              <span
                v-if="i < b.milestones.length - 1"
                class="w-0.5 flex-1 bg-[#DADDE3]"
              />
            </span>
            <div class="pb-4">
              <b>{{ m.label }}</b><div class="text-[13px] text-[#565B66]">
                {{ m.note }}
              </div>
            </div>
          </li>
        </ol>
        <form
          v-if="canEdit"
          class="flex flex-wrap items-end gap-2 border-t border-[#DADDE3] p-4"
          @submit.prevent="addMilestone"
        >
          <UiField
            label="Milestone"
            class="flex-[2_1_240px]"
          >
            <input
              v-model="milestone.label"
              type="text"
              class="ctl"
              placeholder="e.g. Tech rehearsal with client's AV team"
            >
          </UiField>
          <UiField
            label="Date"
            class="flex-[1_1_140px]"
          >
            <input
              v-model="milestone.date"
              type="date"
              class="ctl"
            >
          </UiField>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="!milestone.label.trim()"
          >
            Add milestone
          </button>
        </form>
      </section>

      <!-- Payments -->
      <template v-if="tab === 'payments'">
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Deposits &amp; payment schedule
            </h2>
            <button
              v-if="can('inv', 'edit') && b.balance > 0"
              type="button"
              class="btn btn-primary btn-sm"
              @click="payOpen = true"
            >
              Record payment
            </button>
          </div>
          <div
            v-for="s in b.schedule"
            :key="s.label"
            class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3.5"
          >
            <div>
              <b>{{ s.label }}</b><div class="text-[13px] text-[#565B66]">
                {{ s.detail }}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-display text-xl font-bold">{{ peso(s.amount, true) }}</span>
              <UiBadge
                :tone="s.status === 'paid' ? TONES.green : s.status === 'due' ? TONES.amber : s.status === 'part' ? TONES.blueTint : TONES.grey"
                :label="s.status_label"
              />
            </div>
          </div>
        </section>
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Payments received
            </h2>
          </div>
          <div
            v-for="p in b.payments"
            :key="p.id"
            class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3"
          >
            <div>
              <b>{{ p.method_label }}</b> · <span :class="p.reference ? 'font-mono' : 'text-[#565B66]'">{{ p.reference ?? 'No reference' }}</span>
              <div class="text-[13px] text-[#565B66]">
                {{ p.received_on }} · recorded by {{ p.recorded_by }}{{ p.invoice_number ? ' · ' + p.invoice_number : '' }}
              </div>
            </div>
            <span class="font-display text-xl font-bold text-[#1D6B3C]">{{ peso(p.amount, true) }}</span>
          </div>
          <UiEmpty
            v-if="!b.payments.length"
            :text="`No payments yet. The deposit of ${peso(b.quote.deposit, true)} is due ${b.schedule[0]?.detail.split(' · ')[0].replace('Due ', '')}.`"
          />
        </section>
        <BookingsRecordPaymentModal
          v-model:open="payOpen"
          :url="`/bookings/${b.id}/payments`"
          :subtitle="`${b.code} · balance ${peso(b.balance, true)}`"
          :default-amount="b.next_payment_default"
          :max="b.balance"
          with-date
          @saved="onPaid"
        />
      </template>

      <!-- Invoices -->
      <section
        v-if="tab === 'invoices'"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2 class="h-section m-0">
            Invoices
          </h2>
          <button
            v-if="can('inv', 'edit') && !b.has_balance_invoice && b.quote.total > 0"
            type="button"
            class="btn btn-outline-blue btn-sm"
            @click="balanceInvoice"
          >
            Generate balance invoice
          </button>
        </div>
        <div
          v-for="inv in b.invoices"
          :key="inv.id"
          class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3.5"
        >
          <div>
            <NuxtLink
              :to="`/invoices/${inv.id}`"
              class="font-mono font-medium"
            >{{ inv.number }}</NuxtLink>
            <div class="text-[13px] text-[#565B66]">
              {{ inv.label }} · issued {{ inv.issued_on }} · due {{ inv.due_on }}
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-display text-xl font-bold">{{ peso(inv.amount, true) }}</span>
            <UiBadge
              :tone="INVOICE_STATUS[inv.status] ?? TONES.grey"
              :label="inv.status_label"
            />
          </div>
        </div>
        <UiEmpty
          v-if="!b.invoices.length"
          text="No invoices yet. Use Convert to invoice on the quotation."
        />
      </section>
    </template>
  </div>
</template>
