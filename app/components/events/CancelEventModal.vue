<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row }>()
const emit = defineEmits<{ cancelled: [event: Row, impact: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const impact = ref<Row | null>(null)
const reason = ref('')
const note = ref('')
const tried = ref(false)
const busy = ref(false)

watch(open, async (v) => {
  if (!v) {
    return
  }
  reason.value = ''
  note.value = ''
  tried.value = false
  impact.value = null
  impact.value = (await api.get<{ data: Row }>(`/events/${props.event.id}/cancellation`)).data
}, { immediate: true })

async function confirm() {
  tried.value = true
  if (!reason.value) {
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/events/${props.event.id}/cancellation`, { reason: reason.value, note: note.value || null })
    open.value = false
    emit('cancelled', res.data, impact.value ?? {})
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
    icon="i-lucide-zap"
    :title="`Cancel ${event.label}?`"
    :subtitle="`${event.dates_label} · ${event.venue_name}`"
  >
    <ul class="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">
      <template v-if="impact">
        <li>{{ impact.eq_line }}</li>
        <li>{{ impact.crew_line }}</li>
        <li>{{ impact.pay_line }}</li>
      </template>
      <li>The event moves to <b>Cancelled</b>. Its history stays and you can undo right after.</li>
    </ul>
    <UiField
      label="Reason *"
      :error="tried && !reason ? 'Choose a reason to cancel this event.' : ''"
    >
      <select
        v-model="reason"
        class="ctl"
        :class="{ 'ctl-error': tried && !reason }"
      >
        <option value="">
          Choose a reason
        </option>
        <option value="client">
          Client cancelled
        </option>
        <option value="weather">
          Weather
        </option>
        <option value="venue">
          Venue issue
        </option>
        <option value="moved">
          Moved to another date (new event)
        </option>
        <option value="other">
          Other
        </option>
      </select>
    </UiField>
    <UiField
      label="Note"
      optional
    >
      <textarea
        v-model="note"
        rows="2"
        class="ctl"
        placeholder="e.g. Client will rebook for December"
      />
    </UiField>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Keep event
      </button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="busy"
        @click="confirm"
      >
        Cancel event
      </button>
    </template>
  </UiDialog>
</template>
