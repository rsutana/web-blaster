<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row, assignment: Row }>()
const emit = defineEmits<{ saved: [meta: Row, name: string] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const currentId = ref<number>(props.assignment.id)
const data = ref<Row | null>(null)
const days = ref<Row[]>([])
const original = ref<Record<string, string>>({})
const tab = ref<'all' | 'changed'>('all')
const covers = ref<Row[]>([])
const busy = ref(false)
const error = ref('')

const choices = computed(() => props.event.assignments as Row[])

async function load() {
  error.value = ''
  data.value = (await api.get<{ data: Row }>(`/assignments/${currentId.value}/attendance`)).data
  days.value = data.value.days.map((d: Row) => ({ ...d, regular_hours: d.regular_hours ?? Number(data.value!.regular_hours_per_day), cover_personnel_id: d.cover_personnel_id ?? '' }))
  original.value = Object.fromEntries(days.value.map(d => [d.work_date, sig(d)]))
}

watch(open, async (v) => {
  if (v) {
    currentId.value = props.assignment.id
    tab.value = 'all'
    await load()
    covers.value = (await api.get<{ data: Row[] }>(`/events/${props.event.id}/assignable-personnel`)).data.filter(p => p.availability.is_free)
  }
}, { immediate: true })
watch(currentId, () => open.value && load())

const hourly = computed(() => data.value?.rate_type === 'hour')
/** Flat pay is the whole rate once any day is confirmed; hours and OT don't apply. */
const flat = computed(() => data.value?.rate_type === 'flat')
function sig(d: Row): string {
  return [d.status, Number(d.regular_hours ?? 0), Number(d.ot_hours ?? 0), d.absence_reason ?? '', d.cover_personnel_id ?? ''].join('|')
}
const isChanged = (d: Row) => original.value[d.work_date] === undefined || original.value[d.work_date] !== sig(d)
const changedCount = computed(() => days.value.filter(isChanged).length + Object.keys(original.value).filter(k => !days.value.some(d => d.work_date === k)).length)
const shown = computed(() => tab.value === 'all' ? days.value : days.value.filter(isChanged))

function calc(list: Row[]) {
  const a = data.value
  if (!a) {
    return { worked: 0, hours: 0, ot: 0, allowanceDays: 0, base: 0, otAmount: 0, allowance: 0, total: 0 }
  }
  let worked = 0
  let hours = 0
  let ot = 0
  let allowanceDays = 0
  for (const d of list) {
    const f = d.status === 'present' ? 1 : d.status === 'half' ? 0.5 : 0
    if (!f) {
      continue
    }
    worked += f
    hours += Number(d.regular_hours ?? a.regular_hours_per_day * f)
    ot += Number(d.ot_hours ?? 0)
    allowanceDays += 1
  }
  const base = a.rate_type === 'flat' ? (worked ? a.rate : 0) : a.rate_type === 'hour' ? a.rate * hours : a.rate * worked
  const otAmount = a.rate_type === 'flat' ? 0 : ot * a.ot_rate
  const allowance = a.allowance_mode === 'per_day' ? a.allowance_amount * allowanceDays : (allowanceDays ? a.allowance_amount : 0)
  return { worked, hours, ot, allowanceDays, base, otAmount, allowance, total: base + otAmount + allowance }
}
const before = computed(() => calc(days.value.map((d) => {
  const o = original.value[d.work_date]
  if (!o) {
    return { status: 'off' }
  }
  const [status, rh, oh] = o.split('|')
  return { status, regular_hours: Number(rh), ot_hours: Number(oh) }
})))
const after = computed(() => calc(days.value))

function addDay() {
  const extra = data.value?.extra_day
  if (!extra || days.value.some(d => d.work_date === extra.work_date)) {
    return
  }
  days.value.push({ work_date: extra.work_date, label: extra.label, status: 'present', regular_hours: data.value!.regular_hours_per_day, ot_hours: 0, absence_reason: null, cover_personnel_id: '', is_extra_day: true, is_locked: false })
}

function removeDay(d: Row) {
  days.value = days.value.filter(x => x !== d)
}

async function save() {
  busy.value = true
  error.value = ''
  try {
    const res = await api.put<{ data: Row, meta: Row }>(`/assignments/${currentId.value}/attendance`, {
      days: days.value.map(d => ({
        work_date: d.work_date,
        status: d.status,
        regular_hours: hourly.value ? Number(d.regular_hours) : null,
        ot_hours: flat.value ? 0 : Number(d.ot_hours) || 0,
        absence_reason: d.status === 'absent' ? (d.absence_reason || 'sick') : null,
        cover_personnel_id: d.status === 'absent' && d.cover_personnel_id ? Number(d.cover_personnel_id) : null
      }))
    })
    open.value = false
    emit('saved', res.meta, data.value!.name)
  } catch (e) {
    error.value = errorMessage(e)
    fail(e)
  } finally {
    busy.value = false
  }
}

const rateLine = computed(() => {
  const a = data.value
  if (!a) {
    return ''
  }
  return [a.rate_label, a.ot_label !== 'No OT' ? 'OT ' + a.ot_label : null, a.allowance_amount ? `${a.allowance_label ?? 'allowance'} ${peso(a.allowance_amount)} / ${a.allowance_mode === 'per_day' ? 'day worked' : 'event'}` : 'no allowance'].filter(Boolean).join(' · ')
})
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    title="Days & attendance"
    :subtitle="`${event.label} · ${event.short_dates}`"
  >
    <UiField
      label="Person"
      :help="rateLine"
    >
      <select
        v-model="currentId"
        class="ctl"
      >
        <option
          v-for="a in choices"
          :key="a.id"
          :value="a.id"
        >
          {{ a.name }} · {{ a.role }}{{ a.rate_type === 'hour' ? ' (hourly)' : a.rate_type === 'flat' ? ' (flat)' : '' }}
        </option>
      </select>
    </UiField>
    <div
      role="tablist"
      class="flex gap-1.5"
    >
      <button
        v-for="[k, l] in [['all', `All days (${days.length})`], ['changed', `Changed (${changedCount})`]]"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="tab === k"
        class="min-h-10 cursor-pointer rounded-md border px-3.5 text-sm font-semibold"
        :class="tab === k ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#B9BEC7] bg-white'"
        @click="tab = k as typeof tab"
      >
        {{ l }}
      </button>
    </div>
    <p
      v-if="tab === 'changed' && !shown.length"
      class="m-0 text-sm text-[#565B66]"
    >
      No changes yet. Edit a day under All days.
    </p>
    <fieldset
      v-for="d in shown"
      :key="d.work_date"
      class="m-0 flex flex-col gap-3 rounded-lg border-2 p-3.5"
      :class="isChanged(d) ? 'border-[#2F5596]' : 'border-[#DADDE3]'"
      :disabled="d.is_locked"
    >
      <legend class="px-1 text-[15px] font-bold">
        {{ d.label }}<span
          v-if="d.is_extra_day && !original[d.work_date]"
          class="font-semibold text-[#2F5596]"
        > · added</span><span
          v-else-if="isChanged(d)"
          class="font-semibold text-[#2F5596]"
        > · changed</span><span
          v-if="d.is_locked"
          class="font-semibold text-[#6B4100]"
        > · locked by payroll</span>
      </legend>
      <p
        v-if="d.clock || d.clock_missing"
        class="m-0 flex items-center gap-1.5 text-[13px]"
        :class="d.clock ? (d.clock.state === 'en_route' ? 'font-semibold text-[#8F4A00]' : 'font-semibold text-[#1D6B3C]') : d.clock_missing.is_warning ? 'font-semibold text-[#8F4A00]' : 'text-[#565B66]'"
      >
        <UIcon
          name="i-lucide-clock"
          class="size-4 flex-none"
        />{{ d.clock ? d.clock.label : d.clock_missing.label }}<template v-if="d.clock?.by">
          · logged by {{ d.clock.by }}
        </template>
      </p>
      <UiSegmented
        v-model="d.status"
        :name="`st-${d.work_date}`"
        size="sm"
        :options="[{ value: 'present', label: 'Present' }, { value: 'half', label: 'Half day' }, { value: 'absent', label: 'Absent' }, { value: 'off', label: 'Off' }]"
      />
      <div
        v-if="!flat && (d.status === 'present' || d.status === 'half')"
        class="grid grid-cols-2 gap-3"
      >
        <UiField
          v-if="hourly"
          label="Regular hours"
        >
          <input
            v-model="d.regular_hours"
            type="number"
            min="0"
            max="12"
            step="0.5"
            class="ctl"
          >
        </UiField>
        <UiField
          label="OT hours"
          :help="d.clock?.hours ? `Clocked ${num(d.clock.hours)} h` : undefined"
        >
          <input
            v-model="d.ot_hours"
            type="number"
            min="0"
            max="8"
            step="0.5"
            class="ctl"
          >
        </UiField>
      </div>
      <div
        v-if="d.status === 'absent'"
        class="grid grid-cols-2 gap-3"
      >
        <UiField label="Reason">
          <select
            v-model="d.absence_reason"
            class="ctl"
          >
            <option value="sick">
              Sick
            </option><option value="emergency">
              Emergency
            </option><option value="no_show">
              No-show
            </option><option value="excused">
              Excused by admin
            </option>
          </select>
        </UiField>
        <UiField label="Cover with">
          <select
            v-model="d.cover_personnel_id"
            class="ctl"
          >
            <option value="">
              No replacement
            </option>
            <option
              v-for="p in covers"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }} · free that day
            </option>
          </select>
        </UiField>
        <span class="help col-span-2">{{ d.cover_personnel_id ? 'They are added to this event for that day only, with the same rate.' : flat ? 'No replacement. Flat pay still counts if another day is confirmed.' : 'No replacement. The day is simply unpaid.' }}</span>
      </div>
      <button
        v-if="d.is_extra_day"
        type="button"
        class="self-start border-0 bg-transparent p-0 text-sm font-semibold text-[#B4121A] underline"
        @click="removeDay(d)"
      >
        Remove this day
      </button>
    </fieldset>
    <button
      v-if="data?.extra_day && tab === 'all' && !days.some(d => d.work_date === data!.extra_day.work_date)"
      type="button"
      class="btn btn-block min-h-11 border-2 border-dashed border-[#2F5596] bg-[#F3F6FB] font-semibold text-[#2F5596]"
      @click="addDay"
    >
      + Add a day (event extended to {{ data.extra_day.label }})
    </button>

    <div class="flex flex-col gap-2 rounded-lg bg-[#0B0B0C] p-4 text-white">
      <div class="eyebrow text-[#C9CCD2]">
        Pay for this event · live
      </div>
      <div
        v-for="row in [
          [hourly ? 'Hours worked' : 'Days worked', num(before.hours && hourly ? before.hours : before.worked), num(hourly ? after.hours : after.worked)],
          [`Base ${data?.rate_label ?? ''}`, peso(before.base), peso(after.base)],
          ...(flat ? [] : [[`OT ${data?.ot_label ?? ''} · ${num(after.ot)} hrs`, peso(before.otAmount), peso(after.otAmount)]]),
          ...(data?.allowance_amount ? [[`${data?.allowance_label ?? 'Allowance'} ${peso(data!.allowance_amount)} / ${data!.allowance_mode === 'per_day' ? 'day' : 'event'}`, peso(before.allowance), peso(after.allowance)]] : [])
        ]"
        :key="row[0]"
        class="flex justify-between gap-2 text-sm"
      >
        <span class="text-[#C9CCD2]">{{ row[0] }}</span>
        <span><s
          v-if="row[1] !== row[2]"
          class="mr-2 text-[#9EA3AD]"
        >{{ row[1] }}</s>{{ row[2] }}</span>
      </div>
      <div class="flex justify-between border-t border-[#3B3F47] pt-2 text-xl font-bold">
        <span>Event pay</span>
        <span><s
          v-if="before.total !== after.total"
          class="mr-2 text-base text-[#9EA3AD]"
        >{{ peso(before.total) }}</s>{{ peso(after.total) }}</span>
      </div>
    </div>
    <p class="m-0 text-[13px] text-[#565B66]">
      Each change is logged with who made it and when (set automatically). Once the payroll run for these days is finalized they lock; reopen the run to change them.
    </p>
    <p
      v-if="error"
      role="alert"
      class="err m-0"
    >
      {{ error }}
    </p>

    <template #footer>
      <span class="mr-auto text-sm font-semibold">{{ changedCount ? `${plural(changedCount, 'day')} changed · ${peso(before.total)} → ${peso(after.total)}` : 'No changes yet' }}</span>
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
        :disabled="!changedCount || busy"
        @click="save"
      >
        Save changes
      </button>
    </template>
  </UiSlidePanel>
</template>
