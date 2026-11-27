<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', module: 'track', level: 'own', title: 'Scan equipment' })
useHead({ title: 'Scan equipment · Blaster Pro Audio' })

const api = useApi()
const route = useRoute()
const { notify, success, fail } = useNotify()
const { user, isCrew, can } = useAuthUser()
const geo = useGeo()
const queue = useOfflineQueue((url, body) => api.post(url, body))
const caseResult = ref<Row | null>(null)

type Phase = 'ready' | 'scanned' | 'blocked' | 'removed' | 'case' | 'case_added'
type Mode = 'add' | 'remove' | 'load' | 'unload'
const events = ref<Row[]>([])
const eventId = ref<number | null>(null)
const mode = ref<Mode>('add')
const trips = ref<Row[]>([])
const tripId = ref<number | null>(null)
const truckResult = ref<Row | null>(null)
const truckSession = ref<Row[]>([])
let lastCode = ''
let lastAt = 0
const phase = ref<Phase>('ready')
const item = ref<Row | null>(null)
const condition = ref('good')
const note = ref('')
const lastUsage = ref<Row | null>(null)
const block = ref<Row | null>(null)
const session = ref<Row[]>([])
const removedSession = ref<Row[]>([])
const onEvent = ref<Row[]>([])
const onEventLoading = ref(false)
const manual = ref('')
const cameraError = ref('')
const busy = ref(false)
const removeOpen = ref(false)

const event = computed(() => events.value.find(e => e.id === eventId.value) ?? null)
const canTruck = computed(() => can('logistics', 'own'))
const truckMode = computed(() => mode.value === 'load' || mode.value === 'unload')
/** Each mode keeps its own colour and icon so a glance at the header says what a scan will do. */
const modes = computed(() => [
  { value: 'add' as Mode, label: 'Add to event', hint: 'Gear going into use', icon: 'i-lucide-circle-plus', color: '#3FB56B' },
  { value: 'remove' as Mode, label: 'Remove / return', hint: 'Broken, lost or done', icon: 'i-lucide-undo-2', color: '#F04A50' },
  ...(canTruck.value
    ? [
        { value: 'load' as Mode, label: 'Load truck', hint: 'Gear going on board', icon: 'i-lucide-truck', color: '#E3A63A' },
        { value: 'unload' as Mode, label: 'Unload truck', hint: 'Gear coming off', icon: 'i-lucide-package-open', color: '#6E95E0' }
      ]
    : [])
])
/** Load works on trucks still being packed; unload on trucks that have arrived. */
const tripChoices = computed(() => trips.value.filter(t => t.status === (mode.value === 'load' ? 'loading' : 'arrived')))
const trip = computed(() => tripChoices.value.find(t => t.id === tripId.value) ?? null)
const ready = computed(() => truckMode.value ? trip.value !== null : event.value !== null)

onMounted(async () => {
  const wantedMode = String(route.query.mode ?? '')
  const [ev, tr] = await Promise.all([
    api.get<{ data: Row[] }>('/scan-events'),
    canTruck.value ? api.get<{ data: Row[] }>('/trips', { scope: 'active' }) : Promise.resolve({ data: [] as Row[] })
  ])
  events.value = ev.data
  trips.value = tr.data
  const wanted = Number(route.query.event)
  eventId.value = events.value.find(e => e.id === wanted)?.id ?? events.value.find(e => e.is_live)?.id ?? events.value[0]?.id ?? null
  if (wantedMode === 'remove' || (canTruck.value && (wantedMode === 'load' || wantedMode === 'unload'))) {
    mode.value = wantedMode as Mode
  }
  tripId.value = Number(route.query.trip) || null
  pickTrip()
})

/** Keep the picked truck if it fits the mode, otherwise take the first one that does. */
function pickTrip() {
  if (!tripChoices.value.some(t => t.id === tripId.value)) {
    tripId.value = tripChoices.value[0]?.id ?? null
  }
}

watch([mode, eventId], () => {
  reset()
  loadOnEvent()
})
watch(mode, pickTrip)
watch([mode, tripId], () => {
  truckResult.value = null
})

