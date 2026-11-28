<script setup lang="ts">
import { getLocalTimeZone, parseDate, parseTime, today, type CalendarDateTime, type DateValue, type Time, type ZonedDateTime } from '@internationalized/date'
import type { SelectMenuItem } from '@nuxt/ui'
import type { Row } from '~/types/api'

/**
 * `preset` fills a new trip from a truck's standing crew, e.g. when planned from Cargo.
 * `vehicleType` narrows the truck picker to one type, e.g. a truck the booked package asks for.
 */
const props = defineProps<{ event?: Row | null, trip?: Row | null, preset?: { vehicle_id: number, driver_personnel_id: number | null, helper_ids: number[] } | null, vehicleType?: string | null }>()
const emit = defineEmits<{ saved: [trip: Row, isNew: boolean] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const { canSeeRates } = useAuthUser()

const events = ref<Row[]>([])
/** Every event, for picking where a transfer goes. */
const allEvents = ref<Row[]>([])
const vehicles = ref<Row[]>([])
const outsiders = ref<Row[]>([])
const people = ref<Row[]>([])
const warehouses = ref<Row[]>([])
const crewOnEvent = ref<Row[]>([])
/** Open trips each driver is already on, keyed `crew:id` / `outside:id`, as short notes for the picker. */
const busyDrivers = ref(new Map<string, string[]>())
/** Drivers out with another truck right now: shown, but can't be picked. */
const onRoad = ref(new Set<string>())
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const blank = () => ({ event_id: null as number | null, direction: 'outbound', vehicle_id: null as number | null, driverKind: 'crew', driver_personnel_id: null as number | null, external_driver_id: null as number | null, helper_ids: [] as number[], warehouse_id: null as number | null, to_event_id: null as number | null, scheduled_at: '', hire_cost: '', notes: '' })
const form = reactive(blank())
const isEdit = computed(() => !!props.trip)
/** The driver already on the trip being edited stays pickable even if they've since gone out on another run. */
const initialDriver = computed(() => ({
  crew: props.trip?.driver?.kind === 'crew' ? props.trip.driver.id as number : null,
  outside: props.trip?.driver?.kind === 'outside' ? props.trip.driver.id as number : null
}))
const vehicle = computed(() => vehicles.value.find(v => v.id === form.vehicle_id) ?? null)
/** Opened for one truck type: list only that type, until "Show every truck". */
const typeOnly = ref(true)
const isTypeFiltered = computed(() => !isEdit.value && !!props.vehicleType && typeOnly.value)
const isTypeMatch = (v: Row) => v.type === props.vehicleType
const typeMatches = computed(() => vehicles.value.filter(isTypeMatch).length)
const typeLabel = computed(() => {
  const t = props.vehicleType ?? ''
  return vehicles.value.find(isTypeMatch)?.type_label ?? t.charAt(0).toUpperCase() + t.slice(1)
})
/** Truck picker items: our own fleet first, then hired trucks with their hauler. */
const truckOptions = computed<SelectMenuItem[][]>(() => {
  const item = (v: Row) => ({
    label: v.label,
    value: v.id as number,
    icon: 'i-lucide-truck',
    description: [v.type_label, v.ownership === 'hired' ? `hired from ${v.hauler_name}` : null, v.capacity_note].filter(Boolean).join(' · ')
  })
  const shown = isTypeFiltered.value ? vehicles.value.filter(v => isTypeMatch(v) || v.id === form.vehicle_id) : vehicles.value
  const groups = [
    [{ type: 'label' as const, label: 'Our trucks' }, ...shown.filter(v => v.ownership !== 'hired').map(item)],
    [{ type: 'label' as const, label: 'Hired trucks' }, ...shown.filter(v => v.ownership === 'hired').map(item)]
  ]
  return groups.filter(g => g.length > 1)
})
const busyNotes = (key: string) => busyDrivers.value.get(key) ?? []
const tripNote = (x: Row) => x.status === 'in_transit' ? `on the road (${x.code})` : x.status === 'arrived' ? `${x.code} unloading` : x.scheduled_label ? `${x.code} leaves ${x.scheduled_label}` : `${x.code} loading`
const lockedOut = (key: string, current: number | null, id: number) => onRoad.value.has(key) && id !== current
const drivers = computed(() => people.value
  .filter(p => p.usual_role === 'driver' || p.id === form.driver_personnel_id)
  .sort((a, b) => a.full_name.localeCompare(b.full_name)))
/** Driver picker items: busy drivers show their other trips; anyone out on the road can't be picked. */
const crewDriverOptions = computed<SelectMenuItem[]>(() => drivers.value.map((p) => {
  const key = `crew:${p.id}`
  const notes = busyNotes(key)
  return {
    label: p.full_name,
    value: p.id as number,
    icon: notes.length ? 'i-lucide-clock-alert' : 'i-lucide-user-round',
    description: [p.usual_role_label, ...notes].filter(Boolean).join(' · '),
    disabled: lockedOut(key, initialDriver.value.crew, p.id)
  }
}))
const outsideDriverOptions = computed<SelectMenuItem[]>(() => outsiders.value.map((d) => {
  const key = `outside:${d.id}`
  const notes = busyNotes(key)
  return {
    label: d.name,
    value: d.id as number,
    icon: d.is_license_expired ? 'i-lucide-triangle-alert' : notes.length ? 'i-lucide-clock-alert' : 'i-lucide-id-card',
    description: [d.company, d.is_license_expired ? 'license expired' : null, ...notes].filter(Boolean).join(' · '),
    disabled: lockedOut(key, initialDriver.value.outside, d.id)
  }
}))

/** "Leaves at" is edited as a date plus a time; `form.scheduled_at` stays `YYYY-MM-DDTHH:mm` for the API. */
type TimeValue = Time | CalendarDateTime | ZonedDateTime
const pad = (n: number) => String(n).padStart(2, '0')
const DEFAULT_LEAVE_TIME = '08:00'
const leaveDate = computed<DateValue | undefined>({
  get: () => {
    try {
      return form.scheduled_at ? parseDate(form.scheduled_at.slice(0, 10)) : undefined
    } catch {
      return undefined
    }
  },
  set: (d) => {
    form.scheduled_at = d ? `${d.year}-${pad(d.month)}-${pad(d.day)}T${form.scheduled_at.slice(11, 16) || DEFAULT_LEAVE_TIME}` : ''
  }
})
const leaveTime = computed<TimeValue | undefined>({
  get: () => {
    try {
      return form.scheduled_at.length >= 16 ? parseTime(form.scheduled_at.slice(11, 16)) : undefined
    } catch {
      return undefined
    }
  },
  set: (t) => {
    const day = form.scheduled_at.slice(0, 10) || today(getLocalTimeZone()).toString()
    form.scheduled_at = `${day}T${t ? `${pad(t.hour)}:${pad(t.minute)}` : DEFAULT_LEAVE_TIME}`
  }
})

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  typeOnly.value = true
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
    form.direction = props.vehicleType || !['completed'].includes(props.event.status) ? 'outbound' : 'return'
  }
  if (!t && props.preset) {
    Object.assign(form, { vehicle_id: props.preset.vehicle_id, driverKind: 'crew', driver_personnel_id: props.preset.driver_personnel_id, helper_ids: [...props.preset.helper_ids] })
  }
  const [v1, d1, p1, w1, e1, t1] = await Promise.all([
    api.get<{ data: Row[] }>('/vehicles'),
    api.get<{ data: Row[] }>('/external-drivers'),
    api.get<{ data: Row[] }>('/personnel').catch(() => ({ data: [] })),
    api.get<{ data: Row[] }>('/locations', { type: 'warehouse' }),
    props.trip ? Promise.resolve({ data: [] as Row[] }) : api.get<{ data: Row[] }>('/events'),
    api.get<{ data: Row[] }>('/trips', { scope: 'active' }).catch(() => ({ data: [] as Row[] }))
  ])
  const busyMap = new Map<string, string[]>()
  for (const x of t1.data.filter(x => x.driver && x.id !== t?.id)) {
    const key = `${x.driver.kind}:${x.driver.id}`
    busyMap.set(key, [...(busyMap.get(key) ?? []), tripNote(x)])
  }
  busyDrivers.value = busyMap
  onRoad.value = new Set(t1.data.filter(x => x.driver && x.id !== t?.id && x.status === 'in_transit').map(x => `${x.driver.kind}:${x.driver.id}`))
  vehicles.value = v1.data.filter(x => x.is_active || x.id === form.vehicle_id)
  outsiders.value = d1.data.filter(x => x.is_active || x.id === form.external_driver_id)
  people.value = p1.data.filter(x => x.status === 'active' || x.id === form.driver_personnel_id)
  warehouses.value = w1.data.filter(x => x.is_active)
  allEvents.value = e1.data
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

