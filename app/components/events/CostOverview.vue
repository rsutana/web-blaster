<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * The event's money at a glance: what the client pays (ex-VAT), every cost, and what's left.
 */
const props = defineProps<{ event: Row }>()

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const data = ref<Row | null>(null)
const open = ref<Record<string, boolean>>({})
const addOpen = ref(false)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ type: 'other', label: '', amount: '' })
const canAdd = computed(() => can('cal', 'edit') && props.event.status !== 'draft')

async function load() {
  try {
    data.value = (await api.get<{ data: Row }>(`/events/${props.event.id}/finance`)).data
  } catch (e) {
    fail(e)
  }
}
onMounted(load)
watch(() => props.event, load)

const rev = computed(() => data.value?.revenue ?? null)
const costLines = computed(() => (data.value?.lines ?? []) as Row[])
const biggest = computed(() => Math.max(1, ...costLines.value.map(l => Math.abs(l.amount))))
const profitTone = computed(() => (data.value?.profit ?? 0) >= 0 ? 'text-[#1D6B3C]' : 'text-[#B4121A]')
const COLOR: Record<string, string> = { crew_pay: '#2F5596', crew_extra: '#6E8CC4', transport: '#0B0B0C', rentals: '#C98A1B', other: '#9AA0AB', recovered: '#1D6B3C' }

function startAdd() {
  Object.assign(form, { type: 'other', label: '', amount: '' })
  errors.value = {}
  addOpen.value = true
}

