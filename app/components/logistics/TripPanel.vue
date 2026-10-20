<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event?: Row | null, trip?: Row | null }>()
const emit = defineEmits<{ saved: [trip: Row, isNew: boolean] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const { canSeeRates } = useAuthUser()

const events = ref<Row[]>([])
const vehicles = ref<Row[]>([])
const outsiders = ref<Row[]>([])
const people = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const crewOnEvent = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const blank = () => ({ event_id: null as number | null, direction: 'outbound', vehicle_id: null as number | null, driverKind: 'crew', driver_personnel_id: null as number | null, external_driver_id: null as number | null, helper_ids: [] as number[], warehouse_id: null as number | null, scheduled_at: '', hire_cost: '', notes: '' })
const form = reactive(blank())
const isEdit = computed(() => !!props.trip)
const vehicle = computed(() => vehicles.value.find(v => v.id === form.vehicle_id) ?? null)
const drivers = computed(() => [...people.value].sort((a, b) => Number(b.usual_role === 'driver') - Number(a.usual_role === 'driver') || a.full_name.localeCompare(b.full_name)))

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  Object.assign(form, blank())
  const t = props.trip
  if (t) {
    Object.assign(form, {
      event_id: t.event.id, direction: t.direction, vehicle_id: t.vehicle?.id ?? null,
      driverKind: t.driver?.kind === 'outside' ? 'outside' : 'crew',
      driver_personnel_id: t.driver?.kind === 'crew' ? t.driver.id : null,
      external_driver_id: t.driver?.kind === 'outside' ? t.driver.id : null,
      helper_ids: t.helpers.map((h: Row) => h.id), scheduled_at: t.scheduled_at ?? '',
      hire_cost: t.hire_cost ?? '', notes: t.notes ?? ''
    })
  } else if (props.event) {
    form.event_id = props.event.id
    form.direction = ['completed'].includes(props.event.status) ? 'return' : 'outbound'
  }
  const [v1, d1, p1, w1, e1] = await Promise.all([
    api.get<{ data: Row[] }>('/vehicles'),
    api.get<{ data: Row[] }>('/external-drivers'),
    api.get<{ data: Row[] }>('/personnel').catch(() => ({ data: [] })),
    api.get<{ data: Row[] }>('/locations', { type: 'warehouse' }),
    props.event || props.trip ? Promise.resolve({ data: [] as Row[] }) : api.get<{ data: Row[] }>('/events')
  ])
  vehicles.value = v1.data.filter(x => x.is_active || x.id === form.vehicle_id)
  outsiders.value = d1.data.filter(x => x.is_active || x.id === form.external_driver_id)
  people.value = p1.data.filter(x => x.status === 'active' || x.id === form.driver_personnel_id)
  warehouses.value = w1.data.filter(x => x.is_active)
  events.value = e1.data.filter(e => ['confirmed', 'completed'].includes(e.status))
  form.warehouse_id = warehouses.value[0]?.id ?? null
}, { immediate: true })

watch(() => form.event_id, async (id) => {
  crewOnEvent.value = []
  if (!id || !open.value) {
    return
  }
  try {
    crewOnEvent.value = (await api.get<{ data: Row }>(`/events/${id}`)).data.assignments ?? []
  } catch {
    crewOnEvent.value = []
  }
})

function toggleHelper(id: number) {
  form.helper_ids = form.helper_ids.includes(id) ? form.helper_ids.filter(h => h !== id) : [...form.helper_ids, id]
}

