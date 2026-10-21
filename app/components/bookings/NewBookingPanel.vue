<script setup lang="ts">
import type { Row } from '~/types/api'

const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const clients = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const rateCard = ref<Row | null>(null)
const lines = ref<Row[]>([])
const addSel = ref('')
const rateOptions = computed(() => rateCardOptions(rateCard.value))
const subtotal = computed(() => lines.value.reduce((sum, l) => sum + Number(l.unit_rate) * l.qty, 0))
const form = reactive({ client_id: '' as number | string, name: '', start_date: '', end_date: '', venue_name: '', venue_city: '', deposit_pct: '50' })

watch(open, async (v) => {
  if (v) {
    Object.assign(form, { client_id: '', name: '', start_date: '', end_date: '', venue_name: '', venue_city: '', deposit_pct: '50' })
    errors.value = {}
    lines.value = []
    addSel.value = ''
    const [clientRows, card] = await Promise.all([api.get<{ data: Row[] }>('/clients'), api.get<{ data: Row }>('/rate-card')])
    clients.value = clientRows.data.filter(c => c.status === 'active')
    rateCard.value = card.data
  }
})

function addLine() {
  const opt = rateOptions.value.find(o => o.v === addSel.value)
  if (opt) {
    addRateLine(lines.value, opt)
  }
  addSel.value = ''
}

function qty(l: Row, delta: number) {
  l.qty = Math.max(1, l.qty + delta)
}
watch(() => form.start_date, (d) => {
  if (d && (!form.end_date || form.end_date < d)) {
    form.end_date = d
  }
})

async function save() {
  busy.value = true
  errors.value = {}
  try {
    const res = await api.post<{ data: Row }>('/bookings', {
      ...form,
      deposit_pct: Number(form.deposit_pct) || 50,
      lines: lines.value.map(l => ({ description: l.description, note: l.note, unit_rate: l.unit_rate, qty: l.qty, package_id: l.package_id ?? null, equipment_class_id: l.equipment_class_id ?? null, service_rate_id: l.service_rate_id ?? null }))
    })
    open.value = false
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
    subtitle="Starts as a quote draft. Pick packages and rates now or later, then send the quote and the contract."
  >
    <UiField
      label="Client *"
      :error="errors.client_id"
    >
      <select
        v-model="form.client_id"
        class="ctl"
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
        placeholder="e.g. Product launch"
      >
    </UiField>
    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Start date *"
        :error="errors.start_date"
      >
        <input
          v-model="form.start_date"
          type="date"
          class="ctl"
        >
      </UiField>
      <UiField
        label="End date *"
        :error="errors.end_date"
      >
        <input
          v-model="form.end_date"
          type="date"
          class="ctl"
        >
      </UiField>
      <UiField label="Venue">
        <input
          v-model="form.venue_name"
          type="text"
          class="ctl"
          placeholder="[Venue name]"
        >
      </UiField>
      <UiField label="City">
        <input
          v-model="form.venue_city"
          type="text"
          class="ctl"
        >
      </UiField>
    </div>
    <UiField
      label="Deposit (%)"
      help="Locks the date. 50% unless agreed otherwise."
    >
      <input
        v-model="form.deposit_pct"
        inputmode="decimal"
        class="ctl"
        style="width: 120px"
      >
    </UiField>
    <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Packages &amp; rates
      </legend>
      <div class="flex gap-2">
        <select
          v-model="addSel"
          class="ctl min-w-0 flex-1"
          aria-label="Add from rate card"
        >
          <option value="">
            Add from rate card…
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
          class="btn btn-outline-blue flex-none"
          :disabled="!addSel"
          @click="addLine"
        >
          Add
        </button>
      </div>
      <ul
        v-if="lines.length"
        class="m-0 flex list-none flex-col rounded-md border border-[#DADDE3] p-0"
      >
        <li
          v-for="l in lines"
          :key="l.description + l.unit_rate"
          class="flex items-center gap-2 border-b border-[#EEF0F2] px-3 py-2 last:border-0"
        >
          <div class="min-w-0 flex-1 text-sm">
            <b>{{ l.description }}</b>
            <div class="text-[13px] text-[#565B66]">
              {{ peso(l.unit_rate) }}<template v-if="l.note">
                · {{ l.note }}
              </template>
            </div>
          </div>
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
          <span class="w-24 flex-none text-right text-sm font-bold">{{ peso(Number(l.unit_rate) * l.qty) }}</span>
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
        </li>
        <li class="flex items-center justify-between bg-[#F2F3F5] px-3 py-2 text-sm">
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
    </fieldset>
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
