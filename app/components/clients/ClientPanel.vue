<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ client?: Row | null }>()
const emit = defineEmits<{ saved: [client: Row, isNew: boolean] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const TYPES = [['corporate', 'Corporate'], ['individual', 'Individual'], ['school', 'School'], ['government_lgu', 'Government / LGU'], ['church_community', 'Church / community'], ['agency', 'Agency / production'], ['venue_partner', 'Venue partner']]
const blank = () => ({ name: '', type: 'corporate', contact_name: '', contact_position: '', mobile: '', email: '', city: '', tin: '', notes: '', status: 'active' })
const form = reactive(blank())
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const full = ref<Row | null>(null)
const isEdit = computed(() => !!props.client)

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  Object.assign(form, blank())
  full.value = null
  if (props.client) {
    const c = props.client
    Object.assign(form, { name: c.name, type: c.type, contact_name: c.contact_name ?? '', contact_position: c.contact_position ?? '', mobile: c.mobile ?? '', email: c.email ?? '', city: c.city ?? '', tin: c.tin ?? '', notes: c.notes ?? '', status: c.status })
    full.value = (await api.get<{ data: Row }>(`/clients/${c.id}`)).data
  }
}, { immediate: true })

async function save() {
  busy.value = true
  errors.value = {}
  try {
    const body = { ...form, mobile: form.mobile || null, email: form.email || null }
    const res = isEdit.value
      ? await api.patch<{ data: Row }>(`/clients/${props.client!.id}`, body)
      : await api.post<{ data: Row }>('/clients', body)
    open.value = false
    emit('saved', res.data, !isEdit.value)
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
    :title="isEdit ? 'Edit client' : 'Add client'"
    :subtitle="isEdit ? `${client!.type_label} · ${client!.history?.events_count ?? 0} events` : 'Saved clients can be picked when you create an event.'"
  >
    <UiField
      label="Client / company name *"
      :error="errors.name"
    >
      <input
        v-model="form.name"
        type="text"
        class="ctl"
        :class="{ 'ctl-error': errors.name }"
        placeholder="e.g. Lumen Mobile PH or Juan Dela Cruz"
      >
    </UiField>
    <UiField label="Type">
      <select
        v-model="form.type"
        class="ctl"
      >
        <option
          v-for="[v, l] in TYPES"
          :key="v"
          :value="v"
        >
          {{ l }}
        </option>
      </select>
    </UiField>
    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="h-section mb-2 text-lg">
        Main contact
      </legend>
      <div class="grid grid-cols-2 gap-3">
        <UiField label="Contact person">
          <input
            v-model="form.contact_name"
            type="text"
            class="ctl"
            placeholder="Full name"
          >
        </UiField>
        <UiField
          label="Position"
          optional
        >
          <input
            v-model="form.contact_position"
            type="text"
            class="ctl"
            placeholder="e.g. HR, Marketing"
          >
        </UiField>
        <UiField
          label="Mobile no. *"
          :error="errors.mobile"
        >
          <input
            v-model="form.mobile"
            type="tel"
            inputmode="numeric"
            maxlength="13"
            placeholder="09XX XXX XXXX"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Email"
          optional
          :error="errors.email"
        >
          <input
            v-model="form.email"
            type="email"
            class="ctl"
            placeholder="name@company.ph"
          >
        </UiField>
      </div>
      <span class="help">New events for this client start with this contact. You can change it per event.</span>
    </fieldset>
    <div class="grid grid-cols-2 gap-3">
      <UiField label="City / province">
        <input
          v-model="form.city"
          type="text"
          class="ctl"
          placeholder="e.g. Makati"
        >
      </UiField>
      <UiField
        label="TIN"
        help="For receipts"
        optional
      >
        <input
          v-model="form.tin"
          inputmode="numeric"
          class="ctl"
          placeholder="000-000-000-000"
        >
      </UiField>
    </div>
    <UiField label="Notes">
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. Prefers Shure mics, pays 50% down"
      />
    </UiField>
    <template v-if="isEdit">
      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-1.5 text-sm font-semibold">
          Status
        </legend>
        <UiSegmented
          v-model="form.status"
          name="client-status"
          :options="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]"
        />
        <span class="help mt-1.5 block">Inactive clients are hidden from the client picker on new events. Their events and history stay.</span>
      </fieldset>
      <div class="overflow-hidden rounded-lg border border-[#DADDE3]">
        <div class="flex items-baseline justify-between bg-[#0B0B0C] px-3.5 py-2.5 text-white">
          <span class="font-display text-lg font-bold uppercase">Events · {{ client!.history?.events_count ?? 0 }} total</span>
          <span class="text-[13px] text-[#C9CCD2]">client since {{ client!.history?.since_year }}</span>
        </div>
        <ul class="m-0 flex list-none flex-col p-0">
          <li
            v-for="e in full?.current_events ?? []"
            :key="e.id"
            class="flex items-center justify-between gap-2 border-b border-[#EEF0F2] px-3.5 py-2.5 text-sm"
          >
            <span><NuxtLink
              :to="`/events/${e.id}`"
              class="font-semibold"
            >{{ e.label }}</NuxtLink><span class="block text-[13px] text-[#565B66]">{{ e.dates }}</span></span>
            <UiBadge
              :tone="EVENT_STATUS[e.status]!.tone"
              :label="EVENT_STATUS[e.status]!.label"
            />
          </li>
          <li
            v-if="full && !full.current_events.length"
            class="px-3.5 py-2.5 text-sm text-[#565B66]"
          >
            No current events.
          </li>
        </ul>
        <div class="px-3.5 py-2.5 text-[13px] text-[#565B66]">
          Older events: last one {{ client!.history?.last_event ?? '—' }}.
        </div>
      </div>
    </template>
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
        {{ isEdit ? 'Save changes' : 'Save client' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
