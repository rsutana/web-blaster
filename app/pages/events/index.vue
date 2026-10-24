<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'events', title: 'Events' })
useHead({ title: 'Events · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can, canSeeRates } = useAuthUser()

const events = ref<Row[]>([])
const kpis = ref<Row>({})
const loading = ref(true)
const tab = ref('current')
const query = ref('')
const month = ref('all')
const panelOpen = ref(false)
const editing = ref<Row | null>(null)
const editOpen = ref(false)
const cancelling = ref<Row | null>(null)
const cancelOpen = ref(false)
const typesOpen = ref(false)

async function load() {
  const res = await api.get<{ data: Row[], meta: { kpis: Row } }>('/events')
  events.value = res.data
  kpis.value = res.meta.kpis
  loading.value = false
}
onMounted(load)

const TABS = [
  { key: 'current', label: 'Ongoing & upcoming', test: (s: string) => s === 'ongoing' || s === 'upcoming' },
  { key: 'completed', label: 'Completed', test: (s: string) => s === 'completed' },
  { key: 'draft', label: 'Drafts', test: (s: string) => s === 'draft' },
  { key: 'cancelled', label: 'Cancelled', test: (s: string) => s === 'cancelled' },
  { key: 'all', label: 'All', test: () => true }
]

const months = computed(() => {
  const set = new Map<string, string>()
  for (const e of [...events.value].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    set.set(e.month, new Date(e.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
  }
  return [...set.entries()]
})

const matchQ = (e: Row) => {
  const q = query.value.trim().toLowerCase()
  return !q || `${e.name} ${e.label} ${e.client?.name} ${e.venue_name} ${e.city}`.toLowerCase().includes(q)
}
const matchM = (e: Row) => month.value === 'all' || e.month === month.value
const tabTest = computed(() => TABS.find(t => t.key === tab.value)!.test)

const rows = computed(() => events.value
  .filter(e => tabTest.value(e.display_status) && matchM(e) && matchQ(e))
  .sort((a, b) => {
    const order = ['ongoing', 'upcoming', 'cancelled', 'draft', 'completed']
    return order.indexOf(a.display_status) - order.indexOf(b.display_status) || (a.display_status === 'completed' ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date))
  }))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: events.value.filter(e => t.test(e.display_status) && matchM(e) && matchQ(e)).length })))
const hasFilters = computed(() => !(tab.value === 'current' && month.value === 'all' && !query.value.trim()))

function clear() {
  tab.value = 'all'
  month.value = 'all'
  query.value = ''
}

function edit(e: Row) {
  editing.value = e
  editOpen.value = true
}

function cancel(e: Row) {
  cancelling.value = e
  cancelOpen.value = true
}

async function onSaved(e: Row, isNew: boolean) {
  if (isNew) {
    await navigateTo(`/events/${e.id}`)
    return
  }
  notify(`Saved ${e.label}.`)
  await load()
}

