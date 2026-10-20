<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ person: Row, kind: 'advance' | 'deduction' }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { notify, fail } = useNotify()

const form = reactive({ amount: '', installment_amount: '', given_on: todayIso(), reason: '', type: 'late_absence', note: '', deducted_on: todayIso() })
const errors = ref<Record<string, string>>({})
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    Object.assign(form, { amount: '', installment_amount: '', given_on: todayIso(), reason: '', type: 'late_absence', note: '', deducted_on: todayIso() })
    errors.value = {}
  }
})

const installments = computed(() => {
  const a = Number(form.amount)
  const i = Number(form.installment_amount)
  return a > 0 && i > 0 ? Math.ceil(a / i) : 0
})

async function save() {
  busy.value = true
  errors.value = {}
  try {
    if (props.kind === 'advance') {
      await api.post(`/personnel/${props.person.id}/advances`, { amount: Number(form.amount), installment_amount: Number(form.installment_amount), given_on: form.given_on, reason: form.reason || null })
      notify(`${peso(Number(form.amount))} advance recorded for ${props.person.full_name}.`)
    } else {
      await api.post(`/personnel/${props.person.id}/deductions`, { type: form.type, note: form.note, amount: Number(form.amount), deducted_on: form.deducted_on })
      notify(`${peso(Number(form.amount))} deduction added. It comes off ${props.person.first_name}'s next payroll run.`)
    }
    open.value = false
    emit('saved')
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="kind === 'advance' ? 'Record advance' : 'Add deduction'"
    :subtitle="`${person.full_name} · paid ${person.pay_schedule_label.toLowerCase()}`"
  >
    <template v-if="kind === 'advance'">
      <UiField
        label="Amount given (₱) *"
        :error="errors.amount"
      >
        <input
          v-model="form.amount"
          inputmode="decimal"
          class="ctl"
          style="min-height: 48px; font-size: 18px; font-weight: 700"
        >
      </UiField>
      <UiField
        label="Repay per payroll (₱) *"
        :error="errors.installment_amount"
        :help="installments ? `${plural(installments, 'installment')}, taken off each payroll run until it's paid.` : 'Taken off each payroll run until the advance is paid.'"
      >
        <input
          v-model="form.installment_amount"
          inputmode="decimal"
          class="ctl"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField label="Given on">
          <input
            v-model="form.given_on"
            type="date"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Reason"
          optional
        >
          <input
            v-model="form.reason"
            type="text"
            class="ctl"
          >
        </UiField>
      </div>
    </template>
    <template v-else>
      <UiField label="Type">
        <select
          v-model="form.type"
          class="ctl"
        >
          <option value="equipment_damage">
            Equipment damage
          </option>
          <option value="uniform_gear">
            Uniform / gear
          </option>
          <option value="late_absence">
            Late or absence penalty
          </option>
          <option value="other">
            Other
          </option>
        </select>
      </UiField>
      <UiField
        label="What for *"
        :error="errors.note"
      >
        <input
          v-model="form.note"
          type="text"
          class="ctl"
          placeholder="e.g. late call time, Oct 11"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Amount (₱) *"
          :error="errors.amount"
        >
          <input
            v-model="form.amount"
            inputmode="decimal"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Date"
          help="Comes off the run that covers this date."
        >
          <input
            v-model="form.deducted_on"
            type="date"
            class="ctl"
          >
        </UiField>
      </div>
    </template>
    <p class="m-0 text-[13px] text-[#565B66]">
      Recorded with your name and the time. Corrections are a new entry.
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
        @click="save"
      >
        {{ kind === 'advance' ? 'Record advance' : 'Add deduction' }}
      </button>
    </template>
  </UiDialog>
</template>
