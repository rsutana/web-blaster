<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Cases' })
useHead({ title: 'Cases · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const rows = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const loading = ref(true)
const open = ref(false)
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ name: '', type: 'road_case', warehouse_id: null as number | null })
const query = ref('')

async function load() {
  const [c, w] = await Promise.all([api.get<{ data: Row[] }>('/containers'), api.get<{ data: Row[] }>('/locations', { type: 'warehouse' })])
  rows.value = c.data
  warehouses.value = w.data
  loading.value = false
}
onMounted(load)

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return rows.value.filter(r => !q || `${r.code} ${r.name}`.toLowerCase().includes(q))
})

function add() {
  Object.assign(form, { name: '', type: 'road_case', warehouse_id: warehouses.value[0]?.id ?? null })
  errors.value = {}
  open.value = true
}

async function save() {
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/containers', { ...form })
    open.value = false
    notify(`${res.data.code} created. Pack it by scanning items into it.`)
    await navigateTo(`/logistics/cases/${res.data.id}`)
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
  <div class="contents">
    <UiPageHeader
      title="Cases & boxes"
      subtitle="Each case has its own QR. Scanning it loads, unloads or adds everything packed inside."
    >
      <template #actions>
        <NuxtLink
          v-if="rows.length"
          :to="`/equipment/labels?codes=${rows.map(r => r.code).join(',')}`"
          class="btn btn-secondary"
        >
          <UIcon
            name="i-lucide-printer"
            class="size-[18px]"
          />Print labels
        </NuxtLink>
        <button
          v-if="can('logistics', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="add"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />New case
        </button>
      </template>
    </UiPageHeader>
    <LogisticsNav />

    <section
      aria-label="Cases"
      class="card flex flex-col"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiSearchBox
          v-model="query"
          label="Search cases"
          placeholder="Case ID or name"
        />
      </div>
      <UiSkeletonTable
        v-if="loading"
        :cols="5"
        :rows="4"
      />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 760px"
        >
          <thead>
            <tr>
              <th>Case</th><th>Type</th><th>Packed</th><th>Where now</th><th>State</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in visible"
              :key="r.id"
            >
              <td data-cell="title">
                <NuxtLink
                  :to="`/logistics/cases/${r.id}`"
                  class="font-mono text-[15px] font-medium"
                >{{ r.code }}</NuxtLink>
                <div class="text-[15px] font-semibold">
                  {{ r.name }}
                </div>
              </td>
              <td data-label="Type">
                {{ r.type_label }}
              </td>
              <td data-label="Packed">
                <span class="figure text-2xl">{{ r.items_count }}</span> <span class="text-sm text-[#565B66]">items</span>
              </td>
              <td data-label="Where now">
                {{ r.current_location ?? r.warehouse_name ?? '—' }}
              </td>
              <td data-label="State">
                <UiBadge
                  :tone="LOCATION_STATE[r.location_state]!"
                  :label="r.location_state_label"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !visible.length"
        :text="rows.length ? 'No cases match.' : 'No cases yet. Make one per road case or box you move as a unit.'"
      />
    </section>

    <UiSlidePanel
      v-model:open="open"
      title="New case"
      subtitle="It gets the next CASE- number and its own QR label."
    >
      <UiField
        label="Name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
          placeholder="e.g. Moving heads box B"
        >
      </UiField>
      <UiField label="Type">
        <select
          v-model="form.type"
          class="ctl"
        >
          <option value="road_case">
            Road case
          </option>
          <option value="box">
            Box
          </option>
          <option value="rack">
            Rack
          </option>
          <option value="bag">
            Bag
          </option>
        </select>
      </UiField>
      <UiField
        v-if="warehouses.length > 1"
        label="Home warehouse"
      >
        <select
          v-model="form.warehouse_id"
          class="ctl"
        >
          <option
            v-for="w in warehouses"
            :key="w.id"
            :value="w.id"
          >
            {{ w.name }}
          </option>
        </select>
      </UiField>
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
          :disabled="busy || !form.name.trim()"
          @click="save"
        >
          Create case
        </button>
      </template>
    </UiSlidePanel>
  </div>
</template>
