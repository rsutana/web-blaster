<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ item: Row, event: Row }>()
const emit = defineEmits<{ close: [], done: [usage: Row] }>()
const api = useApi()
const { user } = useAuthUser()

const REASONS = {
  broken: { label: 'Broken', result: 'Under repair', button: 'Remove · broken', ph: 'e.g. Connector crushed during load-in', danger: true },
  worn: { label: 'Worn out', result: 'Retired', button: 'Remove · worn out', ph: 'e.g. Jacket cracked, wires showing', danger: true },
  lost: { label: 'Lost', result: 'Lost', button: 'Report lost', ph: 'e.g. Not in the truck at pack-out', danger: true },
  swap: { label: 'Not needed', result: 'Available', button: 'Return to stock', ph: 'Optional', danger: false }
} as const
const why = ref<keyof typeof REASONS>('broken')
const note = ref('')
const error = ref('')
const photoError = ref('')
const busy = ref(false)
const photo = ref<File | null>(null)
const preview = ref('')
const photoInput = ref<HTMLInputElement | null>(null)

function pickPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  photoError.value = ''
  if (!file) {
    return
  }
  if (!file.type.startsWith('image/')) {
    photoError.value = 'Pick a photo, not another kind of file.'
    return
  }
  clearPhoto()
  photo.value = file
  preview.value = URL.createObjectURL(file)
}

function clearPhoto() {
  if (preview.value) {
    URL.revokeObjectURL(preview.value)
  }
  photo.value = null
  preview.value = ''
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}
onBeforeUnmount(clearPhoto)

async function send() {
  error.value = ''
  if (why.value !== 'swap' && !note.value.trim()) {
    error.value = 'Say what happened so the admin can follow up.'
    return
  }
  busy.value = true
  try {
    const body = new FormData()
    body.append('event_id', String(props.event.id))
    body.append('code', props.item.code)
    body.append('mode', 'remove')
    body.append('reason', why.value)
    if (note.value.trim()) {
      body.append('note', note.value.trim())
    }
    if (photo.value) {
      body.append('photo', photo.value)
    }
    const res = await api.post<{ data: Row }>('/scans', body)
    emit('done', res.data.usage)
  } catch (e) {
    error.value = errorMessage(e)
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
      aria-label="Remove from event"
      class="flex max-h-[92vh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-xl bg-white p-5"
    >
      <span class="mx-auto h-[5px] w-11 rounded-full bg-[#DADDE3]" />
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="font-display m-0 text-[26px] font-extrabold uppercase">
            Remove from event
          </h2>
          <p class="mt-1 mb-0 text-sm text-[#565B66]">
            <span class="font-mono">{{ item.code }}</span> · {{ item.name }} · Event {{ event.code }}
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
      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-1.5 text-sm font-semibold">
          Reason *
        </legend>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="(r, k) in REASONS"
            :key="k"
            class="flex min-h-16 cursor-pointer flex-col justify-center rounded-md border-2 px-3"
            :class="why === k ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#DADDE3]'"
          >
            <input
              v-model="why"
              type="radio"
              name="why"
              :value="k"
              class="sr-only"
            >
            <b class="text-base">{{ r.label }}</b>
            <span
              class="text-[13px]"
              :class="why === k ? 'text-[#C9CCD2]' : 'text-[#565B66]'"
            >→ {{ r.result }}</span>
          </label>
        </div>
      </fieldset>
      <UiField
        :label="why === 'swap' ? 'Note (optional)' : 'What happened? *'"
        :error="error"
      >
        <textarea
          v-model="note"
          rows="3"
          class="ctl"
          :class="{ 'ctl-error': error }"
          :placeholder="REASONS[why].ph"
        />
      </UiField>
      <div class="flex flex-col gap-1.5">
        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          @change="pickPhoto"
        >
        <div
          v-if="preview"
          class="flex items-center gap-3 rounded-md border border-[#DADDE3] p-2"
        >
          <img
            :src="preview"
            alt="Photo to send"
            class="size-16 flex-none rounded object-cover"
          >
          <span class="min-w-0 flex-1 truncate text-sm">{{ photo?.name }}</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="photoInput?.click()"
          >
            Retake
          </button>
          <button
            type="button"
            aria-label="Remove photo"
            class="inline-flex size-10 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#565B66]"
            @click="clearPhoto"
          >
            <UIcon
              name="i-lucide-x"
              class="size-5"
            />
          </button>
        </div>
        <button
          v-else
          type="button"
          class="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-[15px] font-semibold text-[#3B3F47]"
          @click="photoInput?.click()"
        >
          <UIcon
            name="i-lucide-camera"
            class="size-[18px]"
          />Take a photo (optional)
        </button>
        <p
          v-if="photoError"
          role="alert"
          class="err m-0"
        >
          {{ photoError }}
        </p>
      </div>
      <div
        v-if="why !== 'swap'"
        class="rounded-md bg-[#E6ECF6] p-3 text-sm text-[#244677]"
      >
        Need a spare? After sending, scan the spare's QR and it's added to this event.
      </div>
      <p class="m-0 text-[13px] text-[#565B66]">
        Sent as <b class="text-[#0B0B0C]">{{ user?.name }}</b> with the current time. Your admin sees it on the event.
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
          class="btn btn-phone"
          :class="REASONS[why].danger ? 'btn-danger' : 'btn-primary'"
          :disabled="busy"
          @click="send"
        >
          {{ REASONS[why].button }}
        </button>
      </div>
    </div>
  </div>
</template>
