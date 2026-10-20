<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * The driver's phone screen. Works for a signed-in crew driver and for an outside driver on a trip link;
 * the page passes in how to reach the API.
 */
interface Ping {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
  recorded_at: string
}

const props = defineProps<{
  trip: Row
  storageKey: string
  send: (path: '' | 'departure' | 'arrival' | 'pings', body?: Record<string, unknown>) => Promise<Row>
}>()
const emit = defineEmits<{ update: [trip: Row] }>()

const geo = useGeo()
const sharing = ref(false)
const denied = ref(false)
const busy = ref(false)
const error = ref('')
const lastSent = ref<string | null>(null)
const pending = ref<Ping[]>([])
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const EVERY_MS = 60_000
const EVERY_M = 200
let stopWatch: (() => void) | null = null
let release: (() => void) | null = null
let timer: ReturnType<typeof setInterval> | undefined
let lastQueued: { at: number, point: [number, number] } | null = null

const KEY = computed(() => `bpa.pings.${props.storageKey}`)

function persist() {
  try {
    localStorage.setItem(KEY.value, JSON.stringify(pending.value))
  } catch {
    // Storage blocked: pings stay in memory only.
  }
}

function restore() {
  try {
    pending.value = JSON.parse(localStorage.getItem(KEY.value) ?? '[]') as Ping[]
  } catch {
    pending.value = []
  }
}

async function flush() {
  if (!pending.value.length || !navigator.onLine) {
    return
  }
  const batch = pending.value.slice(0, 500)
  try {
    const t = await props.send('pings', { pings: batch })
    pending.value = pending.value.slice(batch.length)
    persist()
    lastSent.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    emit('update', t)
  } catch {
    // Kept for the next try.
  }
}

function start() {
  if (sharing.value) {
    return
  }
  sharing.value = true
  denied.value = false
  stopWatch = geo.watch((f, p) => {
    const point: [number, number] = [f.latitude!, f.longitude!]
    const due = !lastQueued || Date.now() - lastQueued.at >= EVERY_MS || distanceM(lastQueued.point, point) >= EVERY_M
    if (!due) {
      return
    }
    lastQueued = { at: Date.now(), point }
    pending.value = [...pending.value, { latitude: point[0], longitude: point[1], accuracy: f.accuracy, speed: p.coords.speed, heading: p.coords.heading, recorded_at: f.captured_at! }]
    persist()
    flush()
  }, (isDenied) => {
    denied.value = isDenied
    if (isDenied) {
      stop()
    }
  })
  geo.keepAwake().then((r) => {
    release = r
  })
  timer = setInterval(flush, EVERY_MS)
}

function stop() {
  sharing.value = false
  stopWatch?.()
  stopWatch = null
  release?.()
  release = null
  clearInterval(timer)
}

async function checkpoint(kind: 'departure' | 'arrival') {
  busy.value = true
  error.value = ''
  try {
    const fix = await geo.fix()
    const t = await props.send(kind, { gps: fix })
    emit('update', t)
    if (kind === 'departure') {
      start()
    } else {
      await flush()
      stop()
    }
  } catch (e) {
    error.value = errorMessage(e, 'Couldn\'t reach the office. Check your signal and try again.')
  } finally {
    busy.value = false
  }
}

function onOnline() {
  online.value = true
  flush()
}
function onOffline() {
  online.value = false
}

onMounted(() => {
  restore()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  if (props.trip.status === 'in_transit') {
    start()
  }
  flush()
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})

const dest = computed(() => props.trip.destination)
const directions = computed(() => dest.value?.has_pin ? `https://www.google.com/maps/dir/?api=1&destination=${dest.value.latitude},${dest.value.longitude}` : dest.value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([dest.value.name, props.trip.event?.address].filter(Boolean).join(', '))}` : null)
</script>

<template>
  <main class="flex flex-col gap-3 p-4">
    <section class="card flex flex-col gap-2.5 p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono text-sm text-[#565B66]">{{ trip.code }}</span>
        <UiBadge
          :tone="TRIP_STATUS[trip.status]!"
          :label="trip.status_label"
        />
      </div>
      <h2 class="font-display m-0 text-[26px] leading-none font-extrabold uppercase">
        {{ trip.direction === 'outbound' ? 'To' : 'Back to' }} {{ dest?.name ?? 'the destination' }}
      </h2>
      <p class="m-0 text-[15px]">
        {{ trip.event.name }} · {{ trip.event.dates }}
      </p>
      <p class="m-0 text-sm text-[#565B66]">
        {{ trip.vehicle ? `${trip.vehicle.name} · ${trip.vehicle.plate_no}` : 'Truck not set' }} · {{ trip.on_board }} {{ trip.on_board === 1 ? 'item' : 'items' }} on board
      </p>
      <a
        v-if="directions"
        :href="directions"
        target="_blank"
        rel="noopener"
        class="btn btn-secondary btn-phone"
      >
        <UIcon
          name="i-lucide-navigation"
          class="size-5"
        />Directions
      </a>
    </section>

    <button
      v-if="trip.status === 'loading'"
      type="button"
      class="btn btn-primary btn-phone btn-block"
      :disabled="busy"
      @click="checkpoint('departure')"
    >
      <UIcon
        name="i-lucide-truck"
        class="size-5"
      />{{ busy ? 'Sending…' : 'Leaving now' }}
    </button>
    <button
      v-else-if="trip.status === 'in_transit'"
      type="button"
      class="btn btn-dark btn-phone btn-block"
      :disabled="busy"
      @click="checkpoint('arrival')"
    >
      <UIcon
        name="i-lucide-map-pin-check"
        class="size-5"
      />{{ busy ? 'Sending…' : 'Arrived' }}
    </button>
    <p
      v-if="error"
      role="alert"
      class="err m-0"
    >
      {{ error }}
    </p>

    <section
      class="flex flex-col gap-1.5 rounded-lg p-4"
      :class="sharing ? 'bg-[#0B0B0C] text-white' : 'border border-[#DADDE3] bg-white'"
      aria-live="polite"
    >
      <div class="flex items-center gap-2 font-bold">
        <span
          aria-hidden="true"
          class="size-2.5 rounded-full"
          :class="sharing ? 'animate-pulse bg-[#ED1B24]' : 'bg-[#9AA0AB]'"
        />{{ sharing ? 'Sharing your location' : 'Location not shared' }}
      </div>
      <p
        class="m-0 text-sm"
        :class="sharing ? 'text-[#C9CCD2]' : 'text-[#565B66]'"
      >
        <template v-if="denied">
          Location is turned off for this site. Turn it on in your browser settings so the office can see the truck.
        </template>
        <template v-else-if="sharing">
          Keep this screen open while driving. {{ lastSent ? `Last sent ${lastSent}.` : 'Sending the first update…' }}<template v-if="pending.length">
            {{ online ? `${pending.length} waiting to send.` : `No signal · ${pending.length} saved, will send when you're back online.` }}
          </template>
        </template>
        <template v-else-if="trip.status === 'arrived' || trip.status === 'closed'">
          Trip finished. Thanks for driving.
        </template>
        <template v-else>
          Starts when you tap Leaving now.
        </template>
      </p>
      <button
        v-if="trip.status === 'in_transit' && !sharing"
        type="button"
        class="btn btn-secondary btn-sm self-start"
        @click="start"
      >
        Share location
      </button>
    </section>
  </main>
</template>
