<script setup lang="ts">
import type { MapPin, Row } from '~/types/api'

/**
 * Event page: the trucks for this event, the venue pin scans are checked against,
 * and where every piece that went out is now.
 */
const props = defineProps<{ event: Row }>()
const emit = defineEmits<{ changed: [] }>()

const api = useApi()
const geo = useGeo()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const recon = ref<Row | null>(null)
const showAll = ref(false)
const tripOpen = ref(false)
const pinOpen = ref(false)
const pin = reactive({ latitude: null as number | null, longitude: null as number | null, radius_m: 300 })
const busy = ref(false)
const editable = computed(() => can('logistics', 'edit'))

async function loadRecon() {
  try {
    recon.value = (await api.get<{ data: Row }>(`/events/${props.event.id}/reconciliation`)).data
  } catch {
    recon.value = null
  }
}
onMounted(loadRecon)
watch(() => props.event, loadRecon)

const warnings = computed(() => [
  ...(recon.value?.rows ?? []).filter((r: Row) => r.is_warning).map((r: Row) => ({ key: `i${r.item_id}`, code: r.code, name: r.name, label: r.state_label })),
  ...(recon.value?.rentals ?? []).filter((r: Row) => r.is_warning).map((r: Row) => ({ key: `r${r.id}`, code: 'Rented', name: r.label, label: 'Not returned to its owner' }))
])

const venuePins = computed<MapPin[]>(() => pin.latitude !== null && pin.longitude !== null ? [{ lat: pin.latitude, lng: pin.longitude, radius: pin.radius_m, color: '#2F5596', kind: 'place', label: props.event.venue_name }] : [])

function openPin() {
  const v = props.event.venue_pin
  Object.assign(pin, { latitude: v?.latitude ?? null, longitude: v?.longitude ?? null, radius_m: v?.radius_m ?? 300 })
  pinOpen.value = true
}

async function here() {
  const f = await geo.fix(10000)
  if (f.latitude === undefined) {
    notify('Couldn\'t get a GPS fix. Click the map instead.')
    return
  }
  pin.latitude = f.latitude
  pin.longitude = f.longitude!
}

