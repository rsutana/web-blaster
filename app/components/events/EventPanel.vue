<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event?: Row | null, clientId?: number | null }>()
const emit = defineEmits<{ saved: [event: Row, isNew: boolean], cancelled: [event: Row, impact: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const clients = ref<Row[]>([])
const assignees = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const cancelOpen = ref(false)
const autofilled = ref(false)

const blank = () => ({
  name: '', type: 'corporate', client_id: '' as number | string, new_client_name: '', new_client_type: 'corporate',
  contact_name: '', contact_mobile: '', lead_personnel_id: '' as number | string, start_date: '', end_date: '',
  call_time: '06:00', show_time: '', egress_time: '23:00', venue_name: '', city: '', hall_room: '', street_address: '',
  loading_notes: '', status: 'confirmed', crew_notes: ''
})
const form = reactive(blank())
const isEdit = computed(() => !!props.event)

const types = [['corporate', 'Corporate'], ['wedding', 'Wedding'], ['concert', 'Concert'], ['product_launch', 'Product launch'], ['church_community', 'Church / community'], ['other', 'Other']]
const clientTypes = [['corporate', 'Corporate'], ['individual', 'Individual'], ['school', 'School'], ['government_lgu', 'Government / LGU'], ['church_community', 'Church / community'], ['agency', 'Agency'], ['venue_partner', 'Venue partner']]

const pickable = computed(() => clients.value.filter(c => isEdit.value || c.status === 'active'))
const days = computed(() => {
  if (!form.start_date || !form.end_date) {
    return 0
  }
  return Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1
})

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  Object.assign(form, blank())
  autofilled.value = false
  if (props.event) {
    const e = props.event
    Object.assign(form, {
      name: e.name, type: e.type, client_id: e.client?.id ?? '', contact_name: e.contact_name ?? '', contact_mobile: e.contact_mobile ?? '',
      lead_personnel_id: e.lead_personnel_id ?? '', start_date: e.start_date, end_date: e.end_date, call_time: e.call_time ?? '',
      show_time: e.show_time ?? '', egress_time: e.egress_time ?? '', venue_name: e.venue_name, city: e.city ?? '', hall_room: e.hall_room ?? '',
      street_address: e.street_address ?? '', loading_notes: e.loading_notes ?? '', status: e.status === 'draft' ? 'draft' : 'confirmed', crew_notes: e.crew_notes ?? ''
    })
    api.get<{ data: Row[] }>(`/events/${e.id}/assignments`).then((r) => {
      assignees.value = r.data
    }).catch(() => {})
  } else if (props.clientId) {
    form.client_id = props.clientId
  }
  clients.value = (await api.get<{ data: Row[] }>('/clients')).data
  if (!props.event && props.clientId) {
    pickClient()
  }
}, { immediate: true })

function pickClient() {
  const c = clients.value.find(x => x.id === Number(form.client_id))
  if (c && !isEdit.value) {
    form.contact_name = [c.contact_name, c.contact_position ? `(${c.contact_position})` : ''].filter(Boolean).join(' ')
    form.contact_mobile = c.mobile ?? ''
    form.city = form.city || c.city || ''
    autofilled.value = true
  }
}

