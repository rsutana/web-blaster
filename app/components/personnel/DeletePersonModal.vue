<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ person: Row }>()
const emit = defineEmits<{ deleted: [person: Row, reasonLabel: string] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const REASONS: Record<string, string> = { leave: 'On leave', seasonal: 'Seasonal, back for peak season', resigned: 'Resigned', moved: 'Moved away', norehire: 'Not rehiring', other: 'Other' }
const LABEL: Record<string, string> = { leave: 'On leave', seasonal: 'Seasonal', resigned: 'Resigned', moved: 'Moved away', norehire: 'Not rehiring', other: 'Other' }
const impact = ref<Row | null>(null)
const reason = ref('')
const back = ref('')
const tried = ref(false)
const busy = ref(false)

watch(open, async (v) => {
  if (!v) {
    return
  }
  reason.value = ''
  back.value = ''
  tried.value = false
  impact.value = (await api.get<{ data: Row }>(`/personnel/${props.person.id}/deactivation`)).data
}, { immediate: true })

async function confirm() {
  tried.value = true
  if (!reason.value) {
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/personnel/${props.person.id}/deactivation`, { reason: reason.value, expected_back_on: back.value || null })
    open.value = false
    emit('deleted', res.data, LABEL[reason.value]!)
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
    :title="`Delete ${person.full_name}?`"
  >
    <template #subtitle>
      They aren't erased. They're set to <b class="text-white">Inactive</b>, so their pay and event history stay, and you can bring them back when they return to work.
    </template>
    <ul class="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">
      <li>Not available for new events and hidden from crew pickers.</li>
      <template v-if="impact">
        <li>{{ impact.assign_line }}</li>
        <li>{{ impact.login_line }}</li>
        <li>{{ impact.money_line }}</li>
      </template>
    </ul>
    <UiField
      label="Reason *"
      :error="tried && !reason ? 'Choose a reason. It shows on their profile.' : ''"
    >
      <select
        v-model="reason"
        class="ctl"
        :class="{ 'ctl-error': tried && !reason }"
      >
        <option value="">
          Choose a reason
        </option>
        <option
          v-for="(l, v) in REASONS"
          :key="v"
          :value="v"
        >
          {{ l }}
        </option>
      </select>
    </UiField>
    <UiField
      label="Expected back"
      optional
      help="Just a reminder for you. They stay Inactive until you reactivate them."
    >
      <input
        v-model="back"
        type="date"
        class="ctl"
      >
    </UiField>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Keep active
      </button>
      <button
        type="button"
        class="btn btn-danger"
        :disabled="busy"
        @click="confirm"
      >
        Delete · set Inactive
      </button>
    </template>
  </UiDialog>
</template>