/** Gear currently out on the picked event: what remove mode can take off without a camera. */
async function loadOnEvent() {
  if (mode.value !== 'remove' || !eventId.value) {
    onEvent.value = []
    return
  }
  const id = eventId.value
  onEventLoading.value = true
  try {
    const rows = (await api.get<{ data: Row[] }>(`/scan-events/${id}/equipment`)).data
    if (id === eventId.value) {
      onEvent.value = rows
    }
  } catch (e) {
    fail(e)
  } finally {
    onEventLoading.value = false
  }
}

function pickToRemove(u: Row) {
  item.value = { code: u.code, name: u.name }
  removeOpen.value = true
}

function reset() {
  phase.value = 'ready'
  item.value = null
  block.value = null
  manual.value = ''
  note.value = ''
}

async function onCode(raw: string) {
  const code = raw.trim().toUpperCase()
  if (truckMode.value) {
    // The camera stays live between truck scans, so ignore the same sticker for 3 s.
    if (code && !(code === lastCode && Date.now() - lastAt < 3000)) {
      lastCode = code
      lastAt = Date.now()
      manual.value = ''
      await truckScan(code)
    }
    return
  }
  if (!code || busy.value || phase.value !== 'ready' || !event.value) {
    return
  }
  busy.value = true
  try {
    const found = (await api.get<{ data: Row }>(`/scan-items/${encodeURIComponent(code)}`, { event_id: event.value.id })).data
    item.value = found
    if (found.kind === 'container') {
      if (mode.value === 'remove') {
        fail(`${found.code} is a case. Scan the item you're taking off.`)
        item.value = null
        return
      }
      phase.value = 'case'
      return
    }
    if (mode.value === 'remove') {
      if (!found.is_on_this_event) {
        fail(`${found.code} is not on ${event.value.name}.`)
        item.value = null
        return
      }
      removeOpen.value = true
      return
    }
    if (found.block?.reason === 'in_transit') {
      fail(`${found.code} can't be added: ${found.block.label}.`)
      item.value = null
      return
    }
    if (found.block) {
      const res = await api.post<{ data: Row }>('/scans', { event_id: event.value.id, code: found.code, mode: 'add', condition: 'good', gps: await geo.fix() })
      showBlocked(res.data.block)
      return
    }
    condition.value = found.condition === 'minor_wear' ? 'minor_wear' : found.condition === 'damaged' ? 'damaged' : 'good'
    phase.value = 'scanned'
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function truckScan(code: string) {
  if (busy.value || !trip.value) {
    return
  }
  const t = trip.value
  const action = mode.value as 'load' | 'unload'
  busy.value = true
  try {
    const res = await queue.run(`/trips/${t.id}/movements`, { action, codes: [code], condition: condition.value, gps: await geo.fix() }) as { data: Row } | false
    if (res === false) {
      truckResult.value = { offline: true, codes: [code] }
      notify(`No signal. ${code} saved on this phone and will be sent when you're back online.`)
      return
    }
    const r = res.data
    truckResult.value = r
    trips.value = trips.value.map(x => x.id === r.trip.id ? r.trip : x)
    const at = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const done: string[] = (action === 'load' ? r.loaded : r.unloaded) ?? []
    truckSession.value = [
      ...done.map(c => ({ code: c, action, trip_id: r.trip.id, trip_code: r.trip.code, at, load_movement_id: action === 'load' ? r.trip.manifest.find((m: Row) => m.code === c)?.load_movement_id ?? null : null })),
      ...truckSession.value
    ]
    if (done.length) {
      success(`${action === 'load' ? 'Loaded' : 'Unloaded'} ${done.join(', ')}`)
    }
    for (const b of (r.blocked ?? []) as Row[]) {
      fail(`${b.code}: ${b.reason}`)
    }
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function takeOff(s: Row) {
  try {
    const t = (await api.del<{ data: Row }>(`/movements/${s.load_movement_id}`)).data
    trips.value = trips.value.map(x => x.id === t.id ? t : x)
    truckSession.value = truckSession.value.filter(x => x !== s)
    notify(`${s.code} taken back off the truck.`)
  } catch (e) {
    fail(e)
  }
}

function onDetect(codes: { rawValue: string }[]) {
  if (codes[0]) {
    onCode(codes[0].rawValue)
  }
}

function onCameraError(e: Error) {
  cameraError.value = e.name === 'NotAllowedError' ? 'Camera permission was denied. Type the ID instead.' : 'No camera available. Type the ID from the sticker instead.'
}

async function add() {
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/scans', { event_id: event.value!.id, code: item.value!.code, mode: 'add', condition: condition.value, note: note.value.trim() || null, gps: await geo.fix() })
    if (res.data.result === 'blocked') {
      showBlocked(res.data.block)
      return
    }
    const usage: Row = res.data.usage
    const from: string | null = res.data.unloaded_from ?? null
    session.value.unshift({ ...usage, at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })
    success(`${usage.code} added to ${event.value?.name}${from ? ` · unloaded from ${from}` : ''}`, () => undo(usage))
    reset()
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

/** Keep the red card (it links to details) and toast so the scan never fails silently. */
function showBlocked(b: Row) {
  block.value = b
  phase.value = 'blocked'
  fail(`${b.code} can't be added: ${b.blocking_event ? `${b.item_status_label} on ${b.blocking_event.label}` : b.reason}.`)
}

async function addCase() {
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/scans', { event_id: event.value!.id, code: item.value!.code, mode: 'add', condition: 'good', note: note.value.trim() || null, gps: await geo.fix() })
    const r = res.data
    const at = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const usages: Row[] = r.usages ?? []
    const blocked: Row[] = r.blocked ?? []
    session.value = [...usages.map(u => ({ ...u, at })), ...session.value]
    if (usages.length) {
      success(`Added ${plural(usages.length, 'item')} from ${r.container?.code}${r.unloaded_from ? ` · unloaded from ${r.unloaded_from}` : ''}`)
    }
    if (blocked.length) {
      // The card lists which items stayed out and why; a toast alone would lose that.
      caseResult.value = r
      phase.value = 'case_added'
      fail(`${plural(blocked.length, 'item')} left out of ${r.container?.code}`)
      return
    }
    reset()
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function undo(u: Row) {
  try {
    await api.del(`/scans/${u.id}`)
    session.value = session.value.filter(s => s.id !== u.id)
    notify(`${u.code} taken back off ${event.value?.name}.`)
  } catch (e) {
    fail(e)
  }
}

function onRemoved(u: Row) {
  removeOpen.value = false
  lastUsage.value = u
  removedSession.value.unshift({ ...u, at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })
  phase.value = 'removed'
  loadOnEvent()
}

async function undoRemove(u: Row) {
  try {
    await api.del(`/scans/${u.id}`)
    removedSession.value = removedSession.value.filter(s => s.id !== u.id)
    notify(`${u.code} is back on ${event.value?.name}.`)
    if (lastUsage.value?.id === u.id) {
      reset()
    }
    loadOnEvent()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <header class="flex flex-col gap-3 bg-[#0B0B0C] px-5 pt-4 pb-5 text-white">
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="isCrew ? '/crew' : '/events'"
          aria-label="Back"
          class="inline-flex size-11 items-center justify-center rounded-md border border-[#3B3F47] text-white hover:text-white"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="size-5"
          />
        </NuxtLink>
        <div>
          <h1 class="font-display m-0 text-2xl leading-none font-extrabold uppercase">
            Scan equipment
          </h1>
          <div class="text-sm text-[#C9CCD2]">
            {{ user?.name }} · {{ user?.role_label }}
          </div>
        </div>
      </div>
      <label
        v-if="truckMode"
        class="flex flex-col gap-1.5"
      >
        <span class="text-xs font-bold tracking-[.06em] text-[#9EA3AD] uppercase">Truck{{ isCrew ? ' · only trips you\'re on' : '' }}</span>
        <select
          v-model="tripId"
          class="min-h-11 rounded-md border border-[#3B3F47] bg-[#1A1B1E] px-3 text-base text-white"
        >
          <option
            v-if="!tripChoices.length"
            :value="null"
          >
            {{ mode === 'load' ? 'No truck is loading right now' : 'No truck has arrived to unload' }}
          </option>
          <option
            v-for="t in tripChoices"
            :key="t.id"
            :value="t.id"
          >
            {{ t.code }} · {{ t.event.name }} · {{ t.vehicle?.name ?? 'Truck not set' }}
          </option>
        </select>
      </label>
      <label
        v-else
        class="flex flex-col gap-1.5"
      >
        <span class="text-xs font-bold tracking-[.06em] text-[#9EA3AD] uppercase">Event{{ isCrew ? ' · only events you\'re on' : '' }}</span>
        <select
          v-model="eventId"
          class="min-h-11 rounded-md border border-[#3B3F47] bg-[#1A1B1E] px-3 text-base text-white"
        >
          <option
            v-if="!events.length"
            :value="null"
          >
            No events to scan into
          </option>
          <option
            v-for="e in events"
            :key="e.id"
            :value="e.id"
          >
            {{ e.label }}
          </option>
        </select>
      </label>
      <fieldset class="m-0 border-0 p-0">
        <legend class="sr-only">
          What are you scanning for?
        </legend>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="m in modes"
            :key="m.value"
            class="flex min-h-16 cursor-pointer items-center gap-2.5 rounded-md border-2 px-2.5 py-2 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white"
            :style="mode === m.value ? { borderColor: m.color, background: `${m.color}24` } : { borderColor: '#2A2C31', background: '#16171A' }"
          >
            <input
              v-model="mode"
              type="radio"
              name="mode"
              :value="m.value"
              class="sr-only"
            >
            <span
              aria-hidden="true"
              class="flex size-9 flex-none items-center justify-center rounded-md"
              :style="{ background: mode === m.value ? m.color : `${m.color}29`, color: mode === m.value ? '#0B0B0C' : m.color }"
            >
              <UIcon
                :name="m.icon"
                class="size-5"
              />
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <b
                class="text-[15px] leading-tight"
                :class="mode === m.value ? 'text-white' : 'text-[#E4E6EA]'"
              >{{ m.label }}</b>
              <span
                class="text-xs leading-snug"
                :class="mode === m.value ? 'text-[#C9CCD2]' : 'text-[#8A8F99]'"
              >{{ m.hint }}</span>
            </span>
          </label>
        </div>
      </fieldset>
    </header>

    <main class="flex flex-col gap-3 p-4">
      <div
        class="relative overflow-hidden rounded-lg bg-[#16171A]"
        :style="{ height: phase === 'ready' ? '300px' : '170px', opacity: phase === 'ready' ? 1 : .4 }"
      >
        <QrcodeStream
          v-if="phase === 'ready' && ready && !cameraError"
          :paused="busy || removeOpen"
          :formats="['qr_code']"
          @detect="onDetect"
          @error="onCameraError"
        />
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="relative size-[150px]">
            <span class="absolute top-0 left-0 size-8 border-t-4 border-l-4 border-white" />
            <span class="absolute top-0 right-0 size-8 border-t-4 border-r-4 border-white" />
            <span class="absolute bottom-0 left-0 size-8 border-b-4 border-l-4 border-white" />
            <span class="absolute right-0 bottom-0 size-8 border-r-4 border-b-4 border-white" />
            <span
              v-if="phase === 'ready'"
              class="absolute right-2 left-2 h-0.5 bg-[#ED1B24]"
              style="animation: bpa-scan 2.4s ease-in-out infinite"
            />
          </div>
        </div>
        <div class="pointer-events-none absolute right-0 bottom-3 left-0 text-center text-sm text-[#C9CCD2]">
          {{ phase === 'ready' ? (cameraError || (mode === 'remove' ? 'Scan the item you\'re taking off this event' : mode === 'load' ? 'Scan a case or item going on the truck' : mode === 'unload' ? 'Scan a case or item coming off the truck' : 'Point at the QR sticker on the item')) : item ? `Scanned · ${item.code}` : 'Paused' }}
        </div>
      </div>

      <form
        v-if="phase === 'ready'"
        class="flex gap-2"
        @submit.prevent="onCode(manual)"
      >
        <input
          v-model="manual"
          type="text"
          class="ctl font-mono uppercase"
          placeholder="Or type the ID, e.g. SPK-016"
          aria-label="Item ID"
          autocapitalize="characters"
        >
        <button
          type="submit"
          class="btn btn-dark"
          :disabled="busy || !manual.trim() || !ready"
        >
          Go
        </button>
      </form>

      <section
        v-if="truckMode && trip"
        class="card flex flex-col gap-3 p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <NuxtLink
            :to="`/trips/${trip.id}`"
            class="font-mono text-[15px] font-medium"
          >{{ trip.code }}</NuxtLink>
          <UiBadge
            :tone="TRIP_DIRECTION[trip.direction]!"
            :label="trip.direction_label"
          />
        </div>
        <p class="m-0 text-sm">
          <b>{{ trip.event.label }}</b><span class="block text-[#565B66]">{{ trip.origin?.name ?? '?' }} → {{ trip.destination?.name ?? '?' }} · {{ plural(trip.on_board, 'item') }} on the truck</span>
        </p>
        <p class="m-0 text-sm text-[#565B66]">
          {{ mode === 'load' ? 'Scan a case to load everything packed in it, or scan items one by one.' : trip.direction === 'transfer' ? `Each item scanned off the truck moves onto ${trip.to_event?.label ?? 'the next event'}.` : trip.direction === 'outbound' ? 'Each item scanned off the truck is added to the event.' : 'Each item scanned off the truck goes back to stock (or the repair shelf if damaged).' }}
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
        <div
          v-if="truckResult"
          aria-live="polite"
          class="flex flex-col gap-1.5 rounded-md bg-[#F2F3F5] p-3 text-sm"
        >
          <span v-if="truckResult.offline">Saved offline: {{ truckResult.codes.join(', ') }}</span>
          <template v-else>
            <span v-if="(truckResult.loaded ?? truckResult.unloaded)?.length"><b class="text-[#1D6B3C]">{{ mode === 'load' ? 'Loaded' : 'Done' }}:</b> {{ (truckResult.loaded ?? truckResult.unloaded).join(', ') }}</span>
            <span
              v-for="b in truckResult.blocked"
              :key="b.code"
              class="text-[#B4121A]"
            ><b>{{ b.code }}</b> · {{ b.reason }}</span>
            <span
              v-for="sk in truckResult.skipped"
              :key="sk.code"
              class="text-[#565B66]"
            >{{ sk.code }} · {{ sk.reason }}</span>
          </template>
        </div>
        <span
          v-if="queue.pending.value"
          class="text-[13px] text-[#565B66]"
        >{{ queue.pending.value }} waiting for signal</span>
      </section>

      <section
        v-if="truckMode && truckSession.length"
        class="card flex flex-col"
      >
        <div class="border-b border-[#DADDE3] px-4 py-3 text-sm font-bold">
          {{ mode === 'load' ? 'Loaded' : 'Unloaded' }} this session ({{ truckSession.filter(s => s.action === mode).length }})
        </div>
        <div
          v-for="s in truckSession.filter(x => x.action === mode)"
          :key="`${s.trip_id}-${s.code}-${s.at}`"
          class="flex items-center justify-between border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
        >
          <span><span class="font-mono">{{ s.code }}</span><span class="block text-[13px] text-[#565B66]">{{ s.trip_code }} · {{ user?.name }} · {{ s.at }}</span></span>
          <button
            v-if="s.load_movement_id && trips.find(t => t.id === s.trip_id)?.status === 'loading'"
            type="button"
            class="cursor-pointer border-0 bg-transparent font-semibold text-[#2F5596] underline"
            @click="takeOff(s)"
          >
            Take off
          </button>
        </div>
      </section>

      <section
        v-if="phase === 'scanned' && item"
        class="card flex flex-col gap-3 p-4"
      >
        <div class="flex items-center justify-between">
          <span class="font-mono text-[15px] font-medium">{{ item.code }}</span>
          <UiBadge
            :tone="EQUIPMENT_STATUS[item.status]!.tone"
            :label="item.status_label"
          />
        </div>
        <h2 class="font-display m-0 text-2xl font-extrabold uppercase">
          {{ item.name }}
        </h2>
        <p class="m-0 text-sm text-[#565B66]">
          {{ item.last_use }}
        </p>
        <p
          v-if="item.unload_from"
          class="m-0 flex items-center gap-2 rounded-md bg-[#E6ECF6] px-3 py-2.5 text-sm text-[#244677]"
        >
          <UIcon
            name="i-lucide-truck"
            class="size-4 flex-none"
          />
          <span>On truck <b>{{ item.unload_from }}</b>. Adding it unloads it from the truck.</span>
        </p>
        <p
          v-if="item.case"
          class="m-0 flex items-center gap-2 rounded-md bg-[#F2F3F5] px-3 py-2.5 text-sm"
        >
          <UIcon
            name="i-lucide-package"
            class="size-4 flex-none"
          />
          <span>Packed in <b>{{ item.case }}</b>. Scan the case to add everything in it at once.</span>
        </p>
        <fieldset class="m-0 border-0 p-0">
          <legend class="mb-1.5 text-sm font-semibold">
            Condition now
          </legend>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="(c, k) in EQUIPMENT_CONDITION"
              :key="k"
              class="flex min-h-16 cursor-pointer flex-col justify-center gap-0.5 rounded-md border-2 px-2.5 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#2F5596]"
              :style="condition === k ? { borderColor: c.dot, background: c.tone.bg } : { borderColor: '#DADDE3' }"
            >
              <input
                v-model="condition"
                type="radio"
                name="condition"
                :value="k"
                class="sr-only"
              >
              <span class="flex items-center gap-1.5">
                <span
                  class="size-2.5 flex-none rounded-full"
                  :style="{ background: c.dot }"
                />
                <b
                  class="text-[15px] leading-tight"
                  :style="condition === k ? { color: c.tone.fg } : undefined"
                >{{ c.label }}</b>
              </span>
              <span class="text-xs leading-snug text-[#565B66]">{{ c.hint }}</span>
            </label>
          </div>
        </fieldset>
        <UiField label="Note (optional)">
          <textarea
            v-model="note"
            rows="2"
            maxlength="255"
            class="ctl"
            placeholder="e.g. Grille dented, tape on left side"
          />
        </UiField>
        <p class="m-0 text-[13px] text-[#565B66]">
          Logged as added by <b class="text-[#0B0B0C]">{{ user?.name }}</b> · time set on save
        </p>
        <div class="grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-phone"
            @click="reset"
          >
            Skip
          </button>
          <button
            type="button"
            class="btn btn-primary btn-phone"
            :disabled="busy"
            @click="add"
          >
            {{ item.unload_from ? 'Unload & add to' : 'Add to' }} {{ event?.name }}
          </button>
        </div>
      </section>

      <section
        v-if="phase === 'case' && item"
        class="card flex flex-col gap-3 p-4"
      >
        <div class="flex items-center justify-between">
          <span class="font-mono text-[15px] font-medium">{{ item.code }}</span>
          <span class="badge bg-[#0B0B0C] text-white">{{ item.type_label }}</span>
        </div>
        <h2 class="font-display m-0 text-2xl font-extrabold uppercase">
          {{ item.name }}
        </h2>
        <p class="m-0 text-sm text-[#565B66]">
          {{ item.items.length }} {{ item.items.length === 1 ? 'item' : 'items' }} packed inside
        </p>
        <ul class="m-0 flex max-h-[220px] list-none flex-col overflow-y-auto rounded-md border border-[#DADDE3] p-0">
          <li
            v-for="i in item.items"
            :key="i.id"
            class="flex justify-between gap-2 border-b border-[#EEF0F2] px-3 py-2 text-sm last:border-0"
          >
            <span><span class="font-mono">{{ i.code }}</span> · {{ i.name }}</span>
            <span :class="i.status === 'available' ? 'text-[#1D6B3C]' : 'font-semibold text-[#B4121A]'">{{ i.status_label }}</span>
          </li>
        </ul>
        <p class="m-0 text-[13px] text-[#565B66]">
          Items that aren't available stay out and are listed after adding.
        </p>
        <UiField label="Note (optional)">
          <textarea
            v-model="note"
            rows="2"
            maxlength="255"
            class="ctl"
            placeholder="Saved on every item in the case"
          />
        </UiField>
        <div class="grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-phone"
            @click="reset"
          >
            Skip
          </button>
          <button
            type="button"
            class="btn btn-primary btn-phone"
            :disabled="busy || !item.items.length"
            @click="addCase"
          >
            Add all to {{ event?.name }}
          </button>
        </div>
      </section>

      <section
        v-if="phase === 'case_added' && caseResult"
        class="overflow-hidden rounded-lg border-2 border-[#1D6B3C] bg-white"
      >
        <div class="font-display flex items-center gap-2 bg-[#1D6B3C] px-4 py-2.5 text-xl font-extrabold text-white uppercase">
          <UIcon
            name="i-lucide-check"
            class="size-5"
          />Added {{ caseResult.usages?.length ?? 0 }} from {{ caseResult.container?.code }}
        </div>
        <div class="flex flex-col gap-1.5 p-4 text-sm">
          <span>{{ (caseResult.usages ?? []).map((u: Row) => u.code).join(', ') || 'Nothing added.' }}</span>
          <span
            v-if="caseResult.unloaded_from"
            class="text-[#565B66]"
          >Unloaded from truck <span class="font-mono">{{ caseResult.unloaded_from }}</span></span>
          <span
            v-for="b in caseResult.blocked ?? []"
            :key="b.code"
            class="text-[#B4121A]"
          ><b>{{ b.code }}</b> left out · {{ b.reason }}</span>
        </div>
        <div class="px-4 pb-4">
          <button
            type="button"
            class="btn btn-primary btn-phone btn-block"
            @click="reset"
          >
            Scan next
          </button>
        </div>
      </section>

      <section
        v-if="phase === 'blocked' && block"
        class="overflow-hidden rounded-lg border-2 border-[#C4141C] bg-white"
      >
        <div class="font-display flex items-center gap-2 bg-[#C4141C] px-4 py-2.5 text-xl font-extrabold text-white uppercase">
          <UIcon
            name="i-lucide-zap"
            class="size-5"
          />Can't add this item
        </div>
        <div class="flex flex-col gap-2 p-4 text-[15px]">
          <p class="m-0">
            <span class="font-mono">{{ block.code }}</span> · {{ block.item_name }} is {{ block.blocking_event ? 'still' : '' }} <b>{{ block.blocking_event ? `${block.item_status_label} on ${block.blocking_event.label}` : block.reason }}</b>{{ block.blocking_event?.is_ended ? ' and was never returned' : '' }}.
          </p>
          <p class="m-0 text-sm text-[#565B66]">
            Your admin has been told. Set it aside, and don't use it until it's {{ block.blocking_event ? 'transferred' : 'cleared' }}.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 px-4 pb-4">
          <NuxtLink
            :to="`/scan/blocked/${block.id}`"
            class="btn btn-secondary btn-phone"
          >Details</NuxtLink>
          <button
            type="button"
            class="btn btn-primary btn-phone"
            @click="reset"
          >
            Scan another
          </button>
        </div>
      </section>

      <section
        v-if="phase === 'removed' && lastUsage"
        class="card flex flex-col items-center gap-3 p-5 text-center"
      >
        <span class="inline-flex size-16 items-center justify-center rounded-lg bg-[#0B0B0C] text-white"><UIcon
          name="i-lucide-check"
          class="size-8"
        /></span>
        <h2 class="font-display m-0 text-2xl font-extrabold uppercase">
          Removed from Event {{ event?.code }}
        </h2>
        <p class="m-0 text-[15px]">
          <span class="font-mono">{{ lastUsage.code }}</span> is now <b>{{ lastUsage.item_status_label }}</b>. Saved in its history.
        </p>
        <div class="grid w-full grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-phone"
            @click="undoRemove(lastUsage)"
          >
            Undo
          </button>
          <button
            type="button"
            class="btn btn-primary btn-phone"
            @click="reset"
          >
            Scan next item
          </button>
        </div>
      </section>

      <section
        v-if="mode === 'remove' && phase === 'ready' && event"
        class="card flex flex-col"
      >
        <div class="flex items-center justify-between border-b border-[#DADDE3] px-4 py-3 text-sm font-bold">
          <span>Out on {{ event.name }}{{ onEventLoading ? '' : ` (${onEvent.length})` }}</span>
          <span class="text-[13px] font-normal text-[#565B66]">No camera? Pick it here</span>
        </div>
        <div
          v-if="onEventLoading && !onEvent.length"
          aria-hidden="true"
          class="flex flex-col"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-4 py-3"
          >
            <div class="flex flex-1 flex-col gap-1.5">
              <span class="skel h-3.5 w-3/5" />
              <span class="skel h-3 w-2/5" />
            </div>
            <span class="skel h-9 w-20 rounded-md" />
          </div>
        </div>
        <div
          v-for="u in onEvent"
          :key="u.id"
          class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
        >
          <span class="min-w-0"><span class="font-mono">{{ u.code }}</span> · {{ u.name }}<span class="block text-[13px] text-[#565B66]">Added by {{ u.added_by }} · {{ u.added_at }}</span></span>
          <button
            type="button"
            class="btn btn-secondary btn-sm flex-none"
            aria-haspopup="dialog"
            @click="pickToRemove(u)"
          >
            Remove
          </button>
        </div>
        <p
          v-if="!onEventLoading && !onEvent.length"
          class="m-0 px-4 py-3 text-sm text-[#565B66]"
        >
          Nothing is out on {{ event.name }} right now.
        </p>
      </section>

      <section
        v-if="mode === 'remove' && removedSession.length"
        class="card flex flex-col"
      >
        <div class="border-b border-[#DADDE3] px-4 py-3 text-sm font-bold">
          Removed this session ({{ removedSession.length }})
        </div>
        <div
          v-for="s in removedSession"
          :key="s.id"
          class="flex items-center justify-between border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
        >
          <span><span class="font-mono">{{ s.code }}</span> · {{ s.name }}<span class="block text-[13px] text-[#565B66]">{{ s.item_status_label }} · {{ user?.name }} · {{ s.at }}</span></span>
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent font-semibold text-[#2F5596] underline"
            @click="undoRemove(s)"
          >
            Undo
          </button>
        </div>
      </section>

      <section
        v-if="mode === 'add' && session.length"
        class="card flex flex-col"
      >
        <div class="border-b border-[#DADDE3] px-4 py-3 text-sm font-bold">
          Added this session ({{ session.length }})
        </div>
        <div
          v-for="s in session"
          :key="s.id"
          class="flex items-center justify-between border-b border-[#EEF0F2] px-4 py-2.5 text-sm"
        >
          <span><span class="font-mono">{{ s.code }}</span> · {{ s.name }}<span class="block text-[13px] text-[#565B66]">{{ user?.name }} · {{ s.at }}</span></span>
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent font-semibold text-[#2F5596] underline"
            @click="undo(s)"
          >
            Undo
          </button>
        </div>
      </section>
    </main>

    <CrewRemoveSheet
      v-if="removeOpen && item && event"
      :item="item"
      :event="event"
      @close="removeOpen = false; reset()"
      @done="onRemoved"
    />
  </div>
</template>
