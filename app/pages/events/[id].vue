<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'events', title: 'Event detail' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can, canSeeRates } = useAuthUser()

const ev = ref<Row | null>(null)
const eqFilter = ref<'all' | 'deployed' | 'returned' | 'removed'>('all')
const editOpen = ref(false)
const addEqOpen = ref(false)
const personOpen = ref(false)
const editingAssignment = ref<Row | null>(null)
const attendanceOpen = ref(false)
const attendanceFor = ref<Row | null>(null)
const removeOpen = ref(false)
const removing = ref<Row | null>(null)
const hiddenBlocks = ref<number[]>([])
const closing = ref(false)

async function load() {
  ev.value = (await api.get<{ data: Row }>(`/events/${route.params.id}`)).data
  useHead({ title: `${ev.value.label} · Blaster Pro Audio` })
}
onMounted(load)

const statusTone = computed(() => ({ ongoing: '#C4141C', upcoming: '#2F5596', draft: '#3B3F47', completed: '#3B3F47', cancelled: '#0B0B0C' } as Record<string, string>)[ev.value?.display_status] ?? '#3B3F47')
const statusLabel = computed(() => {
  const e = ev.value!
  if (e.display_status === 'ongoing' && e.day_index) {
    return `Ongoing · Day ${e.day_index} of ${e.day_count}`
  }
  return EVENT_STATUS[e.display_status]?.label ?? e.display_status
})
const usages = computed(() => (ev.value?.usages ?? []).filter((u: Row) => eqFilter.value === 'all' || (eqFilter.value === 'removed' ? ['removed', 'swap'].includes(u.badge_key) : u.badge_key === eqFilter.value)))
const blocks = computed(() => (ev.value?.blocked_scans ?? []).filter((b: Row) => !hiddenBlocks.value.includes(b.id)))
const isCancelled = computed(() => ev.value?.status === 'cancelled')
const canTrack = computed(() => can('track', 'edit') && !ev.value?.status.match(/cancelled/))
const flatPeople = computed(() => (ev.value?.assignments ?? []).filter((a: Row) => a.rate_type === 'flat').map((a: Row) => a.name))
const total = computed(() => ev.value?.summary?.compensation?.total ?? 0)

async function closeEvent() {
  closing.value = true
  try {
    const res = await api.post<{ data: Row }>(`/events/${ev.value!.id}/closure`)
    ev.value = res.data
    const out = res.data.summary.equipment.deployed
    notify(out > 0 ? `${ev.value!.name} closed · ${plural(out, 'item')} still out. Check them in from Equipment or scan.` : `${ev.value!.name} closed · all equipment is back.`)
  } catch (e) {
    fail(e)
  } finally {
    closing.value = false
  }
}

async function undoCancel() {
  try {
    ev.value = (await api.del<{ data: Row }>(`/events/${ev.value!.id}/cancellation`)).data
  } catch (e) {
    fail(e)
  }
}

async function onCancelled(e: Row) {
  ev.value = e
  await load()
}

async function dismissBlock(b: Row) {
  hiddenBlocks.value.push(b.id)
  await api.patch(`/scan-blocks/${b.id}`, { action: 'dismiss' }).catch(() => {})
}

function openPerson(a: Row | null) {
  editingAssignment.value = a
  personOpen.value = true
}

async function removePerson(a: Row) {
  try {
    await api.del(`/assignments/${a.id}`)
    notify(`${a.name} was taken off this event.`)
    await load()
  } catch (e) {
    fail(e)
  }
}

function openAttendance(a: Row) {
  attendanceFor.value = a
  attendanceOpen.value = true
}

function openRemove(u: Row) {
  removing.value = u
  removeOpen.value = true
}

async function onRemoved(u: Row) {
  await load()
  notify(`${u.code}: ${u.badge}.${u.status_note.includes('spare') ? ' ' + u.status_note.split('· ')[1]?.replace(/^spare (\S+) added/, 'Spare $1 added to this event.') : ''}`, async () => {
    try {
      await api.del(`/usages/${u.id}/removal`)
      await load()
    } catch (e) {
      fail(e)
    }
  })
}

async function onAttendanceSaved(meta: Row, name: string) {
  await load()
  notify(`Saved ${name}'s days (${meta.changed} changed). Event pay ${peso(meta.from)} → ${peso(meta.to)}. Payroll updates automatically.`)
}

