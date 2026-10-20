<script setup lang="ts">
import type { MapPin, Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Places' })
useHead({ title: 'Places · Blaster Pro Audio' })

const api = useApi()
const geo = useGeo()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const rows = ref<Row[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Row | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const locating = ref(false)
const blank = () => ({ type: 'warehouse', name: '', address: '', city: '', latitude: null as number | null, longitude: null as number | null, radius_m: 200, is_active: true })
const form = reactive(blank())
const editable = computed(() => can('logistics', 'edit'))
const COLOR: Record<string, string> = { warehouse: '#1D6B3C', venue: '#2F5596', other: '#3B3F47' }

async function load() {
  rows.value = (await api.get<{ data: Row[] }>('/locations')).data
  loading.value = false
}
onMounted(load)

const allPins = computed<MapPin[]>(() => rows.value.filter(r => r.has_pin).map(r => ({ lat: r.latitude, lng: r.longitude, radius: r.radius_m, color: COLOR[r.type], kind: 'place', label: r.label })))
const formPins = computed<MapPin[]>(() => form.latitude !== null && form.longitude !== null ? [{ lat: form.latitude, lng: form.longitude, radius: Number(form.radius_m) || 150, color: COLOR[form.type], kind: 'place', label: form.name || 'New place' }] : [])

function edit(r: Row | null) {
  editing.value = r
  errors.value = {}
  Object.assign(form, blank(), r ? { type: r.type, name: r.name, address: r.address ?? '', city: r.city ?? '', latitude: r.latitude, longitude: r.longitude, radius_m: r.radius_m, is_active: r.is_active } : {})
  open.value = true
}

function pick(lat: number, lng: number) {
  form.latitude = lat
  form.longitude = lng
}

async function here() {
  locating.value = true
  const f = await geo.fix(10000)
  locating.value = false
  if (f.latitude === undefined) {
    notify(f.source === 'denied' ? 'Location is turned off for this site.' : 'Couldn\'t get a GPS fix. Click the map instead.')
    return
  }
  form.latitude = f.latitude
  form.longitude = f.longitude!
}

async function save() {
  busy.value = true
  errors.value = {}
  try {
    const res = editing.value
      ? await api.patch<{ data: Row }>(`/locations/${editing.value.id}`, { ...form })
      : await api.post<{ data: Row }>('/locations', { ...form })
    open.value = false
    notify(`Saved ${res.data.name}.`)
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

async function remove(r: Row) {
  try {
    await api.del(`/locations/${r.id}`)
    notify(`${r.name} removed.`)
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Places"
      subtitle="Warehouses and venues with a pin and a fence. Scans are checked against them, and labelled with the place's name."
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
          />Add place
        </button>
      </template>
    </UiPageHeader>
    <LogisticsNav />

    <section
      aria-label="Map of places"
      class="card p-4"
    >
      <UiMapView
        :pins="allPins"
        :height="300"
        label="Map of warehouses and venues"
      />
    </section>

    <section
      aria-label="Places"
      class="card flex flex-col"
    >
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
              <th>Place</th><th>Type</th><th>Pin</th><th>Items based here</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.id"
              :class="{ 'opacity-60': !r.is_active }"
            >
              <td data-cell="title">
                <span class="text-[15px] font-bold">{{ r.name }}</span>
                <div class="sub">
                  {{ [r.address, r.city].filter(Boolean).join(', ') || '—' }}
                </div>
              </td>
              <td data-label="Type">
                {{ r.type_label }}
              </td>
              <td data-label="Pin">
                <template v-if="r.has_pin">
                  <span class="font-mono text-[13px]">{{ r.latitude.toFixed(4) }}, {{ r.longitude.toFixed(4) }}</span>
                  <div class="sub">
                    Fence {{ r.radius_m }} m
                  </div>
                </template>
                <span
                  v-else
                  class="font-semibold text-[#6B4100]"
                >Not pinned</span>
              </td>
              <td data-label="Items">
                {{ r.type === 'warehouse' ? (r.items_count ?? 0) : '—' }}
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
                    @click="edit(r)"
                  >
                    {{ r.has_pin ? 'Edit' : 'Pin it' }}
                  </button>
                  <button
                    v-if="!r.items_count"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    @click="remove(r)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <UiSlidePanel
      v-model:open="open"
      :title="editing ? `Edit ${editing.name}` : 'Add place'"
      subtitle="Click the map to drop the pin, or stand there and use your location."
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
          >
        </UiField>
        <UiField label="Type">
          <select
            v-model="form.type"
            class="ctl"
          >
            <option value="warehouse">
              Warehouse
            </option>
            <option value="venue">
              Venue
            </option>
            <option value="other">
              Other
            </option>
          </select>
        </UiField>
        <UiField
          label="Address"
          optional
        >
          <input
            v-model="form.address"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField
          label="City"
          optional
        >
          <input
            v-model="form.city"
            type="text"
            class="ctl"
          >
        </UiField>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Pin</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="locating"
            @click="here"
          >
            <UIcon
              name="i-lucide-locate-fixed"
              class="size-4"
            />{{ locating ? 'Locating…' : 'Use my location' }}
          </button>
        </div>
        <UiMapView
          v-if="open"
          :pins="formPins"
          :height="260"
          pickable
          label="Click to place the pin"
          @pick="pick"
        />
        <span class="help">{{ form.latitude !== null ? `${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}` : 'No pin yet. Click the map.' }}</span>
        <p
          v-if="errors.latitude"
          role="alert"
          class="err m-0"
        >
          {{ errors.latitude }}
        </p>
      </div>
      <UiField
        label="Fence radius (m)"
        help="Scans inside this circle count as at this place. Venues: 300–500 m covers parking and loading bays."
        :error="errors.radius_m"
      >
        <input
          v-model.number="form.radius_m"
          type="number"
          min="25"
          max="5000"
          step="25"
          class="ctl"
        >
      </UiField>
      <label class="flex items-center gap-2 text-sm font-semibold">
        <input
          v-model="form.is_active"
          type="checkbox"
          class="size-5 accent-[#2F5596]"
        > Active
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
          :disabled="busy || !form.name.trim()"
          @click="save"
        >
          {{ editing ? 'Save changes' : 'Add place' }}
        </button>
      </template>
    </UiSlidePanel>
  </div>
</template>
