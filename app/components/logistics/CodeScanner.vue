<script setup lang="ts">
import { QrcodeStream } from 'vue-qrcode-reader'

/**
 * Camera QR scanning plus a typed-ID fallback. Emits each code once; the same code within 3 s is ignored,
 * so holding the phone over a sticker doesn't scan it twenty times.
 */
const props = withDefaults(defineProps<{ busy?: boolean, placeholder?: string, hint?: string }>(), { busy: false, placeholder: 'Type an item or case ID, e.g. CASE-001', hint: 'Point at the QR sticker on the item or case' })
const emit = defineEmits<{ code: [code: string] }>()

const camera = ref(false)
const cameraError = ref('')
const manual = ref('')
/** The code just read, shown on the viewfinder for a moment with green corners. */
const hit = ref('')
let hitTimer: ReturnType<typeof setTimeout> | undefined
let lastCode = ''
let lastAt = 0

function push(raw: string) {
  const code = raw.trim().toUpperCase()
  if (!code || props.busy) {
    return
  }
  if (code === lastCode && Date.now() - lastAt < 3000) {
    return
  }
  lastCode = code
  lastAt = Date.now()
  hit.value = code
  clearTimeout(hitTimer)
  hitTimer = setTimeout(() => {
    hit.value = ''
  }, 1200)
  emit('code', code)
}

onBeforeUnmount(() => clearTimeout(hitTimer))

function onDetect(codes: { rawValue: string }[]) {
  if (codes[0]) {
    push(codes[0].rawValue)
  }
}

function onError(e: Error) {
  cameraError.value = e.name === 'NotAllowedError' ? 'Camera permission was denied. Type the ID instead.' : 'No camera available. Type the ID instead.'
  camera.value = false
}

function submit() {
  push(manual.value)
  manual.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="camera"
      class="relative h-[260px] overflow-hidden rounded-lg bg-[#16171A]"
    >
      <QrcodeStream
        :paused="busy"
        :formats="['qr_code']"
        @detect="onDetect"
        @error="onError"
      />
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div class="relative size-[150px]">
          <span
            v-for="corner in ['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'right-0 bottom-0 border-r-4 border-b-4']"
            :key="corner"
            class="absolute size-8 transition-colors duration-200"
            :class="[corner, hit ? 'border-[#3FB56B]' : 'border-white']"
          />
          <span
            v-if="!hit && !busy"
            class="absolute right-2 left-2 h-0.5 animate-[bpa-scan_2.4s_ease-in-out_infinite] bg-[#ED1B24] motion-reduce:top-1/2 motion-reduce:animate-none"
          />
        </div>
      </div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-center text-sm font-semibold"
        :class="hit ? 'text-[#7EE0A1]' : 'text-white'"
        aria-live="polite"
      >
        {{ hit ? `Scanned · ${hit}` : busy ? 'One moment…' : hint }}
      </div>
    </div>
    <form
      class="flex gap-2"
      @submit.prevent="submit"
    >
      <input
        v-model="manual"
        type="text"
        class="ctl font-mono uppercase"
        :placeholder="placeholder"
        aria-label="Item or case ID"
        autocapitalize="characters"
        autocomplete="off"
      >
      <button
        type="submit"
        class="btn btn-dark"
        :disabled="busy || !manual.trim()"
      >
        Go
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        :aria-pressed="camera"
        :aria-label="camera ? 'Turn camera off' : 'Scan with camera'"
        @click="camera = !camera; cameraError = ''"
      >
        <UIcon
          :name="camera ? 'i-lucide-camera-off' : 'i-lucide-qr-code'"
          class="size-[18px]"
        />
      </button>
    </form>
    <p
      v-if="cameraError"
      role="alert"
      class="err m-0"
    >
      {{ cameraError }}
    </p>
  </div>
</template>
