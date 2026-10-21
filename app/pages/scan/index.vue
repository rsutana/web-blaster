<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', module: 'track', level: 'own', title: 'Scan equipment' })
useHead({ title: 'Scan equipment · Blaster Pro Audio' })

const api = useApi()
const route = useRoute()
const { notify, fail } = useNotify()
const { user, isCrew } = useAuthUser()
const geo = useGeo()
const caseResult = ref<Row | null>(null)

type Phase = 'ready' | 'scanned' | 'added' | 'blocked' | 'removed' | 'case' | 'case_added'
const events = ref<Row[]>([])
const eventId = ref<number | null>(null)
const mode = ref<'add' | 'remove'>('add')
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
const error = ref('')
const cameraError = ref('')
const busy = ref(false)
const removeOpen = ref(false)

const event = computed(() => events.value.find(e => e.id === eventId.value) ?? null)

onMounted(async () => {
  events.value = (await api.get<{ data: Row[] }>('/scan-events')).data
  const wanted = Number(route.query.event)
  eventId.value = events.value.find(e => e.id === wanted)?.id ?? events.value.find(e => e.is_live)?.id ?? events.value[0]?.id ?? null
  if (route.query.mode === 'remove') {
    mode.value = 'remove'
  }
})

watch([mode, eventId], () => {
  reset()
  loadOnEvent()
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
  error.value = ''
  item.value = { code: u.code, name: u.name }
  removeOpen.value = true
}

function reset() {
  phase.value = 'ready'
  item.value = null
  block.value = null
  error.value = ''
  manual.value = ''
  note.value = ''
}

async function onCode(raw: string) {
  const code = raw.trim().toUpperCase()
  if (!code || busy.value || phase.value !== 'ready' || !event.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const found = (await api.get<{ data: Row }>(`/scan-items/${encodeURIComponent(code)}`, { event_id: event.value.id })).data
    item.value = found
    if (found.kind === 'container') {
      if (mode.value === 'remove') {
        error.value = `${found.code} is a case. Scan the item you're taking off.`
        item.value = null
        return
      }
      phase.value = 'case'
      return
    }
    if (mode.value === 'remove') {
      if (!found.is_on_this_event) {
        error.value = `${found.code} is not on ${event.value.name}.`
        item.value = null
        return
      }
      removeOpen.value = true
      return
    }
    if (found.block?.reason === 'in_transit') {
      error.value = `${found.code} can't be added: ${found.block.label}.`
      item.value = null
      return
    }
    if (found.block) {
      const res = await api.post<{ data: Row }>('/scans', { event_id: event.value.id, code: found.code, mode: 'add', condition: 'good', gps: await geo.fix() })
      block.value = res.data.block
      phase.value = 'blocked'
      return
    }
    condition.value = found.condition === 'minor_wear' ? 'minor_wear' : found.condition === 'damaged' ? 'damaged' : 'good'
    phase.value = 'scanned'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
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
      block.value = res.data.block
      phase.value = 'blocked'
      return
    }
    lastUsage.value = res.data.usage
    session.value.unshift({ ...res.data.usage, at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })
    phase.value = 'added'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function addCase() {
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/scans', { event_id: event.value!.id, code: item.value!.code, mode: 'add', condition: 'good', note: note.value.trim() || null, gps: await geo.fix() })
    caseResult.value = res.data
    const at = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    session.value = [...(res.data.usages ?? []).map((u: Row) => ({ ...u, at })), ...session.value]
    phase.value = 'case_added'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function undo(u: Row) {
  try {
    await api.del(`/scans/${u.id}`)
    session.value = session.value.filter(s => s.id !== u.id)
    notify(`${u.code} taken back off ${event.value?.name}.`)
    if (lastUsage.value?.id === u.id) {
      reset()
    }
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

const condLabel = (c: string) => EQUIPMENT_CONDITION[c]?.label ?? c
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
      <label class="flex flex-col gap-1.5">
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
      <UiSegmented
        v-model="mode"
        name="mode"
        dark
        :options="[{ value: 'add', label: 'Add to event' }, { value: 'remove', label: 'Remove / return' }]"
      />
    </header>

    <main class="flex flex-col gap-3 p-4">
      <div
        class="relative overflow-hidden rounded-lg bg-[#16171A]"
        :style="{ height: phase === 'ready' ? '300px' : '170px', opacity: phase === 'ready' ? 1 : .4 }"
      >
        <QrcodeStream
          v-if="phase === 'ready' && event && !cameraError"
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
          {{ phase === 'ready' ? (cameraError || (mode === 'remove' ? 'Scan the item you\'re taking off this event' : 'Point at the QR sticker on the item')) : item ? `Scanned · ${item.code}` : 'Paused' }}
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
          :disabled="busy || !manual.trim() || !event"
        >
          Go
        </button>
      </form>
      <p
        v-if="error"
        role="alert"
        class="err m-0"
      >
        {{ error }}
      </p>

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
          v-if="item.is_case"
          class="m-0 flex flex-col gap-1 rounded-md bg-[#F2F3F5] px-3 py-2.5 text-sm"
        >
          <b>{{ item.contents }}</b>
          <span
            v-if="item.missing_count"
            class="font-semibold text-[#B4121A]"
          >{{ item.missing_count }} pcs were short at the last count.</span>
          <span
            v-else
            class="text-[#565B66]"
          >Adds the whole case. Nothing inside needs scanning.</span>
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
            Add to {{ event?.name }}
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
        v-if="phase === 'added' && lastUsage"
        class="overflow-hidden rounded-lg border-2 border-[#1D6B3C] bg-white"
      >
        <div class="font-display flex items-center gap-2 bg-[#1D6B3C] px-4 py-2.5 text-xl font-extrabold text-white uppercase">
          <UIcon
            name="i-lucide-check"
            class="size-5"
          />Added
        </div>
        <dl class="m-0 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 p-4 text-[15px]">
          <dt class="text-[#565B66]">
            Item
          </dt><dd class="m-0">
            <span class="font-mono">{{ lastUsage.code }}</span> · {{ lastUsage.name }}
          </dd>
          <dt class="text-[#565B66]">
            Event
          </dt><dd class="m-0">
            {{ event?.name }}
          </dd>
          <dt class="text-[#565B66]">
            Condition
          </dt><dd class="m-0">
            {{ condLabel(lastUsage.condition) }}
          </dd>
          <template v-if="lastUsage.note">
            <dt class="text-[#565B66]">
              Note
            </dt><dd class="m-0">
              {{ lastUsage.note }}
            </dd>
          </template>
          <dt class="text-[#565B66]">
            Time
          </dt><dd class="m-0">
            {{ lastUsage.added_at }}
          </dd>
        </dl>
        <div class="grid grid-cols-[1fr_2fr] gap-2 px-4 pb-4">
          <button
            type="button"
            class="btn btn-secondary btn-phone"
            @click="undo(lastUsage)"
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