async function save(status?: string) {
  busy.value = true
  errors.value = {}
  const body: Row = { ...form, status: status ?? form.status }
  if (form.client_id === 'new') {
    body.client_id = null
    body.new_client = { name: form.new_client_name, type: form.new_client_type }
  }
  delete body.new_client_name
  delete body.new_client_type
  if (!body.lead_personnel_id) {
    body.lead_personnel_id = null
  }
  try {
    const res = isEdit.value
      ? await api.patch<{ data: Row }>(`/events/${props.event!.id}`, body)
      : await api.post<{ data: Row }>('/events', body)
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

function onCancelled(ev: Row, impact: Row) {
  open.value = false
  emit('cancelled', ev, impact)
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isEdit ? 'Edit event' : 'New event'"
    :subtitle="isEdit ? `${event!.label} · last edited by ${event!.updated_by ?? 'Admin'}, ${event!.updated_label}` : 'Add equipment and crew after saving, from the event page.'"
  >
    <UiField
      label="Event name *"
      :error="errors.name"
    >
      <input
        v-model="form.name"
        type="text"
        class="ctl"
        :class="{ 'ctl-error': errors.name }"
      >
    </UiField>
    <UiField label="Event type">
      <select
        v-model="form.type"
        class="ctl"
      >
        <option
          v-for="[v, l] in types"
          :key="v"
          :value="v"
        >
          {{ l }}
        </option>
      </select>
    </UiField>
    <UiField
      label="Client *"
      :error="errors.client_id"
    >
      <select
        v-model="form.client_id"
        class="ctl"
        :class="{ 'ctl-error': errors.client_id }"
        @change="pickClient"
      >
        <option
          value=""
          disabled
        >
          Choose a client…
        </option>
        <option
          v-for="c in pickable"
          :key="c.id"
          :value="c.id"
        >
          {{ c.name }}{{ c.status === 'inactive' ? ' (inactive)' : '' }}
        </option>
        <option
          v-if="!isEdit"
          value="new"
        >
          + New client…
        </option>
      </select>
    </UiField>
    <div
      v-if="form.client_id === 'new'"
      class="flex flex-col gap-3.5 rounded-lg border-2 border-dashed border-[#2F5596] bg-[#F3F6FB] p-3.5"
    >
      <UiField
        label="New client name *"
        help="Saved to Clients when you create the event."
        :error="errors['new_client.name']"
      >
        <input
          v-model="form.new_client_name"
          type="text"
          class="ctl"
          placeholder="Company or person"
        >
      </UiField>
      <UiField label="Type">
        <select
          v-model="form.new_client_type"
          class="ctl"
        >
          <option
            v-for="[v, l] in clientTypes"
            :key="v"
            :value="v"
          >
            {{ l }}
          </option>
        </select>
      </UiField>
    </div>
    <div class="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <UiField :label="isEdit ? 'Client contact' : 'Contact person'">
        <input
          v-model="form.contact_name"
          type="text"
          class="ctl"
        >
      </UiField>
      <UiField
        label="Contact mobile"
        :error="errors.contact_mobile"
      >
        <input
          v-model="form.contact_mobile"
          type="tel"
          inputmode="numeric"
          maxlength="13"
          placeholder="09XX XXX XXXX"
          class="ctl"
        >
      </UiField>
    </div>
    <p
      v-if="autofilled && !isEdit"
      class="help -mt-2 mb-0"
    >
      Filled in from the client's main contact. Change it for this event if needed.
    </p>
    <UiField
      v-if="isEdit"
      label="Event lead (on-site)"
      help="Only people assigned to this event are listed."
      :error="errors.lead_personnel_id"
    >
      <select
        v-model="form.lead_personnel_id"
        class="ctl"
      >
        <option value="">
          No lead yet
        </option>
        <option
          v-for="a in assignees"
          :key="a.personnel_id"
          :value="a.personnel_id"
        >
          {{ a.name }}{{ a.mobile ? ' · ' + phone(a.mobile) : '' }}
        </option>
      </select>
    </UiField>

    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="h-section mb-2 text-lg">
        Schedule
      </legend>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Start date *"
          :error="errors.start_date"
        >
          <input
            v-model="form.start_date"
            type="date"
            class="ctl"
            :class="{ 'ctl-error': errors.start_date }"
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
            :class="{ 'ctl-error': errors.end_date }"
          >
        </UiField>
        <UiField label="Crew call time">
          <input
            v-model="form.call_time"
            type="time"
            class="ctl"
          >
        </UiField>
        <UiField label="Show time">
          <input
            v-model="form.show_time"
            type="time"
            class="ctl"
          >
        </UiField>
        <UiField
          v-if="isEdit"
          label="Egress by"
        >
          <input
            v-model="form.egress_time"
            type="time"
            class="ctl"
          >
        </UiField>
      </div>
      <p class="help m-0">
        <template v-if="isEdit">
          Changing dates updates everyone's scheduled days and re-checks equipment for clashes with other events. Days already worked aren't changed.
        </template>
        <template v-else>
          {{ days > 0 ? plural(days, 'day') : 'Pick the dates' }} · ingress and egress can be added as separate days on the event page.
        </template>
      </p>
    </fieldset>

    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="h-section mb-2 text-lg">
        Location
      </legend>
      <UiField
        label="Venue name *"
        :error="errors.venue_name"
      >
        <input
          v-model="form.venue_name"
          type="text"
          class="ctl"
          :class="{ 'ctl-error': errors.venue_name }"
          placeholder="[Venue name]"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField :label="isEdit ? 'City / province' : 'City'">
          <input
            v-model="form.city"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField label="Hall / room">
          <input
            v-model="form.hall_room"
            type="text"
            class="ctl"
            placeholder="Optional"
          >
        </UiField>
      </div>
      <UiField
        v-if="isEdit"
        label="Street address"
      >
        <input
          v-model="form.street_address"
          type="text"
          class="ctl"
        >
      </UiField>
      <UiField :label="isEdit ? 'Loading / venue notes' : 'Address / loading-dock notes'">
        <textarea
          v-model="form.loading_notes"
          rows="2"
          class="ctl"
          placeholder="e.g. Loading via basement B2, gate pass needed"
        />
      </UiField>
    </fieldset>

    <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Status
      </legend>
      <UiSegmented
        v-model="form.status"
        name="event-status"
        :options="[{ value: 'draft', label: 'Draft' }, { value: 'confirmed', label: 'Confirmed (upcoming)' }]"
      />
      <span class="help">{{ isEdit ? 'Shown as Ongoing between the start and end dates. It becomes Completed when you use "Close event & check returns".' : 'Drafts are hidden from crew and can\'t be scanned into.' }}</span>
    </fieldset>

    <UiField label="Notes for crew">
      <textarea
        v-model="form.crew_notes"
        rows="3"
        class="ctl"
        placeholder="Dress code, parking, power setup…"
      />
    </UiField>

    <div
      v-if="!isEdit"
      class="rounded-lg bg-[#E6ECF6] p-3.5 text-sm text-[#244677]"
    >
      <div class="eyebrow mb-1">
        Next, on the event page
      </div>
      Scan or add equipment · assign crew with per-event rates · set allowances.
    </div>

    <div
      v-if="isEdit && event!.can_cancel"
      class="flex flex-col gap-2.5 rounded-lg border-2 border-[#C4141C] p-4"
    >
      <h3 class="h-section m-0 text-lg text-[#B4121A]">
        Cancel this event
      </h3>
      <p class="m-0 text-sm">
        Releases its equipment back to Available and unassigns its crew. Days already worked stay in payroll. You'll be asked for a reason.
      </p>
      <button
        type="button"
        class="btn btn-red-text self-start"
        @click="cancelOpen = true"
      >
        Cancel event…
      </button>
      <EventsCancelEventModal
        v-model:open="cancelOpen"
        :event="event!"
        @cancelled="onCancelled"
      />
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        {{ isEdit ? 'Discard changes' : 'Cancel' }}
      </button>
      <button
        v-if="!isEdit"
        type="button"
        class="btn btn-outline-blue"
        :disabled="busy"
        @click="save('draft')"
      >
        Save as draft
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save()"
      >
        {{ isEdit ? 'Save changes' : 'Create event' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