async function onCancelled(e: Row, impact: Row) {
  await load()
  notify(`${e.name} cancelled · ${impact.short ?? ''}`, async () => {
    try {
      await api.del(`/events/${e.id}/cancellation`)
      await load()
    } catch (err) {
      fail(err)
    }
  })
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Events"
      subtitle="Current and upcoming events with their equipment, location, crew and pay."
    >
      <template #actions>
        <NuxtLink
          v-if="can('track', 'edit')"
          to="/scan"
          class="btn btn-strong"
        >
          <UIcon
            name="i-lucide-qr-code"
            class="size-[18px]"
          />Scan QR
        </NuxtLink>
        <button
          v-if="can('events', 'edit')"
          type="button"
          class="btn btn-secondary"
          aria-haspopup="dialog"
          @click="typesOpen = true"
        >
          <UIcon
            name="i-lucide-tags"
            class="size-[18px]"
          />Event types
        </button>
        <button
          v-if="can('events', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="panelOpen = true"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />New event
        </button>
      </template>
    </UiPageHeader>

    <section
      aria-label="Overview"
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
    >
      <UiStatCard
        :loading="loading"
        variant="dark"
        label="Ongoing now"
        dot="#ED1B24"
        :value="kpis.ongoing ?? '—'"
        :sub="kpis.ongoing_note"
        value-class="text-5xl"
      />
      <UiStatCard
        :loading="loading"
        variant="blue"
        label="Upcoming · 30 days"
        :value="kpis.upcoming ?? '—'"
        :sub="kpis.upcoming_note"
        value-class="text-5xl"
      />
      <UiStatCard
        :loading="loading"
        label="Equipment deployed"
      >
        <div class="flex items-baseline gap-1.5">
          <span class="figure text-5xl">{{ kpis.deployed ?? '—' }}</span><span class="text-[15px] text-[#565B66]">of {{ kpis.total_items }} items</span>
        </div>
        <template #sub>
          <NuxtLink
            v-if="kpis.not_returned"
            to="/equipment?tab=deployed"
            class="text-sm font-semibold text-[#B4121A]"
          >{{ kpis.not_returned_note }}</NuxtLink>
          <span
            v-else
            class="text-sm text-[#565B66]"
          >All returned on time</span>
        </template>
      </UiStatCard>
      <UiStatCard
        :loading="loading"
        label="Repair · retired"
      >
        <div class="figure text-5xl">
          {{ kpis.repair ?? 0 }} <span class="text-[#9EA3AD]">·</span> {{ kpis.retired ?? 0 }}
        </div>
        <template #sub>
          <NuxtLink
            to="/equipment"
            class="text-sm font-semibold"
          >See equipment</NuxtLink>
        </template>
      </UiStatCard>
      <UiStatCard
        v-if="kpis.payroll"
        :loading="loading"
        :label="`Next payroll · ${kpis.payroll.label}`"
      >
        <div class="figure text-5xl">
          {{ peso(kpis.payroll.net) }}
        </div>
        <template #sub>
          <NuxtLink
            to="/payroll"
            class="text-sm font-semibold"
          >Review payroll</NuxtLink>
        </template>
      </UiStatCard>
    </section>

    <section
      aria-label="Event list"
      class="card flex flex-col"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter by status"
        />
        <div class="flex flex-wrap items-center gap-2">
          <UiSearchBox
            v-model="query"
            label="Search events"
            placeholder="Search event, client, venue"
          />
          <label class="flex items-center gap-2 text-sm text-[#565B66]">Month
            <select
              v-model="month"
              class="ctl ctl-sm"
              style="width: auto"
            >
              <option value="all">All dates</option>
              <option
                v-for="[v, l] in months"
                :key="v"
                :value="v"
              >{{ l }}</option>
            </select>
          </label>
          <button
            v-if="hasFilters"
            type="button"
            class="min-h-10 cursor-pointer border-0 bg-transparent px-2.5 text-sm font-semibold text-[#2F5596] underline"
            @click="clear"
          >
            Clear filters
          </button>
        </div>
      </div>

      <UiSkeletonTable
        v-if="loading"
        :cols="7"
      />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 1100px"
        >
          <thead>
            <tr>
              <th scope="col">
                Event
              </th>
              <th scope="col">
                Dates
              </th>
              <th scope="col">
                Location
              </th>
              <th scope="col">
                Equipment
              </th>
              <th scope="col">
                Crew
              </th>
              <th
                v-if="canSeeRates"
                scope="col"
                class="text-right"
              >
                Compensation
              </th>
              <th scope="col">
                Status
              </th>
              <th scope="col">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="e in rows"
              :key="e.id"
              :style="{ opacity: e.display_status === 'cancelled' ? .85 : 1 }"
            >
              <td data-cell="title">
                <NuxtLink
                  :to="`/events/${e.id}`"
                  class="text-[15px] font-bold text-[#0B0B0C] no-underline hover:underline"
                >{{ e.label }}</NuxtLink>
                <div class="sub">
                  {{ e.client?.name }}
                </div>
              </td>
              <td
                data-label="Dates"
                class="whitespace-nowrap"
              >
                {{ e.dates_label }}<div class="sub">
                  {{ e.duration_label }}
                </div>
              </td>
              <td data-label="Location">
                {{ e.venue_name }}<div class="sub">
                  {{ e.city }}
                </div>
              </td>
              <td data-label="Equipment">
                {{ e.summary.equipment.text }}<div
                  class="mt-0.5"
                  :class="e.summary.equipment.is_warning ? 'font-semibold text-[#B4121A]' : 'text-[#565B66]'"
                >
                  {{ e.summary.equipment.note }}
                </div>
              </td>
              <td data-label="Crew">
                {{ e.summary.crew.text }}<div
                  class="mt-0.5"
                  :class="e.summary.crew.is_warning ? 'font-semibold text-[#B4121A]' : 'text-[#565B66]'"
                >
                  {{ e.summary.crew.note }}
                </div>
              </td>
              <td
                v-if="canSeeRates"
                data-label="Compensation"
                class="text-right"
              >
                <span class="font-display text-xl font-bold">{{ e.summary.compensation.total > 0 ? peso(e.summary.compensation.total) : (e.display_status === 'cancelled' ? '₱0' : '—') }}</span>
                <div class="sub">
                  {{ e.summary.compensation.total > 0 || e.display_status === 'cancelled' ? e.summary.compensation.note : '' }}
                </div>
              </td>
              <td data-label="Status">
                <UiBadge
                  :tone="EVENT_STATUS[e.display_status]!.tone"
                  :label="EVENT_STATUS[e.display_status]!.label"
                />
                <div class="mt-1 max-w-[180px] text-[13px] text-[#565B66]">
                  {{ e.summary.status_note }}
                </div>
              </td>
              <td
                data-cell="actions"
                class="text-right whitespace-nowrap"
                style="padding-top: 10px"
              >
                <div class="inline-flex gap-1.5">
                  <NuxtLink
                    :to="`/events/${e.id}`"
                    class="btn btn-secondary btn-sm"
                  >View</NuxtLink>
                  <button
                    v-if="e.can_edit && can('events', 'edit')"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    aria-haspopup="dialog"
                    @click="edit(e)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="e.can_cancel && can('events', 'edit')"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    aria-haspopup="dialog"
                    @click="cancel(e)"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && rows.length === 0"
        text="No events match these filters."
        action="Clear filters"
        @action="clear"
      />
      <div
        aria-live="polite"
        class="border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]"
      >
        Showing {{ rows.length }} of {{ events.length }} events
      </div>
    </section>

    <EventsEventPanel
      v-model:open="panelOpen"
      @saved="onSaved"
    />
    <EventsEventTypesModal
      v-if="can('events', 'edit')"
      v-model:open="typesOpen"
      @changed="load"
    />
    <EventsEventPanel
      v-if="editing"
      v-model:open="editOpen"
      :event="editing"
      @saved="onSaved"
      @cancelled="onCancelled"
    />
    <EventsCancelEventModal
      v-if="cancelling"
      v-model:open="cancelOpen"
      :event="cancelling"
      @cancelled="onCancelled"
    />
  </div>
</template>