/** Direction cards: each keeps the colour of its badge on the trip lists. */
const DIRECTIONS = [
  { value: 'outbound', label: 'Outbound', hint: 'Warehouse → venue', icon: 'i-lucide-move-up-right', color: '#2F5596', tint: '#E8EEF8' },
  { value: 'return', label: 'Return', hint: 'Venue → warehouse', icon: 'i-lucide-undo-2', color: '#0B0B0C', tint: '#EEF0F2' },
  { value: 'transfer', label: 'Transfer', hint: 'Event → next event', icon: 'i-lucide-arrow-left-right', color: '#9A6200', tint: '#FFF1D6' }
] as const

/** Open events gear can be moved on to, not the one it's leaving. */
const transferTargets = computed(() => allEvents.value.filter(e => e.status === 'confirmed' && e.id !== form.event_id))

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
      const transfer = form.direction === 'transfer'
      if (transfer && !form.to_event_id) {
        errors.value = { to_event_id: 'Pick the event the gear is going to.' }
        return
      }
      res = await api.post<{ data: Row }>(`/events/${form.event_id}/trips`, {
        ...body,
        direction: form.direction,
        ...(transfer ? { to_event_id: form.to_event_id } : { warehouse_id: form.warehouse_id })
      })
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
    :subtitle="isEdit ? trip!.event.label : (event ? `${event.label} · ${event.short_dates ?? ''}` : 'A truck run to, from or between events.')"
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
      <div class="grid grid-cols-3 gap-2">
        <label
          v-for="d in DIRECTIONS"
          :key="d.value"
          class="flex min-h-[104px] cursor-pointer flex-col gap-1.5 rounded-md border-2 p-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#2F5596]"
          :style="form.direction === d.value ? { borderColor: d.color, background: d.tint } : { borderColor: '#DADDE3', background: '#FFFFFF' }"
        >
          <input
            v-model="form.direction"
            type="radio"
            name="direction"
            :value="d.value"
            class="sr-only"
          >
          <span
            aria-hidden="true"
            class="flex size-8 items-center justify-center rounded-md"
            :style="{ background: form.direction === d.value ? d.color : d.tint, color: form.direction === d.value ? '#FFFFFF' : d.color }"
          >
            <UIcon
              :name="d.icon"
              class="size-[18px]"
            />
          </span>
          <b
            class="text-[15px] leading-tight"
            :style="form.direction === d.value ? { color: d.color } : undefined"
          >{{ d.label }}</b>
          <span class="text-xs leading-snug text-[#565B66]">{{ d.hint }}</span>
        </label>
      </div>
    </fieldset>

    <UiField
      v-if="!isEdit && form.direction === 'transfer'"
      label="To event *"
      :error="errors.to_event_id"
      help="Gear is loaded at this event's venue and unloaded at the next one, without a stop at the warehouse."
    >
      <select
        v-model="form.to_event_id"
        class="ctl"
      >
        <option :value="null">
          Pick the next event
        </option>
        <option
          v-for="e in transferTargets"
          :key="e.id"
          :value="e.id"
        >
          {{ e.label }} · {{ e.dates_label }}
        </option>
      </select>
    </UiField>

    <div
      v-if="vehicleType && !isEdit"
      class="-mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#E6ECF6] px-3 py-2 text-sm text-[#244677]"
      aria-live="polite"
    >
      <span class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-truck"
          class="size-4 flex-none"
        />
        <template v-if="typeOnly">Booked package asks for a <b>{{ typeLabel }}</b> · showing {{ typeLabel }} only ({{ typeMatches }})</template>
        <template v-else>Booked package asks for a <b>{{ typeLabel }}</b> · showing every truck</template>
      </span>
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-[#244677] underline"
        @click="typeOnly = !typeOnly"
      >
        {{ typeOnly ? 'Show every truck' : `Only ${typeLabel}` }}
      </button>
    </div>
    <UiField
      label="Truck"
      :error="errors.vehicle_id"
      help="Not listed? Add it under Logistics → Trucks."
    >
      <USelectMenu
        v-model="form.vehicle_id"
        :items="truckOptions"
        value-key="value"
        :filter-fields="['label', 'description']"
        :search-input="{ placeholder: 'Search trucks…', icon: 'i-lucide-search' }"
        icon="i-lucide-truck"
        :placeholder="isTypeFiltered ? `Pick a ${typeLabel}` : 'Not decided yet'"
        :clear="{ 'aria-label': 'Clear truck' }"
        size="lg"
        class="w-full"
        :content="{ align: 'start' }"
        :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
        aria-label="Truck"
      >
        <template #empty>
          {{ isTypeFiltered ? `No ${typeLabel} in the fleet. Show every truck, or add one under Logistics → Trucks.` : 'No trucks match. Add one under Logistics → Trucks.' }}
        </template>
      </USelectMenu>
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
      <USelectMenu
        v-if="form.driverKind === 'crew'"
        v-model="form.driver_personnel_id"
        :items="crewDriverOptions"
        value-key="value"
        :filter-fields="['label', 'description']"
        :search-input="{ placeholder: 'Search drivers…', icon: 'i-lucide-search' }"
        icon="i-lucide-user-round"
        placeholder="Not decided yet"
        :clear="{ 'aria-label': 'Clear driver' }"
        size="lg"
        class="w-full"
        :content="{ align: 'start' }"
        :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
        aria-label="Which crew driver"
      >
        <template #empty>
          No crew drivers match. Set someone's usual role to Driver under Personnel.
        </template>
      </USelectMenu>
      <USelectMenu
        v-else
        v-model="form.external_driver_id"
        :items="outsideDriverOptions"
        value-key="value"
        :filter-fields="['label', 'description']"
        :search-input="{ placeholder: 'Search outside drivers…', icon: 'i-lucide-search' }"
        icon="i-lucide-id-card"
        placeholder="Not decided yet"
        :clear="{ 'aria-label': 'Clear driver' }"
        size="lg"
        class="w-full"
        :content="{ align: 'start' }"
        :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
        aria-label="Which outside driver"
      >
        <template #empty>
          No outside drivers match. Add one under Logistics → Drivers.
        </template>
      </USelectMenu>
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

    <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Leaves at <span class="font-normal text-[#565B66]">(optional)</span>
      </legend>
      <div class="flex flex-wrap gap-2">
        <UInputDate
          v-model="leaveDate"
          size="lg"
          class="min-w-0 flex-1 basis-40"
          aria-label="Leave date"
        >
          <template #trailing>
            <UPopover :content="{ align: 'end', sideOffset: 6 }">
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-calendar"
                aria-label="Pick the leave date"
                class="px-0"
              />
              <template #content>
                <UCalendar
                  v-model="leaveDate"
                  fixed-weeks
                  class="p-2"
                />
              </template>
            </UPopover>
          </template>
        </UInputDate>
        <UInputTime
          v-model="leaveTime"
          size="lg"
          :hour-cycle="12"
          icon="i-lucide-clock"
          class="w-36"
          aria-label="Leave time"
        />
        <UButton
          v-if="form.scheduled_at"
          color="neutral"
          variant="ghost"
          size="lg"
          icon="i-lucide-x"
          aria-label="Clear leave time"
          @click="form.scheduled_at = ''"
        />
      </div>
    </fieldset>

    <div
      v-if="!isEdit && form.direction !== 'transfer' && warehouses.length > 1"
      class="grid grid-cols-2 gap-3"
    >
      <UiField
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
