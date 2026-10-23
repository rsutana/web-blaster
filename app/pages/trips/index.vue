<script setup lang="ts">
import type { MapPath, MapPin, Row } from '~/types/api'

definePageMeta({ module: 'logistics', level: 'own', title: 'Logistics' })
useHead({ title: 'Logistics · Blaster Pro Audio' })

const api = useApi()
const { notify } = useNotify()
const { can } = useAuthUser()
const trips = ref<Row[]>([])
const loading = ref(true)
const scope = ref('active')
const panelOpen = ref(false)
const cancelling = ref<Row | null>(null)
const cancelOpen = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  trips.value = (await api.get<{ data: Row[] }>('/trips', scope.value === 'active' ? { scope: 'active', with_trail: 1 } : {})).data
  loading.value = false
}
onMounted(() => {
  load()
  // Office map refresh: trucks report every minute, so 30 s is plenty without a live socket.
  timer = setInterval(() => scope.value === 'active' && load(), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))
watch(scope, () => {
  loading.value = true
  load()
})

const counts = computed(() => ({
  road: trips.value.filter(t => t.status === 'in_transit').length,
  loading: trips.value.filter(t => t.status === 'loading').length,
  arrived: trips.value.filter(t => t.status === 'arrived').length,
  stale: trips.value.filter(t => t.last_position?.is_stale).length
}))

const pins = computed<MapPin[]>(() => {
  const out: MapPin[] = []
  for (const t of trips.value.filter(x => x.status !== 'closed' && x.status !== 'cancelled')) {
    if (t.last_position) {
      out.push({ lat: t.last_position.latitude, lng: t.last_position.longitude, kind: 'truck', color: TRIP_COLOR[t.status], label: `${t.code} · ${t.vehicle?.name ?? 'Truck'} · ${t.driver?.name ?? 'no driver'} · ${minutesAgo(t.last_position.minutes_ago)}`, to: `/trips/${t.id}` })
    }
    if (t.destination?.has_pin) {
      out.push({ lat: t.destination.latitude, lng: t.destination.longitude, kind: 'place', color: '#0B0B0C', label: `${t.destination.name} · ${t.code} destination` })
    }
  }
  return out
})

const paths = computed<MapPath[]>(() => tripTrails(trips.value))

function ago(t: Row): string {
  const p = t.last_position
  if (!p) {
    return t.status === 'in_transit' ? 'No location yet' : '—'
  }
  return minutesAgo(p.minutes_ago)
}

function askCancel(t: Row) {
  cancelling.value = t
  cancelOpen.value = true
}

async function onCancelled(t: Row) {
  notify(`${t.code} cancelled.`)
  await load()
}

async function onSaved(t: Row) {
  notify(`${t.code} planned for ${t.event.name}.`)
  await navigateTo(`/trips/${t.id}`)
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Logistics"
      subtitle="Every truck run: who's driving, what's on board, and where it is now."
    >
      <template #actions>
        <button
          v-if="can('logistics', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="panelOpen = true"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Plan a trip
        </button>
      </template>
    </UiPageHeader>
    <LogisticsNav />

    <section
      aria-label="Overview"
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
    >
      <UiStatCard
        variant="red"
        label="On the road"
        :value="counts.road"
        :loading="loading"
        :sub="counts.stale ? `${counts.stale} not reporting` : 'All reporting'"
      />
      <UiStatCard
        variant="blue"
        label="Arrived · unloading"
        :value="counts.arrived"
        :loading="loading"
      />
      <UiStatCard
        label="Loading"
        :value="counts.loading"
        :loading="loading"
        sub="Planned, not left yet"
      />
    </section>

    <section
      aria-labelledby="map-h"
      class="card flex flex-col"
    >
      <div class="card-head">
        <h2
          id="map-h"
          class="h-section m-0"
        >
          Where the trucks are
        </h2>
        <span class="text-[13px] text-[#565B66]">Updates every 30 s · last known position and route from the driver's phone</span>
      </div>
      <div class="p-4">
        <UiMapView
          :pins="pins"
          :paths="paths"
          :height="340"
          label="Map of trucks on active trips"
          :zoom="9"
        />
      </div>
    </section>

    <section
      aria-label="Trips"
      class="card flex flex-col"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="scope"
          :items="[{ key: 'active', label: 'Active' }, { key: 'all', label: 'All trips' }]"
          label="Filter trips"
        />
      </div>
      <UiSkeletonTable
        v-if="loading"
        :cols="8"
        :rows="4"
      />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 980px"
        >
          <thead>
            <tr>
              <th>Trip</th><th>Event</th><th>Truck</th><th>Driver</th><th>On board</th><th>Last seen</th><th>Status</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in trips"
              :key="t.id"
            >
              <td data-cell="title">
                <NuxtLink
                  :to="`/trips/${t.id}`"
                  class="font-mono text-[15px] font-medium"
                >{{ t.code }}</NuxtLink>
                <div class="mt-1">
                  <UiBadge
                    :tone="TRIP_DIRECTION[t.direction]!"
                    :label="t.direction_label"
                  />
                </div>
              </td>
              <td data-label="Event">
                <NuxtLink
                  :to="`/events/${t.event.id}`"
                  class="font-semibold text-[#0B0B0C]"
                >{{ t.event.label }}</NuxtLink>
                <div class="sub">
                  {{ t.origin?.name ?? '?' }} → {{ t.destination?.name ?? '?' }}
                </div>
              </td>
              <td data-label="Truck">
                {{ t.vehicle?.name ?? '—' }}<div class="sub">
                  {{ t.vehicle ? `${t.vehicle.plate_no}${t.vehicle.ownership === 'hired' ? ' · hired' : ''}` : 'Not decided' }}
                </div>
              </td>
              <td data-label="Driver">
                {{ t.driver?.name ?? '—' }}<div class="sub">
                  {{ t.driver ? (t.driver.kind === 'outside' ? `Outside${t.driver.company ? ' · ' + t.driver.company : ''}` : 'Crew') : '' }}
                </div>
              </td>
              <td data-label="On board">
                <span class="figure text-2xl">{{ t.on_board }}</span>
              </td>
              <td data-label="Last seen">
                <span :class="t.last_position?.is_stale ? 'font-semibold text-[#B4121A]' : ''">{{ ago(t) }}</span>
                <div
                  v-if="t.last_position?.speed_kmh"
                  class="sub"
                >
                  {{ t.last_position.speed_kmh }} km/h
                </div>
              </td>
              <td data-label="Status">
                <UiBadge
                  :tone="TRIP_STATUS[t.status]!"
                  :label="t.status_label"
                />
                <div
                  v-if="t.status === 'cancelled'"
                  class="sub text-[13px]"
                >
                  {{ t.cancel_note }}
                </div>
                <div
                  v-else-if="t.departed_at || t.scheduled_label"
                  class="sub text-[13px]"
                >
                  {{ t.departed_at ? `Left ${t.departed_at}` : `Leaves ${t.scheduled_label}` }}
                </div>
              </td>
              <td
                data-cell="actions"
                class="text-right"
              >
                <button
                  v-if="can('logistics', 'edit') && t.status === 'loading'"
                  type="button"
                  class="btn btn-red-text btn-sm"
                  aria-haspopup="dialog"
                  @click="askCancel(t)"
                >
                  Cancel
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !trips.length"
        :text="scope === 'active' ? 'No trips planned or on the road.' : 'No trips yet.'"
      />
    </section>

    <LogisticsTripPanel
      v-model:open="panelOpen"
      @saved="onSaved"
    />
    <LogisticsCancelTripModal
      v-if="cancelling"
      v-model:open="cancelOpen"
      :trip="cancelling"
      @cancelled="onCancelled"
    />
  </div>
</template>
