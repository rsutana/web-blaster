<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'clients', title: 'Clients' })
useHead({ title: 'Clients · Blaster Pro Audio' })

const api = useApi()
const { notify } = useNotify()
const { can } = useAuthUser()

const clients = ref<Row[]>([])
const loading = ref(true)
const tab = ref('active')
const type = ref('all')
const query = ref('')
const panelOpen = ref(false)
const editing = ref<Row | null>(null)
const eventOpen = ref(false)
const eventClient = ref<number | null>(null)

async function load() {
  clients.value = (await api.get<{ data: Row[] }>('/clients')).data
  loading.value = false
}
onMounted(load)

const TABS = [
  { key: 'active', label: 'Active', test: (c: Row) => c.status === 'active' },
  { key: 'upcoming', label: 'With upcoming events', test: (c: Row) => c.status === 'active' && c.history.has_upcoming },
  { key: 'inactive', label: 'Inactive', test: (c: Row) => c.status === 'inactive' },
  { key: 'all', label: 'All', test: () => true }
]
const TYPES = [['all', 'All types'], ['corporate', 'Corporate'], ['individual', 'Individual'], ['school', 'School'], ['government_lgu', 'Government / LGU'], ['church_community', 'Church / community'], ['agency', 'Agency'], ['venue_partner', 'Venue partner']]

const match = (c: Row) => {
  const q = query.value.trim().toLowerCase()
  return (type.value === 'all' || c.type === type.value) && (!q || `${c.name} ${c.contact_name} ${c.mobile} ${c.city}`.toLowerCase().includes(q))
}
const rows = computed(() => clients.value.filter(c => TABS.find(t => t.key === tab.value)!.test(c) && match(c)))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: clients.value.filter(c => t.test(c) && match(c)).length })))
const hasFilters = computed(() => tab.value !== 'active' || type.value !== 'all' || !!query.value.trim())
const year = new Date().getFullYear()
const stats = computed(() => ({
  active: clients.value.filter(c => c.status === 'active').length,
  upcoming: clients.value.filter(c => c.status === 'active' && c.history.has_upcoming).length,
  events: clients.value.reduce((n, c) => n + c.history.events_count, 0),
  repeat: clients.value.filter(c => c.history.events_count >= 2).length
}))

function clear() {
  tab.value = 'active'
  type.value = 'all'
  query.value = ''
}

function add() {
  editing.value = null
  panelOpen.value = true
}

function edit(c: Row) {
  editing.value = c
  panelOpen.value = true
}

function newEvent(c: Row) {
  eventClient.value = c.id
  eventOpen.value = true
}

async function onSaved(c: Row, isNew: boolean) {
  await load()
  if (isNew) {
    tab.value = 'active'
    notify(`${c.name} was added. Pick it as the client when you create an event.`)
  } else {
    notify(c.status === 'inactive' ? `Saved ${c.name}. It is now Inactive.` : `Saved ${c.name}.`)
  }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Clients"
      subtitle="Everyone you do events for, their main contact, and their event history."
    >
      <template #actions>
        <button
          v-if="can('clients', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="add"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add client
        </button>
      </template>
    </UiPageHeader>

    <section
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
    >
      <UiStatCard
        variant="dark"
        label="Active clients"
        :value="stats.active"
      />
      <UiStatCard
        variant="blue"
        label="With upcoming events"
        :value="stats.upcoming"
      />
      <UiStatCard
        :label="`Events in ${year}`"
        :value="stats.events"
      />
      <UiStatCard
        label="Repeat clients"
        :value="stats.repeat"
        sub="2+ events"
      />
    </section>

    <section class="card flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter clients"
        />
        <div class="flex flex-wrap items-center gap-2">
          <UiSearchBox
            v-model="query"
            label="Search clients"
            placeholder="Client, contact, mobile, city"
            :width="250"
          />
          <label class="flex items-center gap-2 text-sm text-[#565B66]">Type
            <select
              v-model="type"
              class="ctl ctl-sm"
              style="width: auto"
            >
              <option
                v-for="[v, l] in TYPES"
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
      <UiSpinner v-if="loading" />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 1160px"
        >
          <thead>
            <tr>
              <th>Client</th><th>Main contact</th><th>Project status</th><th>Payment status</th><th>Events</th><th>Last event</th><th>Next event</th><th>Status</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in rows"
              :key="c.id"
            >
              <td data-cell="title">
                <button
                  type="button"
                  class="cursor-pointer border-0 bg-transparent p-0 text-left text-[15px] font-bold"
                  :class="c.status === 'active' ? 'text-[#2F5596]' : 'text-[#565B66]'"
                  @click="edit(c)"
                >
                  {{ c.name }}
                </button>
                <div class="sub">
                  {{ c.type_label }}{{ c.city ? ' · ' + c.city : '' }}
                </div>
              </td>
              <td data-label="Main contact">
                {{ c.contact_name }}{{ c.contact_position ? ' · ' + c.contact_position : '' }}<div class="sub">
                  {{ phone(c.mobile) }}
                </div>
              </td>
              <td data-label="Project">
                <UiBadge
                  :tone="BOOKING_STAGE[c.history.project.key] ?? TONES.grey"
                  :label="c.history.project.label"
                />
                <div class="mt-1 text-[13px] text-[#565B66]">
                  {{ c.history.project.note }}
                </div>
              </td>
              <td data-label="Payment">
                <UiBadge
                  :tone="PAYMENT_STATUS[c.history.payment.key] ?? TONES.grey"
                  :label="c.history.payment.label"
                />
                <div class="mt-1 text-[13px] text-[#565B66]">
                  {{ c.history.payment.note }}
                </div>
              </td>
              <td data-label="Events">
                <span class="font-display text-xl font-bold">{{ c.history.events_count }}</span><div class="sub text-[13px]">
                  since {{ c.history.since_year }}
                </div>
              </td>
              <td data-label="Last event">
                {{ c.history.last_event ?? '—' }}
              </td>
              <td data-label="Next event">
                <span
                  v-if="!c.history.next_event"
                  class="text-[#565B66]"
                >—</span>
                <span
                  v-else
                  class="font-semibold"
                  :class="c.history.next_event.is_ongoing ? 'text-[#B4121A]' : ''"
                >{{ c.history.next_event.label }}</span>
              </td>
              <td data-label="Status">
                <UiBadge
                  :tone="c.status === 'active' ? TONES.green : TONES.grey"
                  :label="c.status === 'active' ? 'Active' : 'Inactive'"
                />
              </td>
              <td
                data-cell="actions"
                class="text-right whitespace-nowrap"
              >
                <div
                  v-if="can('clients', 'edit')"
                  class="inline-flex gap-1.5"
                >
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="edit(c)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="c.status === 'active' && can('events', 'edit')"
                    type="button"
                    class="btn btn-dark btn-sm"
                    @click="newEvent(c)"
                  >
                    + Event
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !rows.length"
        text="No clients match these filters."
        action="Clear filters"
        @action="clear"
      />
      <div class="border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
        Showing {{ rows.length }} of {{ clients.length }} clients
      </div>
    </section>

    <ClientsClientPanel
      v-model:open="panelOpen"
      :client="editing"
      @saved="onSaved"
    />
    <EventsEventPanel
      v-model:open="eventOpen"
      :client-id="eventClient"
      @saved="(e: Row) => navigateTo(`/events/${e.id}`)"
    />
  </div>
</template>
