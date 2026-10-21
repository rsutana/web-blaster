<script setup lang="ts">
import type { MapPin, Row } from '~/types/api'

definePageMeta({ module: 'logistics', level: 'own', title: 'Trip' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const geo = useGeo()

const trip = ref<Row | null>(null)
const log = ref<Row[]>([])
const busy = ref(false)
const condition = ref('good')
const lastResult = ref<Row | null>(null)
const editOpen = ref(false)
const linkOpen = ref(false)
const closeOpen = ref(false)
const cancelOpen = ref(false)
const queue = useOfflineQueue((url, body) => api.post(url, body))
let timer: ReturnType<typeof setInterval> | undefined

useHead(() => ({ title: `${trip.value?.code ?? 'Trip'} · Blaster Pro Audio` }))

async function load() {
  const [t, m] = await Promise.all([
    api.get<{ data: Row }>(`/trips/${route.params.id}`),
    api.get<{ data: Row[] }>(`/trips/${route.params.id}/movements`)
  ])
  trip.value = t.data
  log.value = m.data
}
onMounted(() => {
  load().catch(fail)
  timer = setInterval(() => trip.value?.status === 'in_transit' && load(), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const canEdit = computed(() => can('logistics', 'edit'))
const done = computed(() => trip.value?.status === 'closed' || trip.value?.status === 'cancelled')
const outbound = computed(() => trip.value?.direction === 'outbound')
const mode = computed(() => trip.value?.can_load ? 'load' : trip.value?.can_unload ? 'unload' : null)
const placeAddress = (p: Row | null | undefined) => [p?.address, p?.city].filter(Boolean).join(', ')
const scanTitle = computed(() => mode.value === 'load' ? 'Load the truck' : outbound.value ? `Unload at ${trip.value?.destination?.name ?? 'the venue'}` : 'Check in at the warehouse')

const pins = computed<MapPin[]>(() => {
  const t = trip.value
  if (!t) {
    return []
  }
  const out: MapPin[] = []
  for (const [p, color, what] of [[t.origin, '#3B3F47', 'From'], [t.destination, '#0B0B0C', 'To']] as [Row | null, string, string][]) {
    if (p?.has_pin) {
      out.push({ lat: p.latitude, lng: p.longitude, radius: p.radius_m, color, kind: 'place', label: `${what}: ${p.name}` })
    }
  }
  if (t.departed_point) {
    out.push({ lat: t.departed_point.latitude, lng: t.departed_point.longitude, kind: 'point', color: '#1D6B3C', label: `Left ${t.departed_at}` })
  }
  if (t.arrived_point) {
    out.push({ lat: t.arrived_point.latitude, lng: t.arrived_point.longitude, kind: 'point', color: '#2F5596', label: `Arrived ${t.arrived_at}` })
  }
  if (t.last_position && !done.value) {
    out.push({ lat: t.last_position.latitude, lng: t.last_position.longitude, kind: 'truck', color: TRIP_COLOR[t.status], label: `${t.vehicle?.name ?? 'Truck'} · ${t.last_position.at}` })
  }
  return out
})
const path = computed<[number, number][]>(() => (trip.value?.route ?? []).map((p: [number, number, string]) => [p[0], p[1]]))

async function scan(codes: string[], rentalIds: number[] = []) {
  if (!mode.value) {
    return
  }
  busy.value = true
  try {
    const fix = await geo.fix()
    const res = await queue.run(`/trips/${trip.value!.id}/movements`, { action: mode.value, codes, rental_ids: rentalIds, condition: condition.value, gps: fix }) as { data: Row } | false
    if (res === false) {
      lastResult.value = { offline: true, codes }
      notify(`No signal. ${codes.join(', ') || 'Rented gear'} saved on this phone and will be sent when you're back online.`)
      return
    }
    const r = res.data
    lastResult.value = r
    trip.value = r.trip
    log.value = (await api.get<{ data: Row[] }>(`/trips/${trip.value!.id}/movements`)).data
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function checkpoint(kind: 'departure' | 'arrival' | 'closure') {
  busy.value = true
  try {
    const fix = kind === 'closure' ? null : await geo.fix()
    trip.value = (await api.post<{ data: Row }>(`/trips/${trip.value!.id}/${kind}`, fix ? { gps: fix } : {})).data
    closeOpen.value = false
    notify(kind === 'departure' ? `${trip.value.code} is on the road.` : kind === 'arrival' ? `${trip.value.code} arrived at ${trip.value.destination?.name ?? 'its stop'}.` : `${trip.value.code} closed.`)
    log.value = (await api.get<{ data: Row[] }>(`/trips/${trip.value.id}/movements`)).data
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function undoLoad(m: Row) {
  try {
    trip.value = (await api.del<{ data: Row }>(`/movements/${m.load_movement_id}`)).data
    notify(`${m.code} taken back off the truck.`)
  } catch (e) {
    fail(e)
  }
}

async function issueLink() {
  try {
    trip.value = (await api.post<{ data: Row }>(`/trips/${trip.value!.id}/driver-link`)).data
  } catch (e) {
    fail(e)
  }
}

async function revokeLink() {
  try {
    trip.value = (await api.del<{ data: Row }>(`/trips/${trip.value!.id}/driver-link`)).data
    notify('Trip link turned off.')
  } catch (e) {
    fail(e)
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(trip.value!.driver_link_url)
    notify('Link copied.')
  } catch {
    notify('Copy failed. Select the link and copy it by hand.')
  }
}

const smsHref = computed(() => {
  const t = trip.value
  if (!t?.driver_link_url || !t.driver?.mobile) {
    return null
  }
  return `sms:${t.driver.mobile}?body=${encodeURIComponent(`Blaster Pro Audio · ${t.code} for ${t.event.name}. Open this when you're driving so we can see the truck: ${t.driver_link_url}`)}`
})

const STATE: Record<string, { label: string, tone: Tone }> = {
  on_board: { label: 'On the truck', tone: TONES.live },
  unloaded: { label: 'Unloaded', tone: TONES.blueTint },
  checked_in: { label: 'Checked in', tone: TONES.green },
  not_loaded: { label: 'Not loaded', tone: TONES.white }
}
const dotFor = (a: string) => ({ loaded: '#C4141C', added_to_event: '#2F5596', unloaded: '#2F5596', checked_in: '#1D6B3C', returned_to_stock: '#1D6B3C' } as Record<string, string>)[a] ?? '#9AA0AB'

async function onCancelled(t: Row) {
  trip.value = t
  lastResult.value = null
  notify(`${t.code} cancelled.`)
  log.value = (await api.get<{ data: Row[] }>(`/trips/${t.id}/movements`)).data
}

function onSaved() {
  load()
  notify('Trip saved.')
}
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!trip"
      variant="detail"
      :stats="0"
    />
    <template v-else>
      <nav
        aria-label="Breadcrumb"
        class="text-sm"
      >
        <NuxtLink to="/trips">Logistics</NuxtLink> <span class="text-[#9AA0AB]">/</span> <span class="font-mono text-[#565B66]">{{ trip.code }}</span>
      </nav>

      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="h-page m-0 font-mono">
              {{ trip.code }}
            </h1>
            <UiBadge
              :tone="TRIP_DIRECTION[trip.direction]!"
              :label="trip.direction_label"
            />
            <UiBadge
              :tone="TRIP_STATUS[trip.status]!"
              :label="trip.status_label"
            />
          </div>
          <p class="m-0 text-[15px]">
            <NuxtLink
              :to="`/events/${trip.event.id}`"
              class="font-semibold"
            >{{ trip.event.label }}</NuxtLink> · {{ trip.event.dates }}
          </p>
          <p class="m-0 text-sm text-[#565B66]">
            {{ trip.origin?.name ?? '?' }} → {{ trip.destination?.name ?? '?' }}<template v-if="placeAddress(trip.destination)">
              ({{ placeAddress(trip.destination) }})
            </template><template v-if="trip.destination && !trip.destination.has_pin">
              · destination not pinned yet (pinned automatically when the truck arrives)
            </template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <button
            v-if="canEdit && !done"
            type="button"
            class="btn btn-secondary"
            aria-haspopup="dialog"
            @click="editOpen = true"
          >
            Edit
          </button>
          <button
            v-if="canEdit && !done"
            type="button"
            class="btn btn-secondary"
            aria-haspopup="dialog"
            @click="linkOpen = true"
          >
            <UIcon
              name="i-lucide-link"
              class="size-[18px]"
            />Driver link
          </button>
          <button
            v-if="canEdit && trip.status === 'loading'"
            type="button"
            class="btn btn-red-text"
            aria-haspopup="dialog"
            @click="cancelOpen = true"
          >
            Cancel trip
          </button>
          <button
            v-if="trip.status === 'loading'"
            type="button"
            class="btn btn-primary"
            :disabled="busy"
            @click="checkpoint('departure')"
          >
            <UIcon
              name="i-lucide-truck"
              class="size-[18px]"
            />Truck leaves
          </button>
          <button
            v-else-if="trip.status === 'in_transit'"
            type="button"
            class="btn btn-primary"
            :disabled="busy"
            @click="checkpoint('arrival')"
          >
            <UIcon
              name="i-lucide-map-pin-check"
              class="size-[18px]"
            />Arrived
          </button>
          <button
            v-else-if="trip.status === 'arrived'"
            type="button"
            class="btn btn-dark"
            :disabled="busy"
            aria-haspopup="dialog"
            @click="trip.counts.on_board ? closeOpen = true : checkpoint('closure')"
          >
            Close trip
          </button>
        </div>
      </header>

      <div
        v-if="trip.status === 'cancelled'"
        role="status"
        class="rounded-lg bg-[#0B0B0C] px-4 py-3.5 text-[15px] text-white"
      >
        <b>This trip was cancelled</b> · {{ trip.cancelled_at }} · by {{ trip.cancelled_by ?? 'Admin' }}. <span class="text-[#C9CCD2]">{{ trip.cancel_note }}</span>
      </div>

      <section
        aria-label="Trip details"
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
      >
        <div class="card flex flex-col gap-1 p-4">
          <span class="eyebrow text-[#565B66]">Truck</span>
          <span class="text-[17px] font-bold">{{ trip.vehicle?.name ?? 'Not decided' }}</span>
          <span class="text-sm text-[#565B66]">{{ trip.vehicle ? `${trip.vehicle.plate_no}${trip.vehicle.ownership === 'hired' ? ` · hired from ${trip.vehicle.hauler_name}` : ''}` : 'Pick one with Edit' }}</span>
          <span
            v-if="trip.hire_cost"
            class="text-sm"
          >Hire {{ peso(trip.hire_cost) }}</span>
        </div>
        <div class="card flex flex-col gap-1 p-4">
          <span class="eyebrow text-[#565B66]">Driver</span>
          <span class="text-[17px] font-bold">{{ trip.driver?.name ?? 'Not decided' }}</span>
          <span class="text-sm text-[#565B66]">{{ trip.driver ? (trip.driver.kind === 'outside' ? `Outside driver${trip.driver.company ? ' · ' + trip.driver.company : ''}` : 'Our crew') : '' }}</span>
          <a
            v-if="trip.driver?.mobile"
            :href="`tel:${trip.driver.mobile}`"
            class="text-sm font-semibold"
          >{{ phone(trip.driver.mobile) }}</a>
          <span
            v-if="trip.helpers.length"
            class="text-sm text-[#565B66]"
          >With {{ trip.helpers.map((h: Row) => h.name).join(', ') }}</span>
        </div>
        <div class="card flex flex-col gap-1 p-4">
          <span class="eyebrow text-[#565B66]">On the truck</span>
          <span class="figure text-[40px]">{{ trip.counts.on_board }}</span>
          <span class="text-sm text-[#565B66]">{{ trip.counts.unloaded }} {{ outbound ? 'unloaded' : 'checked in' }}<template v-if="!outbound"> · {{ trip.counts.expected_left }} still at the venue</template></span>
        </div>
        <div class="card flex flex-col gap-1 p-4">
          <span class="eyebrow text-[#565B66]">Times</span>
          <span class="text-sm">{{ trip.departed_at ? `Left ${trip.departed_at}` : trip.scheduled_label ? `Leaves ${trip.scheduled_label}` : 'Not left yet' }}</span>
          <span
            v-if="trip.arrived_at"
            class="text-sm"
          >Arrived {{ trip.arrived_at }}</span>
          <span
            v-if="trip.last_position"
            class="text-sm"
            :class="trip.last_position.is_stale ? 'font-semibold text-[#B4121A]' : 'text-[#565B66]'"
          >Last seen {{ trip.last_position.minutes_ago < 1 ? 'just now' : `${trip.last_position.minutes_ago} min ago` }}{{ trip.last_position.speed_kmh ? ` · ${trip.last_position.speed_kmh} km/h` : '' }}{{ trip.last_position.is_stale ? ' · not reporting' : '' }}</span>
        </div>
      </section>

      <section
        aria-labelledby="route-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="route-h"
            class="h-section m-0"
          >
            Route
          </h2>
          <span class="text-[13px] text-[#565B66]">{{ plural(trip.pings_count, 'location ping') }}<template v-if="trip.status === 'in_transit'"> · refreshes every 30 s</template></span>
        </div>
        <div class="p-4">
          <UiMapView
            :pins="pins"
            :path="path"
            :height="320"
            :label="`Map of ${trip.code}: start, destination and the truck's path`"
          />
        </div>
      </section>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr))"
      >
        <section
          v-if="mode"
          aria-labelledby="scan-h"
          class="card flex flex-col gap-3 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="scan-h"
              class="h-section m-0"
            >
              {{ scanTitle }}
            </h2>
            <span class="text-[13px] text-[#565B66]">{{ geo.label(geo.last.value) }}<template v-if="queue.pending.value"> · {{ queue.pending.value }} waiting for signal</template></span>
          </div>
          <p
            v-if="mode === 'unload' && outbound && placeAddress(trip.destination)"
            class="m-0 flex items-center gap-1.5 text-sm font-semibold"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="size-4 flex-none"
            />{{ placeAddress(trip.destination) }}
          </p>
          <p class="m-0 text-sm text-[#565B66]">
            {{ mode === 'load' ? 'Scan a case to load everything packed in it, or scan items one by one.' : outbound ? 'Each item scanned off the truck is added to the event.' : 'Each item scanned off the truck goes back to stock (or the repair shelf if damaged).' }}
          </p>
          <fieldset
            v-if="mode === 'unload'"
            class="m-0 border-0 p-0"
          >
            <legend class="mb-1.5 text-sm font-semibold">
              Condition
            </legend>
            <UiSegmented
              v-model="condition"
              name="unload-condition"
              size="sm"
              :options="[{ value: 'good', label: 'Good' }, { value: 'minor_wear', label: 'Minor wear' }, { value: 'damaged', label: 'Damaged' }]"
            />
          </fieldset>
          <LogisticsCodeScanner
            :busy="busy"
            @code="c => scan([c])"
          />
          <div
            v-if="lastResult"
            aria-live="polite"
            class="flex flex-col gap-1.5 rounded-md bg-[#F2F3F5] p-3 text-sm"
          >
            <span v-if="lastResult.offline">Saved offline: {{ lastResult.codes.join(', ') }}</span>
            <template v-else>
              <span v-if="(lastResult.loaded ?? lastResult.unloaded)?.length"><b class="text-[#1D6B3C]">{{ mode === 'load' ? 'Loaded' : 'Done' }}:</b> {{ (lastResult.loaded ?? lastResult.unloaded).join(', ') }}</span>
              <span
                v-for="b in lastResult.blocked"
                :key="b.code"
                class="text-[#B4121A]"
              ><b>{{ b.code }}</b> · {{ b.reason }}</span>
              <span
                v-for="s in lastResult.skipped"
                :key="s.code"
                class="text-[#565B66]"
              >{{ s.code }} · {{ s.reason }}</span>
            </template>
          </div>
        </section>

        <section
          v-if="!outbound && trip.expected.length"
          aria-labelledby="exp-h"
          class="card flex flex-col"
        >
          <div class="card-head">
            <h2
              id="exp-h"
              class="h-section m-0"
            >
              Still at the venue ({{ trip.expected.length }})
            </h2>
            <button
              v-if="trip.can_load"
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="busy"
              @click="scan(trip.expected.map((e: Row) => e.code))"
            >
              Load all
            </button>
          </div>
          <ul class="m-0 flex max-h-[360px] list-none flex-col overflow-y-auto p-0">
            <li
              v-for="e in trip.expected"
              :key="e.item_id"
              class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
            >
              <span><span class="font-mono">{{ e.code }}</span> · {{ e.name }}<span class="block text-[13px] text-[#565B66]">{{ e.status_label }}{{ e.case ? ` · in ${e.case}` : '' }}</span></span>
              <button
                v-if="trip.can_load"
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="busy"
                @click="scan([e.code])"
              >
                Load
              </button>
            </li>
          </ul>
        </section>

        <section
          v-if="trip.rentals.length"
          aria-labelledby="rent-h"
          class="card flex flex-col"
        >
          <div class="card-head">
            <h2
              id="rent-h"
              class="h-section m-0"
            >
              Rented gear
            </h2>
            <span class="text-[13px] text-[#565B66]">No QR · tick on and off by hand</span>
          </div>
          <ul class="m-0 flex list-none flex-col p-0">
            <li
              v-for="r in trip.rentals"
              :key="r.id"
              class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
            >
              <span class="font-semibold">{{ r.label }}</span>
              <span class="flex items-center gap-2">
                <UiBadge
                  :tone="STATE[r.state]!.tone"
                  :label="STATE[r.state]!.label"
                />
                <button
                  v-if="trip.can_load && r.state === 'not_loaded'"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="busy"
                  @click="scan([], [r.id])"
                >Load</button>
                <button
                  v-if="trip.can_unload && r.state === 'on_board'"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="busy"
                  @click="scan([], [r.id])"
                >Unload</button>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section
        aria-labelledby="man-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="man-h"
            class="h-section m-0"
          >
            On this trip ({{ trip.manifest.length }})
          </h2>
          <span
            v-if="trip.containers.length"
            class="text-[13px] text-[#565B66]"
          >Cases: {{ trip.containers.map((c: Row) => c.code).join(', ') }}</span>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 760px"
          >
            <thead>
              <tr>
                <th>ID</th><th>Item</th><th>Loaded</th><th>Status</th><th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in trip.manifest"
                :key="m.item_id"
              >
                <td data-cell="title">
                  <NuxtLink
                    :to="`/equipment/${m.code}`"
                    class="font-mono text-[15px] font-medium"
                  >{{ m.code }}</NuxtLink>
                </td>
                <td data-label="Item">
                  <span class="font-semibold">{{ m.name }}</span><div class="sub text-[13px]">
                    {{ m.category_label }}{{ m.via_case ? ` · via ${m.via_case}` : '' }}
                  </div>
                </td>
                <td data-label="Loaded">
                  {{ m.loaded_at ?? '—' }}<div class="sub text-[13px]">
                    {{ m.loaded_by }}
                  </div>
                </td>
                <td data-label="Status">
                  <UiBadge
                    :tone="STATE[m.state]!.tone"
                    :label="STATE[m.state]!.label"
                  />
                  <div
                    v-if="m.is_off_site"
                    class="mt-1 text-[13px] font-semibold text-[#B4121A]"
                  >
                    Scanned away from the expected place
                  </div>
                </td>
                <td
                  data-cell="actions"
                  class="text-right"
                >
                  <button
                    v-if="trip.can_load && m.state === 'on_board' && m.load_movement_id"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    @click="undoLoad(m)"
                  >
                    Take off
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-if="!trip.manifest.length"
          :text="trip.can_load ? 'Nothing loaded yet. Scan cases or items above.' : 'Nothing was loaded on this trip.'"
        />
      </section>

      <section
        aria-labelledby="log-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="log-h"
            class="h-section m-0"
          >
            Movement log
          </h2>
          <span class="text-[13px] text-[#565B66]">Every scan with who, when and where</span>
        </div>
        <ol class="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto px-5 py-2">
          <li
            v-for="m in log"
            :key="m.id"
            class="flex gap-3 border-b border-[#EEF0F2] py-2.5 text-sm"
          >
            <span
              aria-hidden="true"
              class="mt-1.5 size-2.5 flex-none rounded-full"
              :style="{ background: dotFor(m.action) }"
            />
            <div class="min-w-0 flex-1">
              <b>{{ m.subject?.code ?? m.subject?.name ?? '—' }}</b> {{ m.action_label.toLowerCase() }}<template v-if="m.via_case">
                (via {{ m.via_case }})
              </template> · {{ m.actor }}
              <div class="text-[13px] text-[#565B66]">
                {{ m.at }} · {{ m.place_label ?? 'no place' }} · {{ m.gps_label }}<span
                  v-if="m.is_off_site"
                  class="font-semibold text-[#B4121A]"
                > · {{ m.distance_m ? `${(m.distance_m / 1000).toFixed(1)} km` : '' }} off site</span>
              </div>
            </div>
          </li>
          <li
            v-if="!log.length"
            class="py-4 text-sm text-[#565B66]"
          >
            Nothing scanned yet.
          </li>
        </ol>
      </section>

      <LogisticsTripPanel
        v-model:open="editOpen"
        :trip="trip"
        @saved="onSaved"
      />

      <UiDialog
        v-model:open="linkOpen"
        title="Driver link"
        :subtitle="trip.driver?.kind === 'outside' ? `For ${trip.driver.name}, who has no login` : 'For a driver without the app'"
        icon="i-lucide-link"
      >
        <p class="m-0 text-sm">
          The driver opens this on their phone. It shows the trip, lets them tap <b>Leaving</b> and <b>Arrived</b>, and shares their location while it's open. No sign-in. It stops working when the trip closes.
        </p>
        <template v-if="trip.driver_link_url">
          <output class="block rounded-md bg-[#0B0B0C] px-3 py-2.5 font-mono text-[13px] break-all text-white">{{ trip.driver_link_url }}</output>
          <span class="help">Works until {{ trip.driver_link_expires }}.</span>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              @click="copyLink"
            >
              Copy link
            </button>
            <a
              v-if="smsHref"
              :href="smsHref"
              class="btn btn-secondary btn-sm"
            >Text it to {{ trip.driver?.name }}</a>
            <button
              type="button"
              class="btn btn-red-text btn-sm"
              @click="revokeLink"
            >
              Turn off
            </button>
          </div>
        </template>
        <button
          v-else
          type="button"
          class="btn btn-primary self-start"
          @click="issueLink"
        >
          Create link
        </button>
      </UiDialog>

      <LogisticsCancelTripModal
        v-model:open="cancelOpen"
        :trip="trip"
        @cancelled="onCancelled"
      />

      <UiDialog
        v-model:open="closeOpen"
        title="Close with gear still aboard?"
        tone="red"
      >
        <p class="m-0 text-[15px]">
          {{ plural(trip.counts.on_board, 'item is', 'items are') }} still marked as on the truck. Closing keeps them flagged on the truck so the event's reconciliation shows them.
        </p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            @click="closeOpen = false"
          >
            Keep unloading
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="busy"
            @click="checkpoint('closure')"
          >
            Close anyway
          </button>
        </template>
      </UiDialog>
    </template>
  </div>
</template>
