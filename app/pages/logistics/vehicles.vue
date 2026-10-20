<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Trucks' })
useHead({ title: 'Trucks · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const rows = ref<Row[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Row | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const blank = () => ({ name: '', plate_no: '', type: 'truck', ownership: 'owned', hauler_name: '', capacity_note: '', notes: '', is_active: true })
const form = reactive(blank())
const editable = computed(() => can('logistics', 'edit'))

async function load() {
  rows.value = (await api.get<{ data: Row[] }>('/vehicles')).data
  loading.value = false
}
onMounted(load)

function edit(v: Row | null) {
  editing.value = v
  errors.value = {}
  Object.assign(form, blank(), v ? { name: v.name, plate_no: v.plate_no, type: v.type, ownership: v.ownership, hauler_name: v.hauler_name ?? '', capacity_note: v.capacity_note ?? '', notes: v.notes ?? '', is_active: v.is_active } : {})
  open.value = true
}

async function save() {
  busy.value = true
  errors.value = {}
  const body = { ...form, hauler_name: form.ownership === 'hired' ? form.hauler_name : null }
  try {
    const res = editing.value
      ? await api.patch<{ data: Row }>(`/vehicles/${editing.value.id}`, body)
      : await api.post<{ data: Row }>('/vehicles', body)
    open.value = false
    notify(`Saved ${res.data.label}.`)
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

async function remove(v: Row) {
  try {
    await api.del(`/vehicles/${v.id}`)
    notify(`${v.name} removed.`)
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Trucks"
      subtitle="Your own trucks and the ones you hire. Pick one when planning a trip."
    >
      <template #actions>
        <button
          v-if="editable"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="edit(null)"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add truck
        </button>
      </template>
    </UiPageHeader>
    <LogisticsNav />

    <section
      aria-label="Trucks"
      class="card flex flex-col"
    >
      <UiSkeletonTable
        v-if="loading"
        :cols="6"
        :rows="4"
      />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 820px"
        >
          <thead>
            <tr>
              <th>Truck</th><th>Type</th><th>Owned or hired</th><th>Capacity</th><th>Trips</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="v in rows"
              :key="v.id"
              :class="{ 'opacity-60': !v.is_active }"
            >
              <td data-cell="title">
                <span class="text-[15px] font-bold">{{ v.name }}</span>
                <div class="sub font-mono">
                  {{ v.plate_no }}{{ v.is_active ? '' : ' · inactive' }}
                </div>
              </td>
              <td data-label="Type">
                {{ v.type_label }}
              </td>
              <td data-label="Ownership">
                <UiBadge
                  :tone="v.ownership === 'hired' ? TONES.amber : TONES.grey"
                  :label="v.ownership_label"
                />
                <div
                  v-if="v.hauler_name"
                  class="sub"
                >
                  {{ v.hauler_name }}
                </div>
              </td>
              <td data-label="Capacity">
                {{ v.capacity_note ?? '—' }}
              </td>
              <td data-label="Trips">
                {{ v.trips_count ?? 0 }}
              </td>
              <td
                data-cell="actions"
                class="text-right"
              >
                <div
                  v-if="editable"
                  class="inline-flex gap-1.5"
                >
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    aria-haspopup="dialog"
                    @click="edit(v)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="!v.trips_count"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    @click="remove(v)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !rows.length"
        text="No trucks yet. Add your own trucks, and any you hire regularly."
      />
    </section>

    <UiSlidePanel
      v-model:open="open"
      :title="editing ? `Edit ${editing.name}` : 'Add truck'"
      subtitle="Hired trucks keep who you hire them from."
    >
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Name *"
          :error="errors.name"
        >
          <input
            v-model="form.name"
            type="text"
            class="ctl"
            placeholder="Truck 3"
          >
        </UiField>
        <UiField
          label="Plate no. *"
          :error="errors.plate_no"
        >
          <input
            v-model="form.plate_no"
            type="text"
            class="ctl font-mono uppercase"
            placeholder="ABC 1234"
          >
        </UiField>
      </div>
      <UiField label="Type">
        <select
          v-model="form.type"
          class="ctl"
        >
          <option value="truck">
            Truck
          </option>
          <option value="van">
            Van
          </option>
          <option value="pickup">
            Pickup
          </option>
          <option value="other">
            Other
          </option>
        </select>
      </UiField>
      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-1.5 text-sm font-semibold">
          Owned or hired
        </legend>
        <UiSegmented
          v-model="form.ownership"
          name="ownership"
          :options="[{ value: 'owned', label: 'Ours' }, { value: 'hired', label: 'Hired' }]"
        />
      </fieldset>
      <UiField
        v-if="form.ownership === 'hired'"
        label="Hired from *"
        :error="errors.hauler_name"
      >
        <input
          v-model="form.hauler_name"
          type="text"
          class="ctl"
          placeholder="e.g. JRS Haulers"
        >
      </UiField>
      <UiField
        label="Capacity"
        optional
      >
        <input
          v-model="form.capacity_note"
          type="text"
          class="ctl"
          placeholder="e.g. 6-wheeler · 4 t"
        >
      </UiField>
      <UiField
        label="Notes"
        optional
      >
        <textarea
          v-model="form.notes"
          rows="2"
          class="ctl"
        />
      </UiField>
      <label class="flex items-center gap-2 text-sm font-semibold">
        <input
          v-model="form.is_active"
          type="checkbox"
          class="size-5 accent-[#2F5596]"
        > Available for new trips
      </label>
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
          :disabled="busy || !form.name.trim() || !form.plate_no.trim()"
          @click="save"
        >
          {{ editing ? 'Save changes' : 'Add truck' }}
        </button>
      </template>
    </UiSlidePanel>
  </div>
</template>
