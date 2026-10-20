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
const busy = ref(false)

async function send() {
  error.value = ''
  if (why.value !== 'swap' && !note.value.trim()) {
    error.value = 'Say what happened so the admin can follow up.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/scans', { event_id: props.event.id, code: props.item.code, mode: 'remove', reason: why.value, note: note.value.trim() || null })
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