async function onEquipmentAdded(count: number) {
  await load()
  notify(`${plural(count, 'item')} added to ${ev.value!.name}.`)
}

async function onPersonSaved(name: string, isNew: boolean, pin?: string | null) {
  await load()
  notify(isNew ? `${name} added to ${ev.value!.name}.${pin ? ' Temporary PIN ' + pin + '.' : ''}` : `Saved ${name}'s pay on this event.`)
}

function actor(desc: string, who?: string | null) {
  if (who && desc.startsWith(who)) {
    return { who, what: desc.slice(who.length) }
  }
  return { who: '', what: desc }
}

const dotFor = (kind: string) => ({ return: '#1D6B3C', alert: '#ED1B24', add: '#2F5596', change: '#9AA0AB' } as Record<string, string>)[kind] ?? '#9AA0AB'
</script>

<template>
  <div class="contents">
    <UiSpinner v-if="!ev" />
    <template v-else>
      <nav
        aria-label="Breadcrumb"
        class="text-sm"
      >
        <NuxtLink to="/events">Events</NuxtLink> <span class="text-[#9AA0AB]">/</span> <span class="text-[#565B66]">Event {{ ev.code }}</span>
      </nav>

      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="h-page m-0">
              {{ ev.name }}
            </h1>
            <span
              class="inline-flex items-center gap-2 rounded px-3 py-1.5 text-[13px] font-bold tracking-[.06em] text-white uppercase"
              :style="{ background: statusTone }"
            >
              <span
                aria-hidden="true"
                class="size-2 rounded-full bg-white"
              />{{ statusLabel }}
            </span>
          </div>
          <p class="m-0 text-[15px] text-[#565B66]">
            Event {{ ev.code }} · Client <NuxtLink
              to="/clients"
              class="font-bold text-[#0B0B0C]"
            >{{ ev.client?.name }}</NuxtLink><template v-if="ev.booking_code">
              · <NuxtLink
                :to="`/bookings/${ev.booking_id}`"
                class="font-semibold"
              >{{ ev.booking_code }}</NuxtLink>
            </template> · Created by {{ ev.created_by ?? 'Admin' }}, {{ ev.created_label }}
          </p>
        </div>
        <div
          v-if="!isCancelled && can('events', 'edit')"
          class="flex flex-wrap gap-2.5"
        >
          <button
            type="button"
            class="btn btn-strong"
            aria-haspopup="dialog"
            @click="editOpen = true"
          >
            Edit event
          </button>
          <button
            v-if="ev.status !== 'completed'"
            type="button"
            class="btn btn-primary"
            :disabled="closing"
            @click="closeEvent"
          >
            Close event &amp; check returns
          </button>
        </div>
      </header>

      <div
        v-if="isCancelled"
        role="status"
        class="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#0B0B0C] px-4 py-3.5 text-white"
      >
        <span class="flex-[1_1_320px] text-[15px]"><b>This event was cancelled</b> · {{ ev.cancel_reason_label }} · by {{ ev.cancelled_by ?? 'Admin' }}. <span class="text-[#C9CCD2]">Equipment went back to Available and the crew's remaining days were removed. Days already worked stay in payroll.</span></span>
        <button
          v-if="can('events', 'edit')"
          type="button"
          class="btn bg-white font-bold text-[#0B0B0C]"
          @click="undoCancel"
        >
          Undo
        </button>
      </div>

      <div
        v-for="b in (isCancelled ? [] : blocks)"
        :key="b.id"
        role="alert"
        class="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#0B0B0C] px-4 py-3.5 text-white"
      >
        <span
          aria-hidden="true"
          class="inline-flex size-9 flex-none items-center justify-center rounded-md bg-[#ED1B24]"
        ><UIcon
          name="i-lucide-zap"
          class="size-[18px]"
        /></span>
        <div class="flex-[1_1_320px] text-[15px]">
          <b>1 scan blocked {{ b.when?.startsWith('today') || b.when === 'just now' ? 'today' : '' }}.</b> <span class="text-[#C9CCD2]"><span class="font-mono text-white">{{ b.code }}</span> is still Deployed on {{ b.blocking_event ?? 'another event' }} and was never returned. {{ b.by }} tried to add it at {{ b.at }}.</span>
        </div>
        <div class="flex gap-2">
          <NuxtLink
            :to="`/scan/blocked/${b.id}`"
            class="btn btn-sm bg-white font-bold text-[#0B0B0C] hover:text-[#0B0B0C]"
          >Review · transfer</NuxtLink>
          <button
            type="button"
            aria-label="Dismiss"
            class="inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-[#3B3F47] bg-transparent text-white"
            @click="dismissBlock(b)"
          >
            <UIcon
              name="i-lucide-x"
              class="size-4"
            />
          </button>
        </div>
      </div>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr))"
      >
        <section
          aria-labelledby="sched-h"
          class="card flex flex-col gap-3.5 p-5"
        >
          <h2
            id="sched-h"
            class="h-section m-0"
          >
            Schedule &amp; location
          </h2>
          <dl
            class="m-0 grid gap-x-4 gap-y-2.5 text-[15px]"
            style="grid-template-columns: minmax(130px, auto) 1fr"
          >
            <dt class="text-[#565B66]">
              Dates
            </dt><dd class="m-0">
              {{ ev.dates_label }} · {{ plural(ev.day_count, 'day') }}
            </dd>
            <dt class="text-[#565B66]">
              Call time
            </dt><dd class="m-0">
              {{ [ev.call_label ? ev.call_label + ' ingress' : null, ev.egress_label ? ev.egress_label + ' egress' : null].filter(Boolean).join(' · ') || '[Call time]' }}
            </dd>
            <dt class="text-[#565B66]">
              Venue
            </dt><dd class="m-0">
              {{ [ev.venue_name, ev.hall_room].filter(Boolean).join(', ') }}
            </dd>
            <dt class="text-[#565B66]">
              Address
            </dt><dd class="m-0">
              {{ [ev.street_address, ev.city].filter(Boolean).join(', ') || '—' }}
            </dd>
            <dt class="text-[#565B66]">
              Event lead
            </dt><dd class="m-0">
              <template v-if="ev.lead">
                {{ ev.lead.name }} · <a :href="`tel:${ev.lead.mobile}`">{{ phone(ev.lead.mobile) }}</a>
              </template><template v-else>
                Not set
              </template>
            </dd>
            <dt class="text-[#565B66]">
              Client contact
            </dt><dd class="m-0">
              {{ ev.contact_name ?? '—' }}<template v-if="ev.contact_mobile">
                · <a :href="`tel:${ev.contact_mobile}`">{{ phone(ev.contact_mobile) }}</a>
              </template>
            </dd>
            <dt class="text-[#565B66]">
              Loading notes
            </dt><dd class="m-0">
              {{ ev.loading_notes ?? '—' }}
            </dd>
          </dl>
          <div
            role="img"
            :aria-label="`Map pin placeholder · ${ev.venue_name}`"
            class="flex h-[120px] items-center justify-center rounded-md border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-sm text-[#565B66]"
          >
            Map · {{ ev.venue_name }}
          </div>
        </section>

        <section
          aria-label="Event summary"
          class="flex flex-col gap-3"
        >
          <div class="grid grid-cols-2 gap-3">
            <div class="card flex flex-col gap-1 p-4">
              <span class="eyebrow text-[#565B66]">Equipment</span>
              <span class="figure text-[40px]">{{ ev.summary.equipment.total }}</span>
              <span class="text-sm text-[#565B66]">{{ ev.summary.equipment.deployed }} deployed · {{ ev.summary.equipment.returned }} returned · {{ ev.summary.equipment.removed }} removed</span>
            </div>
            <div class="card flex flex-col gap-1 p-4">
              <span class="eyebrow text-[#565B66]">Personnel</span>
              <span class="figure text-[40px]">{{ ev.summary.crew.count }}</span>
              <span class="text-sm text-[#565B66]">{{ ev.summary.crew.note || (ev.summary.crew.count ? 'Assigned' : 'Nobody yet') }}</span>
            </div>
          </div>
          <div
            v-if="canSeeRates && ev.summary.compensation"
            class="flex flex-col gap-2.5 rounded-lg bg-[#2F5596] p-[18px] text-white"
          >
            <div class="flex flex-col gap-1.5 text-[15px]">
              <div class="flex justify-between">
                <span class="text-[#DCE4F2]">Base pay (day / hour / flat)</span><span>{{ peso(ev.summary.compensation.base) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[#DCE4F2]">Overtime · {{ num(ev.summary.compensation.ot_hours) }} hrs</span><span>+ {{ peso(ev.summary.compensation.ot_amount) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[#DCE4F2]">Allowances</span><span>+ {{ peso(ev.summary.compensation.allowances) }}</span>
              </div>
            </div>
            <div class="flex items-baseline justify-between border-t border-[#5A7AB2] pt-2.5">
              <span class="eyebrow font-bold">Total compensation</span>
              <span class="figure text-[40px]">{{ peso(total) }}</span>
            </div>
            <span class="text-[13px] text-[#DCE4F2]">{{ ev.display_status === 'upcoming' || ev.display_status === 'draft' ? 'Estimate from scheduled days.' : 'Gross labor cost.' }} Advances and deductions come off in the <NuxtLink
              to="/payroll"
              class="font-semibold text-white"
            >payroll run</NuxtLink>.</span>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="eq-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="eq-h"
            class="h-section m-0"
          >
            Equipment <span class="text-[#565B66]">({{ ev.usages.length }})</span>
          </h2>
          <div class="flex flex-wrap gap-2">
            <div
              role="group"
              aria-label="Filter equipment"
              class="flex gap-1 rounded-md bg-[#F2F3F5] p-1"
            >
              <button
                v-for="[k, l] in [['all', 'All'], ['deployed', 'Deployed'], ['returned', 'Returned'], ['removed', 'Removed']]"
                :key="k"
                type="button"
                :aria-pressed="eqFilter === k"
                class="min-h-9 cursor-pointer rounded border-0 px-3 text-sm font-semibold"
                :class="eqFilter === k ? 'bg-[#0B0B0C] text-white' : 'bg-transparent text-[#0B0B0C]'"
                @click="eqFilter = k as typeof eqFilter"
              >
                {{ l }}
              </button>
            </div>
            <template v-if="canTrack && ev.status !== 'draft' && ev.status !== 'completed'">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                aria-haspopup="dialog"
                @click="addEqOpen = true"
              >
                Add manually
              </button>
              <NuxtLink
                :to="`/scan?event=${ev.id}`"
                class="btn btn-primary btn-sm"
              >
                <UIcon
                  name="i-lucide-qr-code"
                  class="size-4"
                />Scan QR to add
              </NuxtLink>
            </template>
          </div>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 900px"
          >
            <thead>
              <tr>
                <th>QR / ID</th><th>Item</th><th>Condition at add</th><th>Added by</th><th>Added on</th><th>Status</th><th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in usages"
                :key="u.id"
              >
                <td data-cell="title">
                  <NuxtLink
                    :to="`/equipment/${u.code}`"
                    class="font-mono text-[15px] font-medium"
                  >{{ u.code }}</NuxtLink>
                </td>
                <td data-label="Item">
                  <span class="font-semibold">{{ u.name }}</span><div class="sub text-[13px]">
                    {{ u.category_label }}
                  </div>
                </td>
                <td data-label="Condition">
                  {{ u.condition_label }}
                </td>
                <td data-label="Added by">
                  {{ u.added_by }}<span
                    v-if="u.is_crew_adder"
                    class="text-[#565B66]"
                  > · crew</span>
                </td>
                <td
                  data-label="Added on"
                  class="whitespace-nowrap"
                >
                  {{ u.added_at }}
                </td>
                <td data-label="Status">
                  <UiBadge
                    :tone="USAGE_BADGE[u.badge_key]!"
                    :label="u.badge"
                  />
                  <div
                    v-if="u.status_note"
                    class="mt-1 text-[13px] text-[#565B66]"
                  >
                    {{ u.status_note }}
                  </div>
                </td>
                <td
                  data-cell="actions"
                  class="text-right"
                >
                  <div class="inline-flex gap-1.5">
                    <button
                      v-if="u.status === 'deployed' && canTrack"
                      type="button"
                      class="btn btn-red-text btn-sm"
                      aria-haspopup="dialog"
                      @click="openRemove(u)"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-if="usages.length === 0"
          :text="ev.usages.length ? 'No items with this status.' : 'No equipment on this event yet. Scan the QR stickers or add items by hand.'"
        />
        <div class="border-t border-[#DADDE3] px-5 py-3 text-[13px] text-[#565B66]">
          Removed items stay listed with their reason and keep their history.
        </div>
      </section>

      <section
        aria-labelledby="pay-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <div>
            <h2
              id="pay-h"
              class="h-section m-0"
            >
              Personnel{{ canSeeRates ? ' & event pay' : '' }} <span class="text-[#565B66]">({{ ev.assignments.length }})</span>
            </h2>
            <p
              v-if="canSeeRates"
              class="mt-0.5 mb-0 text-sm text-[#565B66]"
            >
              Rates and overtime apply to this event only.
            </p>
          </div>
          <button
            v-if="can('events', 'edit') && !isCancelled"
            type="button"
            class="btn btn-primary btn-sm"
            aria-haspopup="dialog"
            @click="openPerson(null)"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />Add personnel
          </button>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 900px"
          >
            <thead>
              <tr>
                <th>Person</th>
                <template v-if="canSeeRates">
                  <th>Rate (this event)</th><th>Worked</th><th class="text-right">
                    Base
                  </th><th class="text-right">
                    Overtime
                  </th><th class="text-right">
                    Allowance
                  </th><th class="text-right">
                    Event pay
                  </th>
                </template>
                <th v-else>
                  Worked
                </th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in ev.assignments"
                :key="a.id"
              >
                <td data-cell="title">
                  <div class="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      class="font-display inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-[#0B0B0C] text-sm font-bold text-white"
                    >{{ a.initials }}</span>
                    <div>
                      <NuxtLink
                        :to="`/personnel/${a.personnel_id}`"
                        class="font-bold text-[#0B0B0C]"
                      >{{ a.name }}</NuxtLink>
                      <div class="text-[13px] text-[#565B66]">
                        {{ a.role }}{{ a.is_cover ? ' · cover' : '' }}
                      </div>
                    </div>
                  </div>
                </td>
                <template v-if="canSeeRates">
                  <td data-label="Rate">
                    {{ a.rate_label }}<div class="sub">
                      {{ a.ot_label === 'No OT' ? 'No OT' : 'OT ' + a.ot_label }}
                    </div>
                  </td>
                  <td data-label="Worked">
                    {{ a.worked_label }}
                  </td>
                  <td
                    data-label="Base"
                    class="text-right"
                  >
                    {{ peso(a.pay.base) }}
                  </td>
                  <td
                    data-label="Overtime"
                    class="text-right"
                  >
                    <template v-if="a.pay.ot_amount > 0">
                      + {{ peso(a.pay.ot_amount) }}<div class="sub">
                        {{ num(a.pay.ot_hours) }} hrs
                      </div>
                    </template><template v-else>
                      —
                    </template>
                  </td>
                  <td
                    data-label="Allowance"
                    class="text-right"
                  >
                    <template v-if="a.pay.allowance > 0">
                      + {{ peso(a.pay.allowance) }}<div class="sub">
                        {{ a.allowance_label ?? 'allowance' }}
                      </div>
                    </template><template v-else>
                      —
                    </template>
                  </td>
                  <td
                    data-label="Event pay"
                    class="text-right"
                  >
                    <span class="font-display text-xl font-bold">{{ peso(a.pay.total) }}</span>
                  </td>
                </template>
                <td
                  v-else
                  data-label="Worked"
                >
                  {{ a.worked_label }}
                </td>
                <td
                  data-cell="actions"
                  class="text-right whitespace-nowrap"
                >
                  <div
                    v-if="can('events', 'edit') && !isCancelled"
                    class="inline-flex gap-1.5"
                  >
                    <button
                      v-if="canSeeRates"
                      type="button"
                      class="btn btn-secondary btn-sm"
                      @click="openPerson(a)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-red-text btn-sm"
                      @click="removePerson(a)"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="canSeeRates && ev.assignments.length">
              <tr class="border-t-2 border-[#0B0B0C]">
                <th
                  colspan="6"
                  class="px-4 py-3.5 text-left"
                  data-label=""
                >
                  <span class="eyebrow font-bold">Event total compensation</span>
                </th>
                <td
                  class="text-right"
                  data-label="Total"
                >
                  <span class="font-display text-2xl font-extrabold text-[#2F5596]">{{ peso(total) }}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <UiEmpty
          v-if="ev.assignments.length === 0"
          text="Nobody is assigned yet. Add personnel with their rate for this event."
        />
      </section>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr))"
      >
        <section
          aria-labelledby="att-h"
          class="card flex flex-col"
        >
          <div class="border-b border-[#DADDE3] px-5 py-4">
            <h2
              id="att-h"
              class="h-section m-0"
            >
              Attendance &amp; hours
            </h2>
            <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
              Feeds days, hours and OT. Mark absent, half day or add a day any time before payroll is finalized.
            </p>
          </div>
          <div class="tbl-wrap">
            <table
              class="tbl"
              style="min-width: 520px"
            >
              <thead>
                <tr>
                  <th>Person</th>
                  <th
                    v-for="d in ev.dates"
                    :key="d"
                    class="px-2"
                  >
                    {{ shortDate(d) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="a in ev.assignments"
                  :key="a.id"
                >
                  <th
                    scope="row"
                    data-cell="title"
                    class="px-5 py-2.5 text-left font-semibold"
                  >
                    {{ a.name }}
                    <button
                      v-if="a.rate_type !== 'flat' && can('time', 'edit') && !isCancelled"
                      type="button"
                      class="btn btn-secondary btn-xs mt-1 flex"
                      aria-haspopup="dialog"
                      @click="openAttendance(a)"
                    >
                      Edit days
                    </button>
                  </th>
                  <td
                    v-for="d in ev.dates"
                    :key="d"
                    :data-label="shortDate(d)"
                    class="p-2"
                  >
                    <template
                      v-for="day in a.days.filter((x: Row) => x.work_date === d)"
                      :key="day.id"
                    >
                      <span
                        class="inline-block rounded px-2 py-1 text-[13px] font-semibold whitespace-nowrap"
                        :class="day.has_ot ? 'bg-[#E6ECF6] text-[#244677]' : day.status === 'absent' ? 'bg-[#FDE7E8] text-[#8F0F15]' : 'bg-[#F2F3F5] text-[#3B3F47]'"
                      >{{ day.chip }}</span>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="flatPeople.length"
            class="border-t border-[#DADDE3] px-5 py-3 text-[13px] text-[#565B66]"
          >
            {{ flatPeople.join(', ') }} {{ flatPeople.length === 1 ? 'is' : 'are' }} on a flat rate: attendance is logged, not counted for pay.
          </div>
        </section>

        <section
          aria-labelledby="log-h"
          class="card flex flex-col"
        >
          <div class="border-b border-[#DADDE3] px-5 py-4">
            <h2
              id="log-h"
              class="h-section m-0"
            >
              Activity log
            </h2>
          </div>
          <ol class="m-0 flex list-none flex-col px-5 pt-2 pb-4">
            <li
              v-for="l in ev.activity"
              :key="l.id"
              class="flex gap-3 border-b border-[#E6E8EC] py-2.5"
            >
              <span
                aria-hidden="true"
                class="mt-1.5 size-2.5 flex-none rounded-sm"
                :style="{ background: dotFor(l.kind) }"
              />
              <div class="text-sm">
                <b>{{ actor(l.description, l.actor).who }}</b>{{ actor(l.description, l.actor).what }}
                <div class="mt-0.5 text-[13px] text-[#565B66]">
                  {{ l.when }}{{ l.source_label ? ' · ' + l.source_label : '' }}
                </div>
              </div>
            </li>
            <li
              v-if="!ev.activity.length"
              class="py-4 text-sm text-[#565B66]"
            >
              Nothing logged yet.
            </li>
          </ol>
        </section>
      </div>

      <EventsEventPanel
        v-model:open="editOpen"
        :event="ev"
        @saved="load"
        @cancelled="onCancelled"
      />
      <EventsAddEquipmentPanel
        v-model:open="addEqOpen"
        :event="ev"
        @added="onEquipmentAdded"
      />
      <EventsPersonnelPanel
        v-model:open="personOpen"
        :event="ev"
        :assignment="editingAssignment"
        @saved="onPersonSaved"
      />
      <EventsAttendancePanel
        v-if="attendanceFor"
        v-model:open="attendanceOpen"
        :event="ev"
        :assignment="attendanceFor"
        @saved="onAttendanceSaved"
      />
      <EventsRemoveEquipmentModal
        v-if="removing"
        v-model:open="removeOpen"
        :event="ev"
        :usage="removing"
        @removed="onRemoved"
      />
    </template>
  </div>
</template>
