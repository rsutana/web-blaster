<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ eventId: number, eventLabel: string, signOff: Row }>()
const emit = defineEmits<{ close: [], done: [rows: Row[]] }>()
const api = useApi()
const { user } = useAuthUser()
const geo = useGeo()

const name = ref('')
const note = ref('')
const isConfirmed = ref(false)
const errors = ref<Record<string, string>>({})
const error = ref('')
const busy = ref(false)

const pad = ref<HTMLCanvasElement | null>(null)
const hasInk = ref(false)
let ctx: CanvasRenderingContext2D | null = null
let last: { x: number, y: number } | null = null

/** Size the canvas to its box at the screen's pixel density so strokes stay sharp. */
function setupPad() {
  const c = pad.value
  if (!c) {
    return
  }
  const box = c.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  c.width = Math.round(box.width * dpr)
  c.height = Math.round(box.height * dpr)
  ctx = c.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0B0B0C'
    ctx.fillStyle = '#0B0B0C'
  }
  hasInk.value = false
}
onMounted(setupPad)

function at(e: PointerEvent) {
  const box = pad.value!.getBoundingClientRect()
  return { x: e.clientX - box.left, y: e.clientY - box.top }
}

function penDown(e: PointerEvent) {
  if (!ctx) {
    return
  }
  pad.value?.setPointerCapture(e.pointerId)
  last = at(e)
  ctx.beginPath()
  ctx.arc(last.x, last.y, 1.25, 0, Math.PI * 2)
  ctx.fill()
  hasInk.value = true
  errors.value = { ...errors.value, signature: '' }
}

function penMove(e: PointerEvent) {
  if (!ctx || !last) {
    return
  }
  const p = at(e)
  ctx.beginPath()
  ctx.moveTo(last.x, last.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  last = p
}

function penUp() {
  last = null
}

function clearPad() {
  const c = pad.value
  if (c && ctx) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.restore()
  }
  hasInk.value = false
}

/** The signature on a white background, so it reads the same wherever it's shown. */
function signatureBlob(): Promise<Blob | null> {
  const c = pad.value
  if (!c) {
    return Promise.resolve(null)
  }
  const out = document.createElement('canvas')
  out.width = c.width
  out.height = c.height
  const o = out.getContext('2d')!
  o.fillStyle = '#FFFFFF'
  o.fillRect(0, 0, out.width, out.height)
  o.drawImage(c, 0, 0)
  return new Promise(resolve => out.toBlob(resolve, 'image/png'))
}

