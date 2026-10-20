<script setup lang="ts">
import type { Row } from '~/types/api'
import type { Tone } from '~/utils/badges'

definePageMeta({ module: 'cal', level: 'own', title: 'Calendar' })
useHead({ title: 'Calendar · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can, isCrew } = useAuthUser()

const month = ref(todayIso().slice(0, 7))
const today = ref(todayIso())
const entries = ref<Row[]>([])
const loading = ref(true)
const view = ref<'month' | 'timeline'>('month')
const open = ref(false)
const current = ref<Row | null>(null)
const expenses = ref<Row[]>([])
const meta = ref<Row | null>(null)
const exp = reactive({ type: 'transport', amount: '', label: '' })
const expError = ref('')
const newOpen = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api.get<{ data: Row[], meta: { month: string, today: string } }>('/calendar', { month: month.value })
    entries.value = res.data
    today.value = res.meta.today
  } finally {
    loading.value = false
  }
}
watch(month, load, { immediate: true })

const first = computed(() => new Date(month.value + '-01T00:00:00'))
const dim = computed(() => new Date(first.value.getFullYear(), first.value.getMonth() + 1, 0).getDate())
const monthLabel = computed(() => first.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
function shift(n: number) {
  const d = new Date(first.value.getFullYear(), first.value.getMonth() + n, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const iso = (day: number) => `${month.value}-${String(day).padStart(2, '0')}`
const cells = computed(() => {
  const lead = first.value.getDay()
  const out: (number | null)[] = Array.from({ length: lead }, () => null)
  for (let i = 1; i <= dim.value; i++) {
    out.push(i)
  }
  while (out.length % 7) {
    out.push(null)
  }
  return out
})
const on = (day: number) => entries.value.filter(e => e.start <= iso(day) && e.end >= iso(day))
const span = (e: Row) => {
  const s = Math.max(1, e.start.slice(0, 7) < month.value ? 1 : Number(e.start.slice(8)))
  const en = Math.min(dim.value, e.end.slice(0, 7) > month.value ? dim.value : Number(e.end.slice(8)))
  return { s, en }
}
const todayDay = computed(() => today.value.startsWith(month.value) ? Number(today.value.slice(8)) : null)

async function openEntry(e: Row) {
  current.value = e
  open.value = true
  expenses.value = []
  meta.value = null
  exp.type = 'transport'
  exp.amount = ''
  exp.label = ''
  expError.value = ''
  if (e.event_id && can('cal')) {
    const res = await api.get<{ data: Row[], meta: Row }>(`/events/${e.event_id}/expenses`)
    expenses.value = res.data
    meta.value = res.meta
  }
}

async function addExpense() {
  expError.value = ''
  const amount = Number(moneyInput(exp.amount))
  if (!(amount > 0)) {
    expError.value = 'Enter an amount.'
    return
  }
  try {
    await api.post(`/events/${current.value!.event_id}/expenses`, { type: exp.type, amount, label: exp.label || null })
    exp.amount = ''
    exp.label = ''
    await openEntry(current.value!)
    notify('Expense added.')
  } catch (e) {
    fail(e)
  }
}

async function removeExpense(x: Row) {
  try {
    await api.del(`/expenses/${x.id}`)
    await openEntry(current.value!)
  } catch (e) {
    fail(e)
  }
}

const TYPE: Record<string, { label: string, tone: Tone }> = {
  crew: { label: 'Crew', tone: TONES.blueTint },
  transport: { label: 'Transport', tone: TONES.amber },
  other: { label: 'Other', tone: TONES.grey }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Calendar"
      :subtitle="isCrew ? 'Your events by date.' : 'Every booking and event by date. Pick one to see its details and expenses.'"
    >
      <template
        v-if="can('book', 'edit')"
        #actions
      >
        <button
          type="button"
          class="btn btn-primary"
          @click="newOpen = true"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />New booking
        </button>
      </template>
    </UiPageHeader>

    <section class="card flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] px-4 py-3.5">
        <div class="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            class="inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-[#B9BEC7] bg-white"
            @click="shift(-1)"
          >
            <UIcon
              name="i-lucide-chevron-left"
              class="size-5"
            />
          </button>
          <button
            type="button"
            aria-label="Next month"
            class="inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-[#B9BEC7] bg-white"
            @click="shift(1)"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-5"
            />
          </button>
          <h2 class="font-display m-0 min-w-[190px] text-[26px] font-extrabold uppercase">
            {{ monthLabel }}
          </h2>
        </div>
        <div class="w-[220px]">
          <UiSegmented
            v-model="view"
            name="view"
            size="sm"
            :options="[{ value: 'month', label: 'Month' }, { value: 'timeline', label: 'Timeline' }]"
          />
        </div>
      </div>

      <div
        v-if="view === 'month'"
        class="overflow-x-auto"
      >
        <div class="grid min-w-[760px] grid-cols-7">
          <div
            v-for="dn in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
            :key="dn"
            class="border-b border-[#EEF0F2] px-2 py-2 text-xs font-bold tracking-[.06em] text-[#565B66] uppercase"
          >
            {{ dn }}
          </div>
          <div
            v-for="(day, i) in cells"
            :key="i"
            class="flex min-h-[118px] flex-col gap-1 border-r border-b border-[#EEF0F2] p-1.5"
            :class="day ? '' : 'bg-[#FAFAFB]'"
          >
            <template v-if="day">
              <span
                class="inline-flex size-[26px] items-center justify-center rounded-full text-sm font-bold"
                :class="day === todayDay ? 'bg-[#ED1B24] text-white' : ''"
              >{{ day }}</span>
              <template v-if="loading">
                <span
                  v-if="(day * 7) % 5 < 2"
                  aria-hidden="true"
                  class="skel h-[26px] w-full"
                />
              </template>
              <button
                v-for="e in loading ? [] : on(day)"
                :key="e.key"
                type="button"
                class="cursor-pointer truncate rounded border px-1.5 py-1 text-left text-xs font-bold"
                :style="{ background: CAL_STYLE[e.status]!.bg, color: CAL_STYLE[e.status]!.fg, borderColor: CAL_STYLE[e.status]!.bd }"
                @click="openEntry(e)"
              >
                {{ e.name }}
              </button>
            </template>
          </div>
        </div>
      </div>

      <div
        v-else
        class="overflow-x-auto p-4"
      >
        <div class="flex min-w-[900px] flex-col gap-2">
          <div class="grid grid-cols-[220px_1fr]">
            <span />
            <div
              class="grid text-[11px] text-[#565B66]"
              :style="{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }"
            >
              <span
                v-for="n in dim"
                :key="n"
                class="text-center"
                :class="n === todayDay ? 'font-extrabold text-[#B4121A]' : ''"
              >{{ n }}</span>
            </div>
          </div>
          <template v-if="loading">
            <div
              v-for="n in 5"
              :key="n"
              aria-hidden="true"
              class="grid grid-cols-[220px_1fr] items-center"
            >
              <div class="flex flex-col gap-1.5 pr-2">
                <span class="skel h-3.5 w-36" />
                <span class="skel h-3 w-24" />
              </div>
              <div class="relative h-[34px] rounded bg-[#F2F3F5]">
                <span
                  class="skel absolute top-1 bottom-1 h-auto"
                  :style="{ left: `${(n * 17) % 60}%`, width: `${12 + (n * 7) % 20}%` }"
                />
              </div>
            </div>
          </template>
          <div
            v-for="e in loading ? [] : entries"
            :key="e.key"
            class="grid grid-cols-[220px_1fr] items-center"
          >
            <button
              type="button"
              class="cursor-pointer truncate border-0 bg-transparent p-0 pr-2 text-left"
              @click="openEntry(e)"
            >
              <b class="text-sm">{{ e.name }}</b><span class="block text-xs text-[#565B66]">{{ e.client }} · {{ e.code }}</span>
            </button>
            <div class="relative h-[34px] rounded bg-[#F2F3F5]">
              <span
                v-if="todayDay"
                class="absolute top-0 bottom-0 w-0.5 bg-[#ED1B24]"
                :style="{ left: ((todayDay - 0.5) / dim * 100) + '%' }"
              />
              <button
                type="button"
                class="absolute top-1 bottom-1 cursor-pointer truncate rounded border px-1.5 text-left text-xs font-bold"
                :style="{ left: ((span(e).s - 1) / dim * 100) + '%', width: ((span(e).en - span(e).s + 1) / dim * 100) + '%', background: CAL_STYLE[e.status]!.bg, color: CAL_STYLE[e.status]!.fg, borderColor: CAL_STYLE[e.status]!.bd }"
                @click="openEntry(e)"
              >
                {{ e.stage_label }}
              </button>
            </div>
          </div>
          <p
            v-if="!loading && !entries.length"
            class="m-0 py-6 text-center text-sm text-[#565B66]"
          >
            No bookings this month.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap gap-4 border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
        <span
          v-for="[k, l] in [['live', 'Ongoing'], ['conf', 'Confirmed'], ['quote', 'Quote / contract out'], ['done', 'Completed'], ['cancel', 'Cancelled']]"
          :key="k"
          class="flex items-center gap-1.5"
        ><span
          class="h-2.5 w-4 rounded-sm border"
          :style="{ background: CAL_STYLE[k]!.bg, borderColor: CAL_STYLE[k]!.bd }"
        />{{ l }}</span>
      </div>
    </section>

    <USlideover
      v-model:open="open"
      side="right"
      :title="current?.name ?? 'Booking'"
      :description="current?.client ?? ''"
    >
      <template #content>
        <div
          v-if="current"
          class="flex h-full flex-col overflow-y-auto bg-white font-sans text-[#0B0B0C]"
        >
          <header
            class="sticky top-0 z-[2] flex items-start justify-between gap-3 px-5 py-[18px] text-white"
            :style="{ background: CAL_STYLE[current.status]!.head }"
          >
            <div>
              <div class="text-[13px] font-semibold tracking-[.04em] uppercase opacity-90">
                {{ current.stage_label }} · {{ current.code }}
              </div>
              <h2 class="font-display m-0 text-[28px] leading-none font-extrabold uppercase">
                {{ current.name }}
              </h2>
              <div class="mt-1 text-sm opacity-90">
                {{ current.client }}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              class="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border border-white/35 bg-transparent text-white"
              @click="open = false"
            >
              <UIcon
                name="i-lucide-x"
                class="size-[18px]"
              />
            </button>
          </header>
          <div class="flex flex-col gap-4 p-5">
            <dl class="m-0 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[15px]">
              <dt class="text-[#565B66]">
                Dates
              </dt><dd class="m-0">
                {{ current.dates_label }}
              </dd>
              <dt class="text-[#565B66]">
                Venue
              </dt><dd class="m-0">
                {{ current.venue || '—' }}
              </dd>
              <dt class="text-[#565B66]">
                Load in / out
              </dt><dd class="m-0">
                {{ current.load }}
              </dd>
              <dt class="text-[#565B66]">
                Crew
              </dt><dd class="m-0">
                {{ current.crew }}
              </dd>
              <template v-if="current.value !== null">
                <dt class="text-[#565B66]">
                  Contract value
                </dt><dd class="m-0">
                  {{ current.value ? peso(current.value) + ' incl. VAT' : '—' }}
                </dd>
              </template>
            </dl>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-if="current.event_id && (can('events') || isCrew)"
                :to="isCrew ? '/crew' : `/events/${current.event_id}`"
                class="btn btn-secondary btn-sm"
              >Event detail</NuxtLink>
              <NuxtLink
                v-if="current.booking_id && can('book')"
                :to="`/bookings/${current.booking_id}`"
                class="btn btn-dark btn-sm"
              >Booking &amp; contract</NuxtLink>
            </div>

            <template v-if="meta">
              <h3 class="h-section m-0 text-lg">
                Event expenses
              </h3>
              <ul class="m-0 flex list-none flex-col p-0">
                <li
                  v-if="meta.crew_fee.amount > 0"
                  class="flex items-center gap-2.5 border-b border-[#EEF0F2] py-2.5"
                >
                  <UiBadge
                    :tone="TYPE.crew!.tone"
                    label="Crew"
                  />
                  <span class="flex-1 text-sm"><b>Crew fees</b><span class="block text-[13px] text-[#565B66]">{{ meta.crew_fee.note }}</span></span>
                  <span class="font-semibold">{{ peso(meta.crew_fee.amount) }}</span>
                </li>
                <li
                  v-for="x in expenses"
                  :key="x.id"
                  class="flex items-center gap-2.5 border-b border-[#EEF0F2] py-2.5"
                >
                  <UiBadge
                    :tone="TYPE[x.type]!.tone"
                    :label="TYPE[x.type]!.label"
                  />
                  <span class="flex-1 text-sm"><b>{{ x.label }}</b><span class="block text-[13px] text-[#565B66]">{{ x.note }}</span></span>
                  <span class="font-semibold">{{ peso(x.amount) }}</span>
                  <button
                    v-if="can('cal', 'edit')"
                    type="button"
                    aria-label="Remove expense"
                    class="inline-flex size-8 cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
                    @click="removeExpense(x)"
                  >
                    <UIcon
                      name="i-lucide-x"
                      class="size-4"
                    />
                  </button>
                </li>
                <li
                  v-if="!expenses.length && !meta.crew_fee.amount"
                  class="py-2.5 text-sm text-[#565B66]"
                >
                  No expenses yet.
                </li>
              </ul>
              <div class="flex flex-col gap-1.5 rounded-lg bg-[#0B0B0C] p-4 text-sm text-white">
                <div
                  v-for="[l, v] in [['Crew fees', meta.totals.crew], ['Transportation', meta.totals.transport], ['Other', meta.totals.other]]"
                  :key="l"
                  class="flex justify-between"
                >
                  <span class="text-[#C9CCD2]">{{ l }}</span><span>{{ peso(v) }}</span>
                </div>
                <div class="flex items-baseline justify-between border-t border-[#3B3F47] pt-2">
                  <b class="uppercase">Total expenses</b><span class="figure text-[26px]">{{ peso(meta.totals.total) }}</span>
                </div>
                <div
                  v-if="current.value !== null"
                  class="flex justify-between"
                >
                  <span class="text-[#C9CCD2]">Est. profit before tax</span><span :class="meta.profit < 0 ? 'text-[#FF8A8F]' : ''">{{ meta.profit === null ? '—' : peso(meta.profit) }}</span>
                </div>
              </div>
              <p class="m-0 text-[13px] text-[#565B66]">
                Crew fees come from the event's personnel pay and update with attendance.
              </p>
              <form
                v-if="can('cal', 'edit')"
                class="flex flex-col gap-3 rounded-lg bg-[#F2F3F5] p-3.5"
                @submit.prevent="addExpense"
              >
                <h4 class="m-0 text-sm font-bold">
                  Add an expense
                </h4>
                <div class="grid grid-cols-2 gap-3">
                  <UiField label="Type">
                    <select
                      v-model="exp.type"
                      class="ctl"
                    >
                      <option value="transport">
                        Transportation
                      </option><option value="other">
                        Other
                      </option><option value="crew">
                        Crew fee (extra)
                      </option>
                    </select>
                  </UiField>
                  <UiField
                    label="Amount (₱) *"
                    :error="expError"
                  >
                    <input
                      v-model="exp.amount"
                      inputmode="decimal"
                      class="ctl"
                      :class="{ 'ctl-error': expError }"
                    >
                  </UiField>
                </div>
                <UiField label="What for">
                  <input
                    v-model="exp.label"
                    type="text"
                    class="ctl"
                    placeholder="e.g. Toll fees, gaffer tape, ice for crew"
                  >
                </UiField>
                <button
                  type="submit"
                  class="btn btn-primary self-start"
                >
                  Add expense
                </button>
                <span class="help">Receipts can be attached later. Logged with your name and the time.</span>
              </form>
            </template>
            <p
              v-else-if="!current.event_id && !isCrew"
              class="m-0 text-sm text-[#565B66]"
            >
              Expenses can be added once this booking has an event.
            </p>
          </div>
        </div>
      </template>
    </USlideover>
    <BookingsNewBookingPanel v-model:open="newOpen" />
  </div>
</template>
