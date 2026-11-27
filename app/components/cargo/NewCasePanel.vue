<script setup lang="ts">
import type { Row } from '~/types/api'

/** Make a new case or box that rides on this truck, packing items into it as it's made. */
const props = defineProps<{ truck: Row | null }>()
const emit = defineEmits<{ saved: [cases: Row[]] }>()
const open = defineModel<boolean>('open', { required: true })
const { success } = useNotify()
const caseForm = ref<{ save: () => Promise<{ cases: Row[], packed: string[] } | null>, reset: () => Promise<void>, canSave: boolean, busy: boolean } | null>(null)
const printLabel = ref(false)

watch(open, async (v) => {
  if (v) {
    printLabel.value = false
    await nextTick()
    await caseForm.value?.reset()
  }
})

async function save() {
  const result = await caseForm.value?.save()
  if (!result) {
    return
  }
  open.value = false
  const codes = result.cases.map(c => c.code)
  success({ title: 'Case added', description: `${codes.join(', ')} is on ${props.truck?.name ?? 'the truck'}${result.packed.length ? ` with ${plural(result.packed.length, 'item')} packed inside` : ''}.` })
  emit('saved', result.cases)
  if (printLabel.value) {
    await navigateTo(`/equipment/labels?codes=${codes.join(',')}`)
  }
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="`New case on ${truck?.name ?? 'truck'}`"
    subtitle="Its own ID and QR label. Scanning the case moves everything packed inside."
  >
    <LogisticsCaseForm
      v-if="truck"
      ref="caseForm"
      :vehicle-id="truck.id"
    />
    <label class="flex items-center gap-2 text-sm font-semibold">
      <input
        v-model="printLabel"
        type="checkbox"
        class="size-5 accent-[#2F5596]"
      > Print the case QR label after saving
    </label>
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
        :disabled="!caseForm?.canSave"
        @click="save"
      >
        Save case
      </button>
    </template>
  </UiSlidePanel>
</template>
