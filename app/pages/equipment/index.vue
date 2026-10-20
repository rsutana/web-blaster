<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'equip', title: 'Equipment' })
useHead({ title: 'Equipment · Blaster Pro Audio' })

const api = useApi()
const route = useRoute()
const { notify, fail } = useNotify()
const { can } = useAuthUser()

const items = ref<Row[]>([])
const loading = ref(true)
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'service')
const cat = ref('all')
const query = ref('')
const page = ref(1)
const selected = ref<string[]>([])
const panelOpen = ref(false)
const editing = ref<Row | null>(null)
const statusOpen = ref(false)
const statusItem = ref<Row | null>(null)
const changedNow = ref<Record<string, boolean>>({})
const importInput = ref<HTMLInputElement | null>(null)

async function load() {
  items.value = (await api.get<{ data: Row[] }>('/equipment')).data
  loading.value = false
}
onMounted(load)

const TABS = [
  { key: 'service', label: 'In service', test: (i: Row) => !['retired', 'lost'].includes(i.status) },
  { key: 'available', label: 'Available', test: (i: Row) => i.status === 'available' },
  { key: 'deployed', label: 'Deployed', test: (i: Row) => i.status === 'deployed' },
  { key: 'under_repair', label: 'Under repair', test: (i: Row) => i.status === 'under_repair' },
  { key: 'retired', label: 'Retired', test: (i: Row) => i.status === 'retired' },
  { key: 'lost', label: 'Lost', test: (i: Row) => i.status === 'lost' },
  { key: 'all', label: 'All', test: () => true }
]
const CATS = [['all', 'All'], ['audio', 'Audio'], ['lighting', 'Lighting'], ['cables', 'Cables'], ['stage_truss', 'Stage & truss'], ['power', 'Power'], ['video', 'Video'], ['other', 'Other']]
const match = (i: Row) => {
  const q = query.value.trim().toLowerCase()
  return (cat.value === 'all' || i.category === cat.value) && (!q || `${i.code} ${i.name}`.toLowerCase().includes(q))
}
const filtered = computed(() => items.value.filter(i => TABS.find(t => t.key === tab.value)!.test(i) && match(i)))
const rows = computed(() => filtered.value.slice((page.value - 1) * 15, page.value * 15))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: items.value.filter(i => t.test(i) && match(i)).length })))
const hasFilters = computed(() => tab.value !== 'service' || cat.value !== 'all' || !!query.value.trim())
watch([tab, cat, query], () => {
  page.value = 1
})
const stats = computed(() => ({
  total: items.value.length,
  available: items.value.filter(i => i.status === 'available').length,
  deployed: items.value.filter(i => i.status === 'deployed').length,
  overdue: items.value.filter(i => i.is_overdue).length,
  repair: items.value.filter(i => i.status === 'under_repair').length,
  retired: items.value.filter(i => i.status === 'retired').length,
  lost: items.value.filter(i => i.status === 'lost').length
}))

function clear() {
  tab.value = 'service'
  cat.value = 'all'
  query.value = ''
}

function add() {
  editing.value = null
  panelOpen.value = true
}

function edit(i: Row) {
  editing.value = i
  panelOpen.value = true
}

function changeStatus(i: Row) {
  statusItem.value = i
  statusOpen.value = true
}

async function onStatus(item: Row, status: string, note: string, previous: string) {
  changedNow.value[item.code] = true
  await load()
  notify(`${item.code} is now ${EQUIPMENT_STATUS[status]!.label}${note ? ` · "${note}"` : ''}. Logged in its history.`, async () => {
    try {
      await api.post(`/equipment/${item.code}/status-changes`, { status: previous === 'deployed' ? 'available' : previous, note: 'status change undone' })
      changedNow.value = Object.fromEntries(Object.entries(changedNow.value).filter(([k]) => k !== item.code))
      await load()
    } catch (e) {
      fail(e)
    }
  })
}

async function onSaved(saved: Row[], isNew: boolean, print: boolean, again: boolean) {
  await load()
  if (isNew) {
    notify(`${plural(saved.length, 'item')} added: ${saved.map(s => s.code).join(', ')}.`)
    if (print && !again) {
      await navigateTo(`/equipment/labels?codes=${saved.map(s => s.code).join(',')}`)
    }
  } else {
    notify(`Saved ${saved[0]!.code}.`)
  }
}