async function save() {
  busy.value = true
  errors.value = {}
  const body: Row = {
    vehicle_id: form.vehicle_id,
    driver_personnel_id: form.driverKind === 'crew' ? form.driver_personnel_id : null,
    external_driver_id: form.driverKind === 'outside' ? form.external_driver_id : null,
    helper_ids: form.helper_ids,
    scheduled_at: form.scheduled_at || null,
    hire_cost: vehicle.value?.ownership === 'hired' && form.hire_cost !== '' ? Number(String(form.hire_cost).replace(/,/g, '')) : null,
    notes: form.notes || null
  }
  try {
    let res: { data: Row }
    if (isEdit.value) {
      res = await api.patch<{ data: Row }>(`/trips/${props.trip!.id}`, body)
    } else {
      if (!form.event_id) {
        errors.value = { event_id: 'Pick the event this trip is for.' }
        return
      }
      res = await api.post<{ data: Row }>(`/events/${form.event_id}/trips`, { ...body, direction: form.direction, warehouse_id: form.warehouse_id })
    }
    open.value = false
    emit('saved', res.data, !isEdit.value)
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
    :title="isEdit ? `Edit ${trip!.code}` : 'Plan a trip'"
    :subtitle="isEdit ? trip!.event.label : (event ? `${event.label} · ${event.short_dates ?? ''}` : 'A truck run to or from an event.')"
  >
    <UiField
      v-if="!event && !isEdit"
      label="Event *"
      :error="errors.event_id"
    >
      <select
        v-model="form.event_id"
        class="ctl"
      >
        <option :value="null">
          Pick an event
        </option>
        <option
          v-for="e in events"
          :key="e.id"
          :value="e.id"
        >
          {{ e.label }} · {{ e.dates_label }}
        </option>
      </select>
    </UiField>

    <fieldset
      v-if="!isEdit"
      class="m-0 border-0 p-0"
    >
      <legend class="mb-1.5 text-sm font-semibold">
        Direction
      </legend>
      <UiSegmented
        v-model="form.direction"
        name="direction"
        :options="[{ value: 'outbound', label: 'Outbound · to the venue' }, { value: 'return', label: 'Return · back to warehouse' }]"
      />
    </fieldset>

    <UiField
      label="Truck"
      :error="errors.vehicle_id"
      help="Not listed? Add it under Logistics → Trucks."
    >
      <select
        v-model="form.vehicle_id"
        class="ctl"
      >
        <option :value="null">
          Not decided yet
        </option>
        <option
          v-for="v in vehicles"
          :key="v.id"
          :value="v.id"
        >
          {{ v.label }}{{ v.ownership === 'hired' ? ` · hired from ${v.hauler_name}` : '' }}
        </option>
      </select>
    </UiField>
    <UiField
      v-if="vehicle?.ownership === 'hired' && canSeeRates"
      label="Hire cost (₱)"
      optional
      :error="errors.hire_cost"
    >
      <input
        v-model="form.hire_cost"
        inputmode="decimal"
        class="ctl"
        placeholder="8,500"
      >
    </UiField>

    <fieldset class="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Driver
      </legend>
      <UiSegmented
        v-model="form.driverKind"
        name="driver-kind"
        :options="[{ value: 'crew', label: 'Our driver' }, { value: 'outside', label: 'Outside driver' }]"
      />
      <select
        v-if="form.driverKind === 'crew'"
        v-model="form.driver_personnel_id"
        class="ctl"
        aria-label="Which crew driver"
      >
        <option :value="null">
          Not decided yet
        </option>
        <option
          v-for="p in drivers"
          :key="p.id"
          :value="p.id"
        >
          {{ p.full_name }} · {{ p.usual_role_label }}
        </option>
      </select>
      <select
        v-else
        v-model="form.external_driver_id"
        class="ctl"
        aria-label="Which outside driver"
      >
        <option :value="null">
          Not decided yet
        </option>
        <option
          v-for="d in outsiders"
          :key="d.id"
          :value="d.id"
        >
          {{ d.name }}{{ d.company ? ` · ${d.company}` : '' }}{{ d.is_license_expired ? ' · license expired' : '' }}
        </option>
      </select>
      <p
        v-if="errors.driver"
        role="alert"
        class="err m-0"
      >
        {{ errors.driver }}
      </p>
      <span
        v-if="form.driverKind === 'outside'"
        class="help"
      >Outside drivers have no login. After saving, send them the trip link so they can share their location.</span>
    </fieldset>

    <fieldset
      v-if="crewOnEvent.length"
      class="m-0 border-0 p-0"
    >
      <legend class="mb-1.5 text-sm font-semibold">
        Helpers on the truck <span class="font-normal text-[#565B66]">(optional)</span>
      </legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="a in crewOnEvent"
          :key="a.personnel_id"
          type="button"
          :aria-pressed="form.helper_ids.includes(a.personnel_id)"
          class="min-h-[38px] cursor-pointer rounded-md border px-3 text-sm font-semibold"
          :class="form.helper_ids.includes(a.personnel_id) ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#B9BEC7] bg-white'"
          @click="toggleHelper(a.personnel_id)"
        >
          {{ a.name }}
        </button>
      </div>
    </fieldset>

    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Leaves at"
        optional
      >
        <input
          v-model="form.scheduled_at"
          type="datetime-local"
          class="ctl"
        >
      </UiField>
      <UiField
        v-if="!isEdit && warehouses.length > 1"
        label="Warehouse"
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
    </div>
    <UiField
      label="Notes"
      optional
    >
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. Load-in by the service gate, ask for Ramon"
      />
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
        :disabled="busy"
        @click="save"
      >
        {{ isEdit ? 'Save changes' : 'Plan trip' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
