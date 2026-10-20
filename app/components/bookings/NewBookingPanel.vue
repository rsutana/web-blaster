<script setup lang="ts">
import type { Row } from '~/types/api'

const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const clients = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const form = reactive({ client_id: '' as number | string, name: '', start_date: '', end_date: '', venue_name: '', venue_city: '', deposit_pct: '50' })

watch(open, async (v) => {
  if (v) {
    Object.assign(form, { client_id: '', name: '', start_date: '', end_date: '', venue_name: '', venue_city: '', deposit_pct: '50' })
    errors.value = {}
    clients.value = (await api.get<{ data: Row[] }>('/clients')).data.filter(c => c.status === 'active')
  }
})
watch(() => form.start_date, (d) => {
  if (d && (!form.end_date || form.end_date < d)) {
    form.end_date = d
  }
})

async function save() {
  busy.value = true
  errors.value = {}
  try {
    const res = await api.post<{ data: Row }>('/bookings', { ...form, deposit_pct: Number(form.deposit_pct) || 50 })
    open.value = false
    await navigateTo(`/bookings/${res.data.id}`)
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
  <UiSlidePanel
    v-model:open="open"
    title="New booking"
    subtitle="Starts as a quote draft. Add lines, send the quote, then the contract."
  >
    <UiField
      label="Client *"
      :error="errors.client_id"
    >
      <select
        v-model="form.client_id"
        class="ctl"
      >
        <option
          value=""
          disabled
        >
          Choose a client…
        </option>
        <option
          v-for="c in clients"
          :key="c.id"
          :value="c.id"
        >
          {{ c.name }}
        </option>
      </select>
    </UiField>
    <UiField
      label="Event name *"
      :error="errors.name"
    >
      <input
        v-model="form.name"
        type="text"
        class="ctl"
        placeholder="e.g. Product launch"
      >
    </UiField>
    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Start date *"
        :error="errors.start_date"
      >
        <input
          v-model="form.start_date"
          type="date"
          class="ctl"
        >
      </UiField>
      <UiField
        label="End date *"
        :error="errors.end_date"
      >
        <input
          v-model="form.end_date"
          type="date"
          class="ctl"
        >
      </UiField>
      <UiField label="Venue">
        <input
          v-model="form.venue_name"
          type="text"
          class="ctl"
          placeholder="[Venue name]"
        >
      </UiField>
      <UiField label="City">
        <input
          v-model="form.venue_city"
          type="text"
          class="ctl"
        >
      </UiField>
    </div>
    <UiField
      label="Deposit (%)"
      help="Locks the date. 50% unless agreed otherwise."
    >
      <input
        v-model="form.deposit_pct"
        inputmode="decimal"
        class="ctl"
        style="width: 120px"
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
        Create booking
      </button>
    </template>
  </UiSlidePanel>
</template>