async function bulk(status: 'available' | 'retired') {
  try {
    await api.post('/equipment-status-batches', { codes: selected.value, status, note: status === 'available' ? 'marked repaired' : 'retired in bulk' })
    notify(`${plural(selected.value.length, 'item')} set to ${EQUIPMENT_STATUS[status]!.label}.`)
    selected.value = []
    await load()
  } catch (e) {
    fail(e)
  }
}

function printSelected() {
  navigateTo(`/equipment/labels?codes=${(selected.value.length ? selected.value : filtered.value.map(i => i.code)).join(',')}`)
}

async function importCsv(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) {
    return
  }
  const fd = new FormData()
  fd.append('file', f)
  try {
    const res = await api.post<{ data: { created: number, errors: string[] } }>('/equipment-imports', fd)
    await load()
    notify(`${plural(res.data.created, 'item')} imported.${res.data.errors.length ? ' ' + res.data.errors[0] : ''}`)
  } catch (err) {
    fail(err)
  } finally {
    (e.target as HTMLInputElement).value = ''
  }
}

function badgeFor(i: Row) {
  return i.is_overdue ? EQUIPMENT_STATUS.overdue! : EQUIPMENT_STATUS[i.status]!
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Equipment"
      subtitle="Everything you own, where it is now, and what shape it's in."
    >
      <template #actions>
        <template v-if="can('equip', 'edit')">
          <button
            type="button"
            class="btn btn-secondary"
            title="Columns: name, category, prefix, quantity, brand_model, home_location, rental_rate, replacement_value, purchase_cost"
            @click="importInput?.click()"
          >
            Import CSV
          </button>
          <input
            ref="importInput"
            type="file"
            accept=".csv,text/csv"
            class="sr-only"
            @change="importCsv"
          >
        </template>
        <button
          type="button"
          class="btn btn-strong"
          @click="printSelected"
        >
          Print QR labels
        </button>
        <button
          v-if="can('equip', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="add"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add item
        </button>
      </template>
    </UiPageHeader>

    <section
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr))"
    >
      <UiStatCard
        :loading="loading"
        variant="dark"
        label="Total items"
        :value="stats.total"
      />
      <UiStatCard
        :loading="loading"
        label="Available"
        :value="stats.available"
        value-class="text-[44px] text-[#1D6B3C]"
      />
      <UiStatCard
        :loading="loading"
        variant="blue"
        label="Deployed"
        :value="stats.deployed"
      >
        <template #sub>
          <span
            v-if="stats.overdue"
            class="text-sm font-semibold text-white"
          >{{ stats.overdue }} overdue return</span>
        </template>
      </UiStatCard>
      <UiStatCard
        :loading="loading"
        label="Under repair"
        :value="stats.repair"
        value-class="text-[44px] text-[#6B4100]"
      />
      <UiStatCard
        :loading="loading"
        label="Retired · lost"
      >
        <div class="figure text-[44px]">
          {{ stats.retired }} <span class="text-[#9EA3AD]">·</span> <span class="text-[#B4121A]">{{ stats.lost }}</span>
        </div>
      </UiStatCard>
    </section>

    <section class="card flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter equipment"
        />
        <div class="flex flex-wrap items-center gap-2">
          <UiSearchBox
            v-model="query"
            label="Search equipment"
            placeholder="ID or name, or scan"
            :width="220"
          />
          <label class="flex items-center gap-2 text-sm text-[#565B66]">Category
            <select
              v-model="cat"
              class="ctl ctl-sm"
              style="width: auto"
            ><option
              v-for="[v, l] in CATS"
              :key="v"
              :value="v"
            >{{ l }}</option></select>
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
      <div
        v-if="selected.length"
        class="flex flex-wrap items-center gap-2 bg-[#0B0B0C] px-4 py-2.5 text-white"
      >
        <b class="mr-2">{{ selected.length }} selected</b>
        <button
          type="button"
          class="btn btn-xs border border-[#3B3F47] bg-transparent text-white"
          style="min-height: 36px"
          @click="printSelected"
        >
          Print QR labels
        </button>
        <template v-if="can('equip', 'edit')">
          <button
            type="button"
            class="btn btn-xs border border-[#3B3F47] bg-transparent text-white"
            style="min-height: 36px"
            @click="bulk('available')"
          >
            Mark repaired
          </button>
          <button
            type="button"
            class="btn btn-xs border border-[#3B3F47] bg-transparent text-white"
            style="min-height: 36px"
            @click="bulk('retired')"
          >
            Retire
          </button>
        </template>
        <button
          type="button"
          class="ml-auto cursor-pointer border-0 bg-transparent text-sm text-white underline"
          @click="selected = []"
        >
          Clear selection
        </button>
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
          style="min-width: 1120px"
        >
          <thead>
            <tr>
              <th><span class="sr-only">Select</span></th><th>QR / ID</th><th>Item</th><th>Status</th><th>Where now</th><th>Last scan</th><th>Condition</th><th>Rental rate</th><th>Used</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="i in rows"
              :key="i.id"
              :class="selected.includes(i.code) ? 'bg-[#F3F6FB]' : ''"
            >
              <td data-cell="select">
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="i.code"
                  :aria-label="`Select ${i.code}`"
                  class="size-[18px] accent-[#2F5596]"
                >
              </td>
              <td data-cell="title">
                <NuxtLink
                  :to="`/equipment/${i.code}`"
                  class="font-mono font-medium"
                >{{ i.code }}</NuxtLink>
              </td>
              <td data-label="Item">
                <span class="font-semibold">{{ i.name }}</span><div class="sub">
                  {{ i.category_label }}
                </div>
              </td>
              <td data-label="Status">
                <UiBadge
                  :tone="badgeFor(i).tone"
                  :label="badgeFor(i).label"
                />
                <div
                  v-if="changedNow[i.code]"
                  class="mt-1 text-[13px] font-semibold text-[#2F5596]"
                >
                  changed just now
                </div>
              </td>
              <td data-label="Where now">
                {{ i.where.line }}<div
                  v-if="i.where.note"
                  class="mt-0.5 text-[13px]"
                  :class="i.where.is_warning ? 'font-semibold text-[#B4121A]' : 'text-[#565B66]'"
                >
                  {{ i.where.note }}
                </div>
              </td>
              <td data-label="Last scan">
                <template v-if="i.last_scan">
                  {{ i.last_scan.who }} · {{ i.last_scan.date }}<div class="sub text-[13px]">
                    {{ i.last_scan.action }}
                  </div>
                </template>
              </td>
              <td data-label="Condition">
                {{ i.condition_label }}
              </td>
              <td data-label="Rental rate">
                <template v-if="i.rental_rate">
                  {{ peso(i.rental_rate) }} / day
                </template><template v-else>
                  —
                </template>
                <div
                  v-if="i.replacement_value"
                  class="sub text-[13px]"
                >
                  repl. {{ peso(i.replacement_value) }}
                </div>
              </td>
              <td data-label="Used">
                <span class="font-display text-lg font-bold">{{ i.used_count }}</span>
              </td>
              <td
                data-cell="actions"
                class="text-right whitespace-nowrap"
              >
                <div
                  v-if="can('equip', 'edit')"
                  class="inline-flex gap-1.5"
                >
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="edit(i)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-dark btn-sm"
                    @click="changeStatus(i)"
                  >
                    Status
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !filtered.length"
        text="No items match these filters."
        action="Clear filters"
        @action="clear"
      />
      <UiPager
        v-model="page"
        :total="filtered.length"
        :per-page="15"
        noun="items"
      />
      <div class="border-t border-[#DADDE3] px-4 py-2.5 text-[13px] text-[#565B66]">
        Rental rates are for reference only (not used in totals yet).
      </div>
    </section>

    <EquipmentItemPanel
      v-model:open="panelOpen"
      :item="editing"
      @saved="onSaved"
      @status-changed="(s: string, n: string, p: string) => onStatus(editing!, s, n, p)"
    />
    <EquipmentChangeStatusModal
      v-if="statusItem"
      v-model:open="statusOpen"
      :item="statusItem"
      @changed="(s: string, n: string, p: string) => onStatus(statusItem!, s, n, p)"
    />
  </div>
</template>
