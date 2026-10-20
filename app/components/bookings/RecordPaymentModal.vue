<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ url: string, subtitle: string, defaultAmount: number, max: number, withDate?: boolean, refPlaceholder?: string }>()
const emit = defineEmits<{ saved: [payment: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const amount = ref('')
const method = ref('bank_transfer')
const reference = ref('')
const receivedOn = ref(todayIso())
const error = ref('')
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    amount.value = props.defaultAmount > 0 ? props.defaultAmount.toFixed(2) : ''
    method.value = 'bank_transfer'
    reference.value = ''
    receivedOn.value = todayIso()
    error.value = ''
  }
})

async function save() {
  const n = Number(moneyInput(amount.value))
  if (!(n > 0) || n > props.max + 0.001) {
    error.value = props.withDate ? 'Enter an amount up to the remaining balance.' : 'Enter an amount up to the amount due.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>(props.url, { amount: n, method: method.value, reference: reference.value || null, received_on: props.withDate ? receivedOn.value : undefined })
    open.value = false
    emit('saved', res.data)
  } catch (e) {
    error.value = errorMessage(e)
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Record payment"
    :subtitle="subtitle"
  >
    <UiField
      label="Amount (₱) *"
      :error="error"
    >
      <input
        v-model="amount"
        inputmode="decimal"
        class="ctl"
        :class="{ 'ctl-error': error }"
        style="min-height: 48px; font-size: 18px; font-weight: 700"
      >
    </UiField>
    <UiField label="Method *">
      <select
        v-model="method"
        class="ctl"
      >
        <option value="bank_transfer">
          Bank transfer
        </option><option value="gcash">
          GCash
        </option><option value="cash">
          Cash
        </option><option value="check">
          Check
        </option>
      </select>
    </UiField>
    <UiField
      label="Reference number"
      optional
    >
      <input
        v-model="reference"
        type="text"
        class="ctl"
        :placeholder="refPlaceholder ?? 'e.g. BDO 0042 1187'"
      >
    </UiField>
    <UiField
      v-if="withDate"
      label="Date received *"
    >
      <input
        v-model="receivedOn"
        type="date"
        class="ctl"
        :max="todayIso()"
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
        Save payment
      </button>
    </template>
  </UiDialog>
</template>
