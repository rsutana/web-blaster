<script setup lang="ts">
import type { Row } from '~/types/api'

const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { notify, fail } = useNotify()
const clients = ref<Row[]>([])
const eventTypes = ref<Row[]>([])
const autofilled = ref(false)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const rateCard = ref<Row | null>(null)
const lines = ref<Row[]>([])
const rateOptions = computed(() => rateCardOptions(rateCard.value))
const rateItems = computed(() => rateCardMenuItems(rateCard.value))
const openLines = ref<Record<string, boolean>>({})
const lineKey = (l: Row) => `${l.description}:${l.unit_rate}`
const isLineOpen = (l: Row) => openLines.value[lineKey(l)] !== false
function toggleLine(l: Row) {
  openLines.value[lineKey(l)] = !isLineOpen(l)
}
/** What a package line includes, straight from the rate card. Empty for equipment and services. */
function packageItems(l: Row): Row[] {
  return l.package_id ? (rateCard.value?.packages.find((p: Row) => p.id === l.package_id)?.items ?? []) : []
}
const itemTotal = (items: Row[]) => items.reduce((n, i) => n + Number(i.count), 0)
const subtotal = computed(() => lines.value.reduce((sum, l) => sum + Number(l.unit_rate) * l.qty, 0))
const blank = () => ({
  client_id: '' as number | string, name: '', event_type_id: '' as number | string, contact_name: '', contact_mobile: '',
  start_date: '', end_date: '', call_time: '06:00', show_time: '', egress_time: '23:00',
  venue_name: '', venue_city: '', hall_room: '', loading_notes: '', crew_notes: '',
  terms: 'deposit' as 'deposit' | 'after', deposit_pct: '50', payment_due_days: '7'
})
const form = reactive(blank())
const typeOptions = computed(() => eventTypes.value.filter(t => t.is_active))
const days = computed(() => {
  if (!form.start_date || !form.end_date) {
    return 0
  }
  return Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1
})

watch(open, async (v) => {
  if (v) {
    Object.assign(form, blank())
    errors.value = {}
    lines.value = []
    openLines.value = {}
    autofilled.value = false
    const [clientRows, card, types] = await Promise.all([
      api.get<{ data: Row[] }>('/clients'),
      api.get<{ data: Row }>('/rate-card'),
      api.get<{ data: Row[] }>('/event-types').catch(() => ({ data: [] as Row[] }))
    ])
    clients.value = clientRows.data.filter(c => c.status === 'active')
    rateCard.value = card.data
    eventTypes.value = types.data
    if (!form.event_type_id) {
      form.event_type_id = typeOptions.value[0]?.id ?? ''
    }
  }
})

function pickClient() {
  const c = clients.value.find(x => x.id === Number(form.client_id))
  if (c) {
    form.contact_name = [c.contact_name, c.contact_position ? `(${c.contact_position})` : ''].filter(Boolean).join(' ')
    form.contact_mobile = c.mobile ?? ''
    form.venue_city = form.venue_city || c.city || ''
    form.terms = c.type === 'government_lgu' ? 'after' : 'deposit'
    autofilled.value = true
  }
}

function addLine(value: string | null) {
  const opt = rateOptions.value.find(o => o.v === value)
  if (opt) {
    addRateLine(lines.value, opt)
  }
}

function qty(l: Row, delta: number) {
  l.qty = Math.max(1, l.qty + delta)
}
watch(() => form.terms, (t) => {
  form.payment_due_days = t === 'after' ? '30' : '7'
})

