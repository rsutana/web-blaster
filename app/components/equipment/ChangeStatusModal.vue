<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ item: Row }>()
const emit = defineEmits<{ changed: [status: string, note: string, previous: string] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const target = ref('')
const note = ref('')
const location = ref('')
const tried = ref(false)
const busy = ref(false)

const ev = computed(() => props.item.active_event?.label ?? 'its event')
const DESC: Record<string, Record<string, string>> = {
  available: { under_repair: 'Needs fixing. It can\'t be booked or scanned into events until it\'s marked repaired.', lost: 'Can\'t be found. It stays in reports until it\'s found or written off.', retired: 'Out of service for good (worn out, beyond repair). History is kept.' },
  deployed: { available: `Returned to the warehouse. Checks it in from ${ev.value}.`, under_repair: `Broken on site. Removes it from ${ev.value}, and the removal stays in that event's history.`, lost: `Missing at pack-out. Logged against ${ev.value}.` },
  under_repair: { available: 'Fixed and ready to book again.', retired: 'Not worth fixing. Out of service for good.' },
  lost: { available: 'Found. Back in stock and ready to book.', retired: 'Written off. Stays in history and reports.' },
  retired: { available: 'Back in service. It can be booked again.' }
}
const options = computed(() => (props.item.allowed_statuses as string[]).map(s => ({ value: s, label: s === 'available' && props.item.status === 'under_repair' ? 'Available · repaired' : EQUIPMENT_STATUS[s]!.label, dot: EQUIPMENT_STATUS[s]!.dot, desc: DESC[props.item.status]?.[s] ?? '' })))
const needsNote = computed(() => !!target.value && target.value !== 'available')
const needsLocation = computed(() => target.value === 'available' || target.value === 'under_repair')
const placeholder = computed(() => ({ under_repair: 'e.g. no sound from left driver', lost: 'e.g. not in the truck at pack-out', retired: 'e.g. worn out after 60+ uses' } as Record<string, string>)[target.value] ?? 'Optional')

watch(open, (v) => {
  if (v) {
    target.value = ''
    note.value = ''
    location.value = ''
    tried.value = false
  }
}, { immediate: true })

watch(target, (t) => {
  location.value = t === 'under_repair' ? 'Repair shelf' : (props.item.home_location ?? '')
})

async function confirm() {
  tried.value = true
  if (!target.value || (needsNote.value && !note.value.trim())) {
    return
  }
  busy.value = true
  try {
    await api.post(`/equipment/${props.item.code}/status-changes`, { status: target.value, note: note.value.trim() || null, location: needsLocation.value ? location.value.trim() || null : null })
    open.value = false
    emit('changed', target.value, note.value.trim(), props.item.status)
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
    title="Change status"
  >
    <template #subtitle>
      <span class="font-mono text-white">{{ item.code }}</span> {{ item.name }} · now <UiBadge
        :tone="EQUIPMENT_STATUS[item.status]!.tone"
        :label="item.status_label"
      />
    </template>
    <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        New status *
      </legend>
      <label
        v-for="o in options"
        :key="o.value"
        class="flex cursor-pointer gap-3 rounded-md border-2 p-3"
        :class="target === o.value ? 'border-[#2F5596] bg-[#F3F6FB]' : 'border-[#DADDE3]'"
      >
        <input
          v-model="target"
          type="radio"
          name="status"
          :value="o.value"
          class="sr-only"
        >
        <span
          aria-hidden="true"
          class="mt-1.5 size-2.5 flex-none rounded-full"
          :style="{ background: o.dot }"
        />
        <span><b class="text-[15px]">{{ o.label }}</b><span class="block text-sm text-[#565B66]">{{ o.desc }}</span></span>
      </label>
      <span
        v-if="tried && !target"
        role="alert"
        class="err"
      >Pick the new status.</span>
    </fieldset>
    <UiField
      v-if="needsLocation"
      :label="target === 'under_repair' ? 'Where is it being fixed?' : 'Put it where?'"
    >
      <input
        v-model="location"
        type="text"
        class="ctl"
        :placeholder="target === 'under_repair' ? 'e.g. Repair shelf, or the repair shop name' : ''"
      >
    </UiField>
    <UiField
      :label="needsNote ? 'Reason *' : 'Note'"
      :optional="!needsNote"
      :error="tried && needsNote && !note.trim() ? 'Add a short reason. It\'s saved in the item\'s history.' : ''"
    >
      <textarea
        v-model="note"
        rows="2"
        class="ctl"
        :class="{ 'ctl-error': tried && needsNote && !note.trim() }"
        :placeholder="placeholder"
      />
    </UiField>
    <p class="m-0 text-[13px] text-[#565B66]">
      Logged in the item's history with your name and the time. Deployed is set by scanning the item into an event, not here.
    </p>
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
        @click="confirm"
      >
        Change status
      </button>
    </template>
  </UiDialog>
</template>
