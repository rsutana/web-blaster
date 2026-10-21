<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ trip: Row }>()
const emit = defineEmits<{ cancelled: [trip: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const note = ref('')
const tried = ref(false)
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    note.value = ''
    tried.value = false
  }
}, { immediate: true })

async function confirm() {
  tried.value = true
  if (!note.value.trim()) {
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/trips/${props.trip.id}/cancellation`, { note: note.value.trim() })
    open.value = false
    emit('cancelled', res.data)
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    tone="red"
    icon="i-lucide-circle-x"
    :title="`Cancel ${trip.code}?`"
    :subtitle="`${trip.direction_label} · ${trip.event.label}`"
  >
    <ul class="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">
      <li v-if="trip.on_board">
        {{ plural(trip.on_board, 'item') }} already loaded go back to where they were.
      </li>
      <li v-if="trip.has_driver_link">
        The driver link stops working.
      </li>
      <li>The trip moves to <b>Cancelled</b> and stays under All trips.</li>
    </ul>
    <UiField
      label="Note"
      required
      :error="tried && !note.trim() ? 'Say why this trip is cancelled.' : ''"
    >
      <textarea
        v-model="note"
        rows="2"
        maxlength="255"
        class="ctl"
        :class="{ 'ctl-error': tried && !note.trim() }"
        placeholder="e.g. Client moved the load-in to Friday"
      />
    </UiField>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Keep trip
      </button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="busy"
        @click="confirm"
      >
        Cancel trip
      </button>
    </template>
  </UiDialog>
</template>