async function addExpense() {
  busy.value = true
  errors.value = {}
  try {
    await api.post(`/events/${props.event.id}/expenses`, { ...form })
    addOpen.value = false
    notify('Expense added.')
    await load()
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}

async function removeExpense(item: Row) {
  try {
    await api.del(`/expenses/${item.id}`)
    notify(`${item.label} removed.`)
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <section
    aria-labelledby="cost-h"
    class="card flex flex-col"
  >
    <div class="card-head">
      <div class="flex flex-wrap items-center gap-2.5">
        <h2
          id="cost-h"
          class="h-section m-0"
        >
          Cost overview
        </h2>
        <UiBadge
          v-if="data"
          :tone="data.basis === 'actual' ? TONES.grey : TONES.amber"
          :label="data.basis_label"
        />
      </div>
      <button
        v-if="canAdd"
        type="button"
        class="btn btn-secondary btn-sm"
        aria-haspopup="dialog"
        @click="startAdd"
      >
        <UIcon
          name="i-lucide-plus"
          class="size-4"
        />Add expense
      </button>
    </div>

    <UiSkeletonTable
      v-if="!data"
      :rows="4"
      :cols="2"
    />
    <div
      v-else
      class="flex flex-col gap-5 p-5"
    >
      <div
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
      >
        <div
          v-if="rev"
          class="flex flex-col gap-1 rounded-lg bg-[#2F5596] p-4 text-white"
        >
          <span class="eyebrow text-[#DCE4F2]">Booking value · ex-VAT</span>
          <span class="figure text-[34px]">{{ peso(rev.net) }}</span>
          <span class="text-[13px] text-[#DCE4F2]">{{ peso(rev.total) }} incl. VAT · <NuxtLink
            :to="`/bookings/${rev.booking_id}`"
            class="font-semibold text-white"
          >{{ rev.booking_code }}</NuxtLink></span>
        </div>
        <div class="flex flex-col gap-1 rounded-lg bg-[#0B0B0C] p-4 text-white">
          <span class="eyebrow text-[#C9CCD2]">Total cost</span>
          <span class="figure text-[34px]">{{ peso(data.cost) }}</span>
          <span class="text-[13px] text-[#C9CCD2]">{{ data.cost_per_day !== null ? `${peso(data.cost_per_day)} a day` : '' }}</span>
        </div>
        <div
          v-if="rev"
          class="flex flex-col gap-1 rounded-lg border border-[#DADDE3] bg-white p-4"
        >
          <span class="eyebrow text-[#565B66]">{{ data.basis === 'actual' ? 'Profit' : 'Expected profit' }}</span>
          <span
            class="figure text-[34px]"
            :class="profitTone"
          >{{ peso(data.profit) }}</span>
          <span class="text-[13px] text-[#565B66]"><b :class="profitTone">{{ data.margin_pct }}% margin</b> · before overheads</span>
        </div>
        <div
          v-if="rev"
          class="flex flex-col gap-1.5 rounded-lg border border-[#DADDE3] bg-white p-4"
        >
          <span class="eyebrow text-[#565B66]">Collected</span>
          <span class="figure text-[34px]">{{ peso(rev.collected) }}</span>
          <div
            class="h-2 overflow-hidden rounded bg-[#ECEEF1]"
            role="img"
            :aria-label="`${rev.collected_pct}% of the booking collected`"
          >
            <div
              class="h-full bg-[#1D6B3C]"
              :style="{ width: Math.min(100, rev.collected_pct) + '%' }"
            />
          </div>
          <span class="text-[13px] text-[#565B66]">{{ rev.collected_pct }}% · {{ rev.outstanding > 0 ? `${peso(rev.outstanding)} still to collect` : 'Fully paid' }}</span>
        </div>
      </div>
      <p
        v-if="!rev"
        class="m-0 rounded-md bg-[#F2F3F5] px-3.5 py-2.5 text-sm text-[#565B66]"
      >
        {{ data.is_revenue_hidden ? 'Income and profit are only shown to roles that can see revenue.' : 'No booking is linked to this event, so there\'s no income to compare the cost against.' }}
      </p>

      <div class="flex flex-col">
        <div class="flex items-center justify-between border-b border-[#DADDE3] pb-2 text-xs font-bold tracking-[.06em] text-[#565B66] uppercase">
          <span>Where the money goes</span><span>Amount</span>
        </div>
        <div
          v-for="l in costLines"
          :key="l.key"
          class="border-b border-[#EEF0F2] py-3"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <button
                v-if="l.items.length"
                type="button"
                class="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[15px] font-semibold"
                :aria-expanded="!!open[l.key]"
                @click="open[l.key] = !open[l.key]"
              >
                <UIcon
                  :name="open[l.key] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="size-4"
                />{{ l.label }} <span class="font-normal text-[#565B66]">({{ l.items.length }})</span>
              </button>
              <span
                v-else
                class="text-[15px] font-semibold"
              >{{ l.label }}</span>
              <span class="text-[13px] text-[#565B66]">{{ l.note }}</span>
              <div
                class="h-1.5 max-w-[420px] overflow-hidden rounded bg-[#F2F3F5]"
                aria-hidden="true"
              >
                <div
                  class="h-full rounded"
                  :style="{ width: (Math.abs(l.amount) / biggest * 100) + '%', background: COLOR[l.key] ?? '#9AA0AB' }"
                />
              </div>
            </div>
            <span
              class="font-display text-xl font-bold whitespace-nowrap"
              :class="l.amount < 0 ? 'text-[#1D6B3C]' : ''"
            >{{ l.amount < 0 ? '−' : '' }}{{ peso(Math.abs(l.amount)) }}</span>
          </div>
          <ul
            v-if="open[l.key] && l.items.length"
            class="mt-2 mb-0 ml-5 flex list-none flex-col gap-1 p-0"
          >
            <li
              v-for="i in l.items"
              :key="`${i.kind}-${i.id}`"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <span>
                <NuxtLink
                  v-if="i.kind === 'trip'"
                  :to="`/trips/${i.id}`"
                >{{ i.label }}</NuxtLink>
                <template v-else>{{ i.label }}</template>
                <span
                  v-if="i.by"
                  class="text-[13px] text-[#565B66]"
                > · {{ i.by }}</span>
              </span>
              <span class="flex items-center gap-2">
                <span :class="i.amount === null ? 'text-[13px] font-semibold text-[#6B4100]' : ''">{{ i.amount === null ? 'No cost set' : peso(Math.abs(i.amount)) }}</span>
                <button
                  v-if="i.kind === 'expense' && canAdd"
                  type="button"
                  class="inline-flex size-8 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#565B66] hover:text-[#B4121A]"
                  :aria-label="`Remove ${i.label}`"
                  @click="removeExpense(i)"
                >
                  <UIcon
                    name="i-lucide-trash-2"
                    class="size-4"
                  />
                </button>
              </span>
            </li>
          </ul>
        </div>
        <div class="flex items-center justify-between border-t-2 border-[#0B0B0C] pt-3">
          <span class="text-[15px] font-bold uppercase">Total cost</span>
          <span class="figure text-[28px]">{{ peso(data.cost) }}</span>
        </div>
        <div
          v-if="rev"
          class="flex items-center justify-between pt-1.5 text-sm"
        >
          <span class="text-[#565B66]">Booking value ex-VAT {{ peso(rev.net) }} − cost</span>
          <b :class="profitTone">{{ peso(data.profit) }}</b>
        </div>
      </div>
    </div>

    <UiDialog
      v-model:open="addOpen"
      title="Add expense"
      :subtitle="event.label"
      icon="i-lucide-receipt"
    >
      <UiField label="Type">
        <select
          v-model="form.type"
          class="ctl"
        >
          <option value="crew">
            Crew (meals, per diem)
          </option>
          <option value="transport">
            Transport (fuel, tolls, truck)
          </option>
          <option value="other">
            Other
          </option>
        </select>
      </UiField>
      <UiField
        label="What for"
        optional
        :error="errors.label"
      >
        <input
          v-model="form.label"
          type="text"
          class="ctl"
          placeholder="e.g. Diesel, NLEX toll"
        >
      </UiField>
      <UiField
        label="Amount (₱) *"
        :error="errors.amount"
      >
        <input
          v-model="form.amount"
          inputmode="decimal"
          class="ctl"
          placeholder="2,500"
        >
      </UiField>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="addOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy || !form.amount"
          @click="addExpense"
        >
          Add expense
        </button>
      </template>
    </UiDialog>
  </section>
</template>