async function save() {
  busy.value = true
  errors.value = {}
  try {
    const { terms, ...fields } = form
    const res = await api.post<{ data: Row, meta?: { warnings?: string[] } }>('/bookings', {
      ...fields,
      event_type_id: form.event_type_id || null,
      deposit_pct: terms === 'after' ? 0 : (Number(form.deposit_pct) || 50),
      payment_due_days: Number(form.payment_due_days),
      lines: lines.value.map(l => ({ description: l.description, note: l.note, unit_rate: l.unit_rate, qty: l.qty, package_id: l.package_id ?? null, equipment_class_id: l.equipment_class_id ?? null, service_rate_id: l.service_rate_id ?? null }))
    })
    open.value = false
    for (const w of res.meta?.warnings ?? []) {
      notify(w)
    }
    await navigateTo(`/bookings/${res.data.id}`)
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    title="New booking"
    subtitle="Starts as a quote draft with a draft event. The event is confirmed once the contract is signed and, if one is required, the deposit is paid."
  >
    <UiFormSection title="Packages &amp; rates">
      <USelectMenu
        :model-value="null"
        :items="rateItems"
        value-key="value"
        :filter-fields="['label', 'description']"
        :search-input="{ placeholder: 'Search packages, equipment, services…', icon: 'i-lucide-search' }"
        icon="i-lucide-plus"
        placeholder="Add package, equipment or service"
        size="lg"
        class="w-full"
        :content="{ align: 'start' }"
        :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
        aria-label="Add from rate card"
        @update:model-value="addLine"
      >
        <template #empty>
          Nothing matches. Add packages and rates under Packages &amp; rates.
        </template>
      </USelectMenu>
      <ul
        v-if="lines.length"
        class="m-0 flex list-none flex-col rounded-md border border-[#DADDE3] bg-white p-0"
        role="tree"
        aria-label="Quote lines"
      >
        <li
          v-for="l in lines"
          :key="lineKey(l)"
          class="border-b border-[#EEF0F2] px-3 py-2 last:border-0"
          role="treeitem"
          :aria-expanded="packageItems(l).length ? isLineOpen(l) : undefined"
        >
          <div class="flex items-center gap-2">
            <component
              :is="packageItems(l).length ? 'button' : 'div'"
              :type="packageItems(l).length ? 'button' : undefined"
              class="flex min-w-0 flex-1 items-start gap-2 border-0 bg-transparent p-0 text-left text-sm"
              :class="packageItems(l).length ? 'cursor-pointer' : ''"
              @click="packageItems(l).length && toggleLine(l)"
            >
              <UIcon
                :name="rateItemIcon(l, rateCard)"
                class="mt-0.5 size-4 flex-none text-ink-500"
              />
              <span class="flex min-w-0 flex-col">
                <span class="flex flex-wrap items-center gap-x-2">
                  <b>{{ l.description }}</b>
                  <span
                    v-if="packageItems(l).length"
                    class="text-[13px] text-ink-500"
                  >{{ plural(itemTotal(packageItems(l)), 'item') }}</span>
                </span>
                <span class="text-[13px] text-ink-500">
                  {{ peso(l.unit_rate) }}<template v-if="!l.package_id && l.note"> · {{ l.note }}</template>
                </span>
                <span
                  v-if="packageItems(l).length"
                  class="flex min-w-0 items-center gap-0.5 text-[12px] text-ink-500"
                >
                  <UIcon
                    :name="isLineOpen(l) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                    class="size-3.5 flex-none"
                  />
                  <span class="truncate">{{ isLineOpen(l) ? 'Hide contents' : `Includes ${packageItems(l).map(i => `${i.count} ${i.name}`).join(', ')}` }}</span>
                </span>
              </span>
            </component>
            <div class="flex flex-none items-center gap-1">
              <button
                type="button"
                :aria-label="`Fewer ${l.description}`"
                class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
                @click="qty(l, -1)"
              >
                −
              </button>
              <span class="min-w-6 text-center font-semibold">{{ l.qty }}</span>
              <button
                type="button"
                :aria-label="`More ${l.description}`"
                class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
                @click="qty(l, 1)"
              >
                +
              </button>
            </div>
            <span class="w-20 flex-none text-right text-sm font-bold">{{ peso(Number(l.unit_rate) * l.qty) }}</span>
            <button
              type="button"
              :aria-label="`Remove ${l.description}`"
              class="inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
              @click="lines = lines.filter(x => x !== l)"
            >
              <UIcon
                name="i-lucide-x"
                class="size-4"
              />
            </button>
          </div>
          <ul
            v-if="packageItems(l).length && isLineOpen(l)"
            role="group"
            class="m-0 mt-1 ml-[7px] flex list-none flex-col border-l-2 border-dashed border-[#DADDE3] p-0 pl-4"
          >
            <li
              v-for="i in packageItems(l)"
              :key="`${i.type}:${i.equipment_class_id ?? i.case_kind_id ?? i.vehicle_type}`"
              role="treeitem"
              class="flex items-start justify-between gap-3 py-1 text-sm"
            >
              <span class="flex min-w-0 items-start gap-2">
                <UIcon
                  :name="rateItemIcon(i, rateCard)"
                  class="mt-0.5 size-4 flex-none text-ink-500"
                />
                <span class="flex min-w-0 flex-col">
                  <span>
                    {{ i.name }}
                    <span class="text-[13px] text-ink-500">×{{ i.count }}</span>
                  </span>
                  <span
                    v-if="i.type === 'case'"
                    class="text-[12px] text-ink-500"
                  >{{ caseContents(i.contents) ? `Each holds ${caseContents(i.contents)}` : 'Nothing packed yet' }}</span>
                </span>
              </span>
              <span
                v-if="l.qty > 1"
                class="flex-none text-[13px] font-semibold text-ink-600"
              >{{ i.count * l.qty }} total</span>
            </li>
          </ul>
        </li>
        <li
          role="none"
          class="flex items-center justify-between bg-[#F2F3F5] px-3 py-2 text-sm"
        >
          <span class="text-[#565B66]">Subtotal · discount, VAT and surcharges on the booking page</span>
          <b>{{ peso(subtotal) }}</b>
        </li>
      </ul>
      <p
        v-else
        class="m-0 text-[13px] text-[#565B66]"
      >
        Optional. You can also add lines after creating the booking.
      </p>
      <p
        v-if="errors.lines || Object.keys(errors).some(k => k.startsWith('lines.'))"
        role="alert"
        class="err m-0"
      >
        {{ errors.lines ?? Object.entries(errors).find(([k]) => k.startsWith('lines.'))?.[1] }}
      </p>
    </UiFormSection>

    <UiFormSection title="Booking details">
      <UiField
        label="Client *"
        :error="errors.client_id"
      >
        <select
          v-model="form.client_id"
          class="ctl"
          :class="{ 'ctl-error': errors.client_id }"
          @change="pickClient"
        >
          <option
            value=""
            disabled
          >
            Choose a client…
          </option>
          <option
            v-for="c in clients"
            :key="c.id"
            :value="c.id"
          >
            {{ c.name }}
          </option>
        </select>
      </UiField>
      <UiField
        label="Event name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
          :class="{ 'ctl-error': errors.name }"
          placeholder="e.g. Product launch"
        >
      </UiField>
      <UiField
        v-if="typeOptions.length"
        label="Event type"
        :error="errors.event_type_id"
      >
        <select
          v-model="form.event_type_id"
          class="ctl"
          :class="{ 'ctl-error': errors.event_type_id }"
        >
          <option
            v-for="t in typeOptions"
            :key="t.id"
            :value="t.id"
          >
            {{ t.label }}
          </option>
        </select>
      </UiField>
      <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <UiField
          label="Contact person"
          :error="errors.contact_name"
        >
          <input
            v-model="form.contact_name"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Contact mobile"
          :error="errors.contact_mobile"
        >
          <input
            v-model="form.contact_mobile"
            type="tel"
            inputmode="numeric"
            maxlength="13"
            placeholder="09XX XXX XXXX"
            class="ctl"
            :class="{ 'ctl-error': errors.contact_mobile }"
          >
        </UiField>
      </div>
      <p
        v-if="autofilled"
        class="help -mt-1.5 mb-0"
      >
        Filled in from the client's main contact. Change it for this event if needed.
      </p>
    </UiFormSection>

    <UiFormSection title="Schedule">
      <UiField
        label="Event dates *"
        :error="errors.start_date ?? errors.end_date"
      >
        <UiDateRangePicker
          v-model:start="form.start_date"
          v-model:end="form.end_date"
          :error="!!(errors.start_date || errors.end_date)"
        />
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Crew call time"
          :error="errors.call_time"
        >
          <input
            v-model="form.call_time"
            type="time"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Show time"
          :error="errors.show_time"
        >
          <input
            v-model="form.show_time"
            type="time"
            class="ctl"
          >
        </UiField>
      </div>
      <p class="help m-0">
        {{ days > 0 ? plural(days, 'day') : 'Pick the dates' }} · ingress and egress can be added as separate days on the event page.
      </p>
    </UiFormSection>

    <UiFormSection title="Location">
      <UiField
        label="Venue name"
        :error="errors.venue_name"
      >
        <input
          v-model="form.venue_name"
          type="text"
          class="ctl"
          placeholder="[Venue name]"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="City"
          :error="errors.venue_city"
        >
          <input
            v-model="form.venue_city"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Hall / room"
          :error="errors.hall_room"
        >
          <input
            v-model="form.hall_room"
            type="text"
            class="ctl"
            placeholder="Optional"
          >
        </UiField>
      </div>
      <UiField
        label="Address / loading-dock notes"
        :error="errors.loading_notes"
      >
        <textarea
          v-model="form.loading_notes"
          rows="2"
          class="ctl"
          placeholder="e.g. Loading via basement B2, gate pass needed"
        />
      </UiField>
    </UiFormSection>

    <UiFormSection title="Crew">
      <UiField
        label="Notes for crew"
        :error="errors.crew_notes"
      >
        <textarea
          v-model="form.crew_notes"
          rows="3"
          class="ctl"
          placeholder="Dress code, parking, power setup…"
        />
      </UiField>
    </UiFormSection>

    <UiFormSection title="Payment terms">
      <UiSegmented
        v-model="form.terms"
        name="payment-terms"
        :options="[{ value: 'deposit', label: 'Deposit locks the date' }, { value: 'after', label: 'Pay after the event' }]"
      />
      <div class="grid grid-cols-2 gap-3">
        <UiField
          v-if="form.terms === 'deposit'"
          label="Deposit (%)"
          :error="errors.deposit_pct"
        >
          <input
            v-model="form.deposit_pct"
            inputmode="decimal"
            class="ctl"
          >
        </UiField>
        <UiField
          :label="form.terms === 'deposit' ? 'Balance due' : 'Payment due'"
          :error="errors.payment_due_days"
        >
          <select
            v-model="form.payment_due_days"
            class="ctl"
          >
            <option
              v-for="d in PAYMENT_DUE_OPTIONS"
              :key="d"
              :value="String(d)"
            >
              {{ paymentDueLabel(d) }}
            </option>
          </select>
        </UiField>
      </div>
      <p class="help m-0">
        <template v-if="form.terms === 'deposit'">
          Booking is confirmed once the contract is signed and the deposit is paid. 50% unless agreed otherwise.
        </template>
        <template v-else>
          No deposit. Booking is confirmed once the contract is signed, and the full amount is due {{ paymentDueText(form.payment_due_days) }}. You'll get a reminder on the dashboard a week before it's due. Common for government and LGU accounts.
        </template>
      </p>
    </UiFormSection>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save"
      >
        Create booking
      </button>
    </template>
  </UiSlidePanel>
</template>
