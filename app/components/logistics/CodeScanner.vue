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
  emit('code', code)
}

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
      class="relative h-[240px] overflow-hidden rounded-lg bg-[#16171A]"
    >
      <QrcodeStream
        :paused="busy"
        :formats="['qr_code']"
        @detect="onDetect"
        @error="onError"
      />
      <div class="pointer-events-none absolute right-0 bottom-3 left-0 text-center text-sm text-[#C9CCD2]">
        {{ hint }}
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
