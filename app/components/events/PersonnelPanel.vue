<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row, assignment?: Row | null }>()
const emit = defineEmits<{ saved: [name: string, isNew: boolean, pin?: string | null] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const people = ref<Row[]>([])
const who = ref<'registered' | 'new'>('registered')
const search = ref('')
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const form = reactive({
  personnel_id: null as number | null,
  role: '',
  rate_type: 'flat',
  rate: '600',
  regular_hours_per_day: '8',
  ot_rate: '0',
  allowance_amount: '',
  allowance_mode: 'per_event',
  allowance_label: '',
  dates: [] as string[]
})
const newPerson = reactive({ full_name: '', mobile: '', pay_schedule: 'semi_monthly', payout_method: 'gcash', is_listed: true, create_login: false })
const isEdit = computed(() => !!props.assignment)

const ROLE_LABEL: Record<string, string> = { audio_engineer: 'Audio engineer', driver: 'Driver', event_lead: 'Event lead', lights: 'Lights', rigger: 'Rigger', sound_tech: 'Sound tech', stagehand: 'Stagehand', utility: 'Utility', video_tech: 'Video tech' }

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  search.value = ''
  who.value = 'registered'
  Object.assign(newPerson, { full_name: '', mobile: '', pay_schedule: 'semi_monthly', payout_method: 'gcash', is_listed: true, create_login: false })
  const a = props.assignment
  if (a) {
    Object.assign(form, {
      personnel_id: a.personnel_id, role: a.role, rate_type: a.rate_type, rate: String(a.rate ?? ''), regular_hours_per_day: String(a.regular_hours_per_day),
      ot_rate: String(a.ot_rate ?? 0), allowance_amount: Number(a.allowance_amount) ? String(a.allowance_amount) : '', allowance_mode: a.allowance_mode, allowance_label: a.allowance_label ?? '', dates: [...a.dates]
    })
  } else {
    Object.assign(form, { personnel_id: null, role: '', rate_type: 'flat', rate: '600', regular_hours_per_day: '8', ot_rate: '0', allowance_amount: '', allowance_mode: 'per_event', allowance_label: '', dates: [...props.event.dates] })
    people.value = (await api.get<{ data: Row[] }>(`/events/${props.event.id}/assignable-personnel`)).data
  }
})

const list = computed(() => {
  const q = search.value.trim().toLowerCase()
  return people.value.filter(p => !q || `${p.name} ${p.usual_role_label} ${p.mobile}`.toLowerCase().includes(q))
})
const chosen = computed(() => people.value.find(p => p.id === form.personnel_id))

function pick(p: Row) {
  if (p.availability.is_disabled) {
    return
  }
  form.personnel_id = p.id
  form.role = p.usual_role_label
  if (p.last_rate) {
    form.rate = String(p.last_rate)
  }
}

watch(() => form.rate_type, (t) => {
  if (t === 'flat') {
    form.ot_rate = '0'
    form.allowance_mode = 'per_event'
  }
})

const days = computed(() => form.dates.length)
const estimate = computed(() => {
  const rate = Number(form.rate) || 0
  const base = form.rate_type === 'day' ? rate * days.value : form.rate_type === 'hour' ? rate * (Number(form.regular_hours_per_day) || 8) * days.value : rate
  const allowance = form.allowance_mode === 'per_day' ? (Number(form.allowance_amount) || 0) * days.value : (Number(form.allowance_amount) || 0)
  return { base, allowance, total: base + allowance }
})
const rateLabel = computed(() => ({ day: 'Rate (₱ / day)', hour: 'Rate (₱ / hour)', flat: 'Flat (₱ / event)' } as Record<string, string>)[form.rate_type] ?? 'Rate')