async function savePin() {
  busy.value = true
  try {
    await api.put(`/events/${props.event.id}/venue`, { ...pin })
    pinOpen.value = false
    notify(`${props.event.venue_name} pinned. Scans here are now checked against it.`)
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

function onTrip(t: Row) {
  notify(`${t.code} planned.`)
  navigateTo(`/trips/${t.id}`)
}

const STATE_TONE: Record<string, Tone> = { back: TONES.green, repair: TONES.amber, on_truck: TONES.live, on_site: TONES.blueTint, missing: TONES.redTint, retired: TONES.grey, elsewhere: TONES.grey, never_arrived: TONES.redTint }
</script>

<template>
  <section
    aria-labelledby="logistics-h"
    class="card flex flex-col"
  >
    <div class="card-head">
      <h2
        id="logistics-h"
        class="h-section m-0"
      >
        Logistics <span class="text-[#565B66]">({{ event.trips.length }} {{ event.trips.length === 1 ? 'trip' : 'trips' }})</span>
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="editable"
          type="button"
          class="btn btn-secondary btn-sm"
          aria-haspopup="dialog"
          @click="openPin"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="size-4"
          />{{ event.venue_pin?.has_pin ? 'Venue pin' : 'Pin the venue' }}
        </button>
        <button
          v-if="editable && event.status !== 'cancelled'"
          type="button"
          class="btn btn-primary btn-sm"
          aria-haspopup="dialog"
          @click="tripOpen = true"
        >
          <UIcon
            name="i-lucide-truck"
            class="size-4"
          />Plan a trip
        </button>
      </div>
    </div>

    <p
      v-if="!event.venue_pin?.has_pin"
      class="m-0 border-b border-[#DADDE3] bg-[#FFF1D6] px-5 py-2.5 text-sm text-[#6B4100]"
    >
      The venue isn't pinned yet, so scans here can't be checked for location. It's pinned automatically when a truck marks Arrived, or pin it now.
    </p>

    <ul
      v-if="event.trips.length"
      class="m-0 flex list-none flex-col p-0"
    >
      <li
        v-for="t in event.trips"
        :key="t.id"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3 text-sm"
      >
        <span class="flex items-center gap-2.5">
          <NuxtLink
            :to="`/trips/${t.id}`"
            class="font-mono text-[15px] font-medium"
          >{{ t.code }}</NuxtLink>
          <UiBadge
            :tone="TRIP_DIRECTION[t.direction]!"
            :label="t.direction_label"
          />
        </span>
        <span class="min-w-[200px] flex-1">{{ t.vehicle?.name ?? 'Truck not set' }} · {{ t.driver?.name ?? 'driver not set' }}<span class="block text-[13px] text-[#565B66]">{{ t.on_board }} on board{{ t.last_position ? ` · seen ${minutesAgo(t.last_position.minutes_ago)}` : '' }}</span></span>
        <UiBadge
          :tone="TRIP_STATUS[t.status]!"
          :label="t.status_label"
        />
      </li>
    </ul>
    <p
      v-else
      class="m-0 px-5 py-4 text-sm text-[#565B66]"
    >
      No trips yet. Plan the outbound truck to load gear at the warehouse with GPS, and a return trip to bring it back.
    </p>

    <div
      v-if="recon"
      class="flex flex-col gap-3 border-t border-[#DADDE3] p-5"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="h-section m-0 text-base">
          Where everything is
        </h3>
        <UiBadge
          :tone="recon.is_balanced ? TONES.green : TONES.redTint"
          :label="recon.is_balanced ? 'All accounted for' : `${recon.counts.warnings} to check`"
        />
      </div>
      <div
        class="grid gap-2"
        style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))"
      >
        <div
          v-for="[l, v] in [['Went out', recon.counts.went_out], ['On site', recon.counts.on_site], ['On a truck', recon.counts.on_truck], ['Back', recon.counts.back], ['Lost / retired', recon.counts.removed], ['Rented returned', `${recon.counts.rentals_returned}/${recon.counts.rentals}`]]"
          :key="l"
          class="flex flex-col gap-0.5 rounded-md border border-[#DADDE3] p-2.5"
        >
          <span class="text-[13px] text-[#565B66]">{{ l }}</span>
          <span class="figure text-[24px]">{{ v }}</span>
        </div>
      </div>
      <ul
        v-if="warnings.length"
        class="m-0 flex list-none flex-col gap-1 p-0"
      >
        <li
          v-for="w in warnings"
          :key="w.key"
          class="text-sm text-[#8F0F15]"
        >
          <b class="font-mono">{{ w.code }}</b> · {{ w.name }} · {{ w.label }}
        </li>
      </ul>
      <button
        v-if="recon.rows.length"
        type="button"
        class="self-start border-0 bg-transparent p-0 text-sm font-semibold text-[#2F5596] underline"
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Hide the full list' : `Show all ${recon.rows.length} items` }}
      </button>
      <ul
        v-if="showAll"
        class="m-0 flex max-h-[360px] list-none flex-col overflow-y-auto p-0"
      >
        <li
          v-for="r in recon.rows"
          :key="r.item_id"
          class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] py-2 text-sm"
        >
          <span><NuxtLink
            :to="`/equipment/${r.code}`"
            class="font-mono"
          >{{ r.code }}</NuxtLink> · {{ r.name }}</span>
          <UiBadge
            :tone="STATE_TONE[r.state] ?? TONES.grey"
            :label="r.state_label"
          />
        </li>
      </ul>
    </div>

    <LogisticsTripPanel
      v-model:open="tripOpen"
      :event="event"
      @saved="onTrip"
    />

    <UiDialog
      v-model:open="pinOpen"
      title="Venue pin"
      :subtitle="`${event.venue_name}${event.city ? ' · ' + event.city : ''}`"
      icon="i-lucide-map-pin"
      :width="720"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-[#565B66]">Click the map to drop the pin, or stand at the venue and use your location.</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="here"
        >
          Use my location
        </button>
      </div>
      <UiMapView
        v-if="pinOpen"
        :pins="venuePins"
        :height="320"
        pickable
        label="Click to place the venue pin"
        @pick="(lat, lng) => { pin.latitude = lat; pin.longitude = lng }"
      />
      <UiField
        label="Fence radius (m)"
        help="Scans within this distance count as at the venue."
      >
        <input
          v-model.number="pin.radius_m"
          type="number"
          min="25"
          max="5000"
          step="25"
          class="ctl"
        >
      </UiField>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="pinOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy || pin.latitude === null"
          @click="savePin"
        >
          Save pin
        </button>
      </template>
    </UiDialog>
  </section>
</template>