async function send() {
  error.value = ''
  const missing: Record<string, string> = {}
  if (!name.value.trim()) {
    missing.signer_name = 'Ask the client to type their full name.'
  }
  if (!hasInk.value) {
    missing.signature = 'Ask the client to sign in the box.'
  }
  if (!isConfirmed.value) {
    missing.is_confirmed = 'The client has to tick the confirmation before signing.'
  }
  errors.value = missing
  if (Object.keys(missing).length) {
    return
  }
  busy.value = true
  try {
    const blob = await signatureBlob()
    if (!blob) {
      errors.value = { signature: 'The signature could not be read. Clear it and sign again.' }
      return
    }
    const body = new FormData()
    body.append('kind', props.signOff.kind)
    body.append('signer_name', name.value.trim())
    body.append('signature', blob, 'signature.png')
    body.append('is_confirmed', '1')
    if (note.value.trim()) {
      body.append('note', note.value.trim())
    }
    const fix = await geo.fix()
    for (const [k, v] of Object.entries(fix)) {
      body.append(`gps[${k}]`, String(v))
    }
    const res = await api.post<{ data: Row[] }>(`/scan-events/${props.eventId}/sign-offs`, body)
    emit('done', res.data)
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length || errors.value.kind) {
      error.value = errorMessage(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,11,12,.6)]">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-off-title"
      class="flex max-h-[92vh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-xl bg-white p-5"
    >
      <span class="mx-auto h-[5px] w-11 rounded-full bg-[#DADDE3]" />
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2
            id="sign-off-title"
            class="font-display m-0 text-[26px] font-extrabold uppercase"
          >
            {{ signOff.label }}
          </h2>
          <p class="mt-1 mb-0 text-sm text-[#565B66]">
            {{ eventLabel }}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          class="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border border-[#B9BEC7] bg-white"
          @click="emit('close')"
        >
          <UIcon
            name="i-lucide-x"
            class="size-5"
          />
        </button>
      </div>

      <details class="group rounded-md border border-[#DADDE3]">
        <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span class="flex items-center gap-2">
            <UIcon
              name="i-lucide-package-check"
              class="size-[18px]"
            />{{ plural(signOff.item_count, 'item') }} covered
          </span>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-[#8A8F99] transition-transform group-open:rotate-180"
          />
        </summary>
        <ul class="m-0 max-h-[200px] list-none overflow-y-auto border-t border-[#EEF0F2] px-3 py-1.5">
          <li
            v-for="i in signOff.items"
            :key="i.code"
            class="py-1 text-[13px]"
          >
            <span class="font-mono">{{ i.code }}</span><span class="text-[#565B66]"> · {{ i.name }}</span>
          </li>
        </ul>
      </details>

      <UiField
        label="Client's full name"
        required
        :error="errors.signer_name"
      >
        <input
          v-model="name"
          type="text"
          class="ctl"
          :class="{ 'ctl-error': errors.signer_name }"
          autocomplete="name"
          maxlength="255"
          placeholder="e.g. Maria Santos"
        >
      </UiField>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span
            id="sign-pad-label"
            class="text-sm font-semibold"
          >Signature *</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="!hasInk"
            @click="clearPad"
          >
            Clear
          </button>
        </div>
        <div
          class="relative h-44 overflow-hidden rounded-md border-2 border-dashed bg-[#FAFAFB]"
          :class="errors.signature ? 'border-[#B4121A]' : 'border-[#9AA0AB]'"
        >
          <canvas
            ref="pad"
            role="img"
            aria-labelledby="sign-pad-label"
            :aria-describedby="hasInk ? undefined : 'sign-pad-hint'"
            class="absolute inset-0 size-full touch-none"
            @pointerdown.prevent="penDown"
            @pointermove.prevent="penMove"
            @pointerup="penUp"
            @pointercancel="penUp"
            @pointerleave="penUp"
          />
          <span
            v-if="!hasInk"
            id="sign-pad-hint"
            class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-[#8A8F99]"
          >
            <UIcon
              name="i-lucide-pen-line"
              class="size-4"
            />Client signs here with a finger
          </span>
          <span class="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-[#DADDE3]" />
        </div>
        <span
          v-if="errors.signature"
          role="alert"
          class="err"
        >{{ errors.signature }}</span>
      </div>

      <UiField
        label="Anything wrong or missing?"
        optional
        :error="errors.note"
      >
        <textarea
          v-model="note"
          rows="2"
          maxlength="1000"
          class="ctl"
          placeholder="e.g. One case lid scratched on arrival"
        />
      </UiField>

      <div class="flex flex-col gap-1.5">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-md border-2 p-3 text-[15px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#2F5596]"
          :class="isConfirmed ? 'border-[#1D6B3C] bg-[#E2F2E8]' : errors.is_confirmed ? 'border-[#B4121A]' : 'border-[#DADDE3]'"
        >
          <input
            v-model="isConfirmed"
            type="checkbox"
            class="mt-0.5 size-5 flex-none accent-[#1D6B3C]"
          >
          <span>{{ signOff.statement }}</span>
        </label>
        <span
          v-if="errors.is_confirmed"
          role="alert"
          class="err"
        >{{ errors.is_confirmed }}</span>
      </div>

      <p
        v-if="error"
        role="alert"
        class="err m-0"
      >
        {{ error }}
      </p>
      <p class="m-0 text-[13px] text-[#565B66]">
        Collected by <b class="text-[#0B0B0C]">{{ user?.name }}</b> with the current time and place. It can't be changed once signed.
      </p>
      <div class="grid grid-cols-[1fr_2fr] gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-phone"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary btn-phone"
          :disabled="busy"
          @click="send"
        >
          Sign and confirm
        </button>
      </div>
    </div>
  </div>
</template>