async function save() {
  busy.value = true
  errors.value = {}
  const body: Row = { ...form, rate: Number(form.rate) || 0, ot_rate: Number(form.ot_rate) || 0, allowance_amount: Number(form.allowance_amount) || 0, regular_hours_per_day: Number(form.regular_hours_per_day) || 8 }
  try {
    if (isEdit.value) {
      delete body.personnel_id
      await api.patch(`/assignments/${props.assignment!.id}`, body)
      open.value = false
      emit('saved', props.assignment!.name, false)
      return
    }
    if (who.value === 'new') {
      body.personnel_id = null
      body.new_person = { ...newPerson, usual_role: Object.entries(ROLE_LABEL).find(([, l]) => l === form.role)?.[0] }
    }
    const res = await api.post<{ data: Row, meta?: { temporary_pin?: string | null } }>(`/events/${props.event.id}/assignments`, body)
    open.value = false
    emit('saved', res.data.name, true, res.meta?.temporary_pin)
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
    :title="isEdit ? 'Edit personnel' : 'Add personnel'"
    :subtitle="`${event.label} · ${event.short_dates}`"
  >
    <template v-if="!isEdit">
      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-1.5 text-sm font-semibold">
          Who
        </legend>
        <UiSegmented
          v-model="who"
          name="who"
          :options="[{ value: 'registered', label: 'Registered personnel' }, { value: 'new', label: 'New person' }]"
        />
      </fieldset>
      <template v-if="who === 'registered'">
        <input
          v-model="search"
          type="search"
          class="ctl"
          placeholder="Name, role or phone…"
          aria-label="Search personnel"
        >
        <span
          v-if="errors.personnel_id"
          role="alert"
          class="err"
        >{{ errors.personnel_id }}</span>
        <div
          role="radiogroup"
          aria-label="Pick a person"
          class="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-[#DADDE3] p-1"
        >
          <label
            v-for="p in list"
            :key="p.id"
            class="flex min-h-14 cursor-pointer items-center gap-2.5 rounded px-2.5 py-2"
            :class="[form.personnel_id === p.id ? 'bg-[#F3F6FB] outline-2 outline-[#2F5596]' : '', p.availability.is_disabled ? 'cursor-not-allowed text-[#565B66]' : '']"
          >
            <input
              type="radio"
              name="person"
              :checked="form.personnel_id === p.id"
              :disabled="p.availability.is_disabled"
              class="size-5 accent-[#2F5596]"
              @change="pick(p)"
            >
            <span class="min-w-0 flex-1">
              <b>{{ p.name }}</b> · {{ p.usual_role_label }}
              <span class="block text-[13px] text-[#565B66]">{{ p.meta }}</span>
            </span>
            <span
              class="max-w-[150px] text-right text-xs font-bold tracking-[.03em] uppercase"
              :class="p.availability.is_free ? 'text-[#1D6B3C]' : p.availability.is_disabled ? 'text-[#565B66]' : 'text-[#6B4100]'"
            >{{ p.availability.label }}</span>
          </label>
        </div>
        <div
          v-if="chosen && chosen.other_rates.length"
          class="rounded-md bg-[#E6ECF6] p-3 text-sm text-[#244677]"
        >
          {{ chosen.name }}'s other rates: {{ chosen.other_rates.join(' · ') }}. This event's rate won't change them. <NuxtLink
            :to="`/personnel/${chosen.id}`"
            class="font-semibold"
          >View profile</NuxtLink>
        </div>
      </template>
      <div
        v-else
        class="flex flex-col gap-3.5 rounded-lg bg-[#F2F3F5] p-3.5"
      >
        <UiField
          label="Full name *"
          :error="errors['new_person.full_name']"
        >
          <input
            v-model="newPerson.full_name"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField
          label="Mobile no. *"
          :error="errors['new_person.mobile']"
        >
          <input
            v-model="newPerson.mobile"
            type="tel"
            inputmode="numeric"
            maxlength="13"
            placeholder="09XX XXX XXXX"
            class="ctl"
          >
        </UiField>
        <div class="grid grid-cols-2 gap-3">
          <UiField label="Pay schedule">
            <select
              v-model="newPerson.pay_schedule"
              class="ctl"
            >
              <option value="daily">
                Daily
              </option><option value="weekly">
                Weekly
              </option><option value="semi_monthly">
                Every 15 days
              </option><option value="monthly">
                Monthly
              </option>
            </select>
          </UiField>
          <UiField label="Payout method">
            <select
              v-model="newPerson.payout_method"
              class="ctl"
            >
              <option value="cash">
                Cash
              </option><option value="gcash">
                GCash
              </option><option value="maya">
                Maya
              </option><option value="bank_transfer">
                Bank transfer
              </option>
            </select>
          </UiField>
        </div>
        <label class="flex items-start gap-2.5 text-[15px] font-semibold">
          <input
            v-model="newPerson.is_listed"
            type="checkbox"
            class="mt-0.5 size-5 accent-[#2F5596]"
          >
          <span>Save to the Personnel list<span class="help block">Leave unchecked for a one-time helper: they're still on this event and in payroll, just hidden from the list.</span></span>
        </label>
        <label class="flex items-center gap-2.5 text-[15px] font-semibold">
          <input
            v-model="newPerson.create_login"
            type="checkbox"
            class="size-5 accent-[#2F5596]"
          > Create a Crew login (you give them a temporary PIN)
        </label>
      </div>
    </template>

    <UiField
      label="Role on this event"
      :error="errors.role"
    >
      <input
        v-model="form.role"
        type="text"
        class="ctl"
        placeholder="e.g. Sound tech"
      >
    </UiField>

    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0">
      <legend class="h-section mb-2 text-lg">
        Pay on this event
      </legend>
      <UiSegmented
        v-model="form.rate_type"
        name="rate-type"
        :options="[{ value: 'flat', label: 'Flat / event' }, { value: 'day', label: 'Per day' }, { value: 'hour', label: 'Per hour' }]"
      />
      <div class="grid grid-cols-3 gap-3">
        <UiField
          :label="rateLabel"
          :error="errors.rate"
        >
          <input
            v-model="form.rate"
            inputmode="decimal"
            class="ctl"
          >
        </UiField>
        <UiField label="Regular hrs / day">
          <input
            v-model="form.regular_hours_per_day"
            inputmode="decimal"
            class="ctl"
            :disabled="form.rate_type === 'flat'"
          >
        </UiField>
        <UiField label="OT (₱ / hour)">
          <input
            v-model="form.ot_rate"
            inputmode="decimal"
            class="ctl"
            :disabled="form.rate_type === 'flat'"
          >
        </UiField>
      </div>
    </fieldset>

    <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Scheduled days
      </legend>
      <div class="grid grid-cols-3 gap-2">
        <label
          v-for="d in event.dates"
          :key="d"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 px-2.5 text-sm font-semibold"
          :class="form.dates.includes(d) ? 'border-[#2F5596] bg-[#F3F6FB]' : 'border-[#DADDE3]'"
        >
          <input
            v-model="form.dates"
            type="checkbox"
            :value="d"
            class="size-4 accent-[#2F5596]"
          >{{ longDay(d) }}
        </label>
      </div>
      <span class="help">You can change days later or mark someone absent from the event's Attendance. Pay follows the days actually worked.</span>
    </fieldset>

    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Allowance (₱)"
        optional
      >
        <input
          v-model="form.allowance_amount"
          inputmode="decimal"
          class="ctl"
        >
      </UiField>
      <UiField label="Allowance is">
        <select
          v-model="form.allowance_mode"
          class="ctl"
        >
          <option value="per_day">
            Per day worked
          </option>
          <option value="per_event">
            Once per event
          </option>
        </select>
      </UiField>
    </div>
    <UiField
      label="Allowance for"
      optional
    >
      <input
        v-model="form.allowance_label"
        type="text"
        class="ctl"
        placeholder="e.g. meals, transport"
      >
    </UiField>

    <div class="flex items-end justify-between gap-3 rounded-lg bg-[#E6ECF6] p-3.5 text-[#244677]">
      <span class="text-sm">Estimate: {{ form.rate_type === 'flat' ? peso(Number(form.rate) || 0) + ' flat' : `${peso(Number(form.rate) || 0)} × ${plural(days, 'day')}` }}<template v-if="estimate.allowance"> + {{ form.allowance_mode === 'per_day' ? `${peso(Number(form.allowance_amount))} × ${days}` : peso(Number(form.allowance_amount)) }}</template> · OT added from attendance</span>
      <span class="figure text-[30px] text-[#0B0B0C]">{{ peso(estimate.total) }}</span>
    </div>

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
        :disabled="busy || (!isEdit && who === 'registered' && !form.personnel_id)"
        @click="save"
      >
        {{ isEdit ? 'Save changes' : 'Add to event' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
