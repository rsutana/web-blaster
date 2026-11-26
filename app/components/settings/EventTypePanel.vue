<script setup lang="ts">
import type { Row } from '~/types/api'

const emit = defineEmits<{ saved: [type: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const label = ref('')
const error = ref('')
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    label.value = ''
    error.value = ''
  }
}, { immediate: true })

async function save() {
  error.value = ''
  if (!label.value.trim()) {
    error.value = 'Enter the event type name.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/event-types', { label: label.value.trim() })
    open.value = false
    emit('saved', res.data)
  } catch (e) {
    error.value = fieldErrors(e).label ?? ''
    if (!error.value) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    title="Add event type"
    subtitle="It is added to the end of the list and shown in the event form."
  >
    <UiField
      label="Name *"
      :error="error"
    >
      <input
        v-model="label"
        type="text"
        maxlength="60"
        class="ctl"
        :class="{ 'ctl-error': error }"
        placeholder="e.g. Birthday / debut"
        @keydown.enter.prevent="save"
      >
    </UiField>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save"
      >
        Save event type
      </button>
    </template>
  </UiSlidePanel>
</template>
