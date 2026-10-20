<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row, usage: Row }>()
const emit = defineEmits<{ removed: [usage: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const { user, isAdminish, can } = useAuthUser()

const REASONS = {
  broken: { label: 'Broken / damaged', result: 'Under repair', badge: 'Removed · broken', button: 'Remove & send to repair', danger: true, ph: 'e.g. Connector crushed during load-in' },
  worn: { label: 'Worn out', result: 'Retired', badge: 'Removed · worn out', button: 'Remove & retire', danger: true, ph: 'e.g. Cone torn, not worth fixing' },
  lost: { label: 'Lost / missing', result: 'Lost', badge: 'Removed · lost', button: 'Remove & mark lost', danger: true, ph: 'e.g. Not in the truck at pack-out' },
  swap: { label: 'Not needed / swapped', result: 'Available', badge: 'Returned · not needed', button: 'Return to stock', danger: false, ph: 'e.g. Client cut the second stage' }
} as const
type Why = keyof typeof REASONS

const why = ref<Why>('broken')
const note = ref('')
const useSpare = ref(true)
const spareId = ref<number | string>('')
const spares = ref<Row[]>([])
const charge = ref(false)
const chargePerson = ref<number | string>('')
const chargeAmount = ref('150')
const busy = ref(false)

const reason = computed(() => REASONS[why.value])
const canCharge = computed(() => isAdminish.value && can('payroll', 'edit'))

watch(open, async (v) => {
  if (!v) {
    return
  }
  why.value = 'broken'
  note.value = ''
  useSpare.value = true
  charge.value = false
  chargeAmount.value = '150'
  chargePerson.value = props.event.assignments[0]?.personnel_id ?? ''
  const all = (await api.get<{ data: Row[] }>(`/events/${props.event.id}/available-equipment`)).data
  const cat = all.find(i => i.code === props.usage.code)?.category
  spares.value = all.filter(i => !i.is_blocked && i.category === cat && i.code !== props.usage.code)
  const sameName = spares.value.find(s => s.name === props.usage.name)
  spareId.value = (sameName ?? spares.value[0])?.id ?? ''
}, { immediate: true })

async function confirm() {
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>(`/usages/${props.usage.id}/removal`, {
      reason: why.value,
      note: note.value || null,
      spare_item_id: why.value !== 'swap' && useSpare.value && spareId.value ? Number(spareId.value) : null,
      charge: canCharge.value && charge.value && ['broken', 'lost'].includes(why.value) && chargePerson.value ? { personnel_id: Number(chargePerson.value), amount: Number(chargeAmount.value) } : null
    })
    open.value = false
    emit('removed', res.data)
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
    :width="720"
    title="Remove from event"
  >
    <template #subtitle>
      <span class="font-mono text-white">{{ usage.code }}</span> · {{ usage.name }} · {{ event.label }} · added by {{ usage.added_by }}
    </template>
    <div class="grid gap-5 md:grid-cols-2">
      <div class="flex flex-col gap-4">
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="mb-1.5 text-sm font-semibold">
            Reason *
          </legend>
          <label
            v-for="(r, key) in REASONS"
            :key="key"
            class="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border-2 px-3 py-2"
            :class="why === key ? 'border-[#2F5596] bg-[#F3F6FB]' : 'border-[#DADDE3]'"
          >
            <input
              v-model="why"
              type="radio"
              name="why"
              :value="key"
              class="size-[18px] accent-[#2F5596]"
            >
            <span class="flex-1 text-[15px] font-semibold">{{ r.label }}</span>
            <span class="text-[13px] text-[#565B66]">→ {{ r.result }}</span>
          </label>
        </fieldset>
        <UiField label="What happened?">
          <textarea
            v-model="note"
            rows="3"
            class="ctl"
            :placeholder="reason.ph"
          />
        </UiField>
        <p class="m-0 text-[13px] text-[#565B66]">
          Recorded as <b class="text-[#0B0B0C]">{{ user?.name }} (you)</b> when you save. Set automatically from your sign-in.
        </p>
      </div>
      <div class="flex flex-col gap-4">
        <div class="rounded-lg bg-[#F2F3F5] p-3.5 text-sm">
          <div class="eyebrow mb-1.5 text-[#565B66]">
            What happens
          </div>
          <ul class="m-0 flex flex-col gap-1 pl-4">
            <li>Leaves {{ event.label }}'s active list. The row stays as "{{ reason.badge }}".</li>
            <li>Item status becomes <b>{{ reason.result }}</b>.</li>
            <li>Logged in {{ usage.code }}'s history with reason, who and when.</li>
          </ul>
        </div>
        <div
          v-if="why !== 'swap'"
          class="flex flex-col gap-2"
        >
          <div class="text-sm font-semibold">
            Replace with a spare
          </div>
          <label class="flex items-center gap-2.5 text-[15px]">
            <input
              v-model="useSpare"
              type="checkbox"
              class="size-5 accent-[#2F5596]"
            > Add a spare to this event
          </label>
          <select
            v-if="useSpare"
            v-model="spareId"
            class="ctl"
            aria-label="Spare item"
          >
            <option
              v-if="!spares.length"
              value=""
            >
              No available spare in this category
            </option>
            <option
              v-for="s in spares"
              :key="s.id"
              :value="s.id"
            >
              {{ s.code }} · {{ s.name }} · {{ s.where.split(' · ').slice(1).join(' · ') }}
            </option>
          </select>
          <span class="help">Only Available items not booked on overlapping events are listed.</span>
        </div>
        <div
          v-if="canCharge && (why === 'broken' || why === 'lost')"
          class="flex flex-col gap-2"
        >
          <div class="text-sm font-semibold">
            Charge to personnel (optional)
          </div>
          <label class="flex items-center gap-2.5 text-[15px]">
            <input
              v-model="charge"
              type="checkbox"
              class="size-5 accent-[#2F5596]"
            > Add a deduction
          </label>
          <div
            v-if="charge"
            class="grid grid-cols-[1fr_120px] gap-2"
          >
            <select
              v-model="chargePerson"
              class="ctl"
              aria-label="Person"
            >
              <option
                v-for="a in event.assignments"
                :key="a.personnel_id"
                :value="a.personnel_id"
              >
                {{ a.name }}
              </option>
            </select>
            <input
              v-model="chargeAmount"
              inputmode="decimal"
              class="ctl"
              aria-label="Amount (₱)"
            >
          </div>
          <span class="help">Comes off their next payroll as an "other deduction".</span>
        </div>
      </div>
    </div>
    <template #footer>
      <span class="mr-auto text-[13px] text-[#565B66]">Nothing is deleted. Crew report the same thing from the phone.</span>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn"
        :class="reason.danger ? 'btn-danger' : 'btn-primary'"
        :disabled="busy"
        @click="confirm"
      >
        {{ reason.button }}
      </button>
    </template>
  </UiDialog>
</template>
