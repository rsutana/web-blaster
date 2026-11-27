<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ truck: Row | null, onTruck: number[], hasDriver: boolean }>()
const emit = defineEmits<{ saved: [cargo: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { notify, fail } = useNotify()

const people = ref<Row[]>([])
const query = ref('')
const picked = ref<number | null>(null)
const role = ref<'driver' | 'helper'>('helper')
const errors = ref<Record<string, string>>({})
const busy = ref(false)

/** Active crew not already on this truck; drivers first when the seat is open. */
const choices = computed(() => {
  const q = query.value.trim().toLowerCase()
  return people.value
    .filter(p => p.status === 'active' && !props.onTruck.includes(p.id))
    .filter(p => !q || `${p.full_name} ${p.usual_role_label}`.toLowerCase().includes(q))
    .sort((a, b) => (role.value === 'driver' ? Number(b.usual_role === 'driver') - Number(a.usual_role === 'driver') : 0) || a.full_name.localeCompare(b.full_name))
})

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  query.value = ''
  picked.value = null
  role.value = props.hasDriver ? 'helper' : 'driver'
  people.value = (await api.get<{ data: Row[] }>('/personnel').catch(() => ({ data: [] as Row[] }))).data
})

async function save() {
  if (!props.truck || !picked.value) {
    return
  }
  busy.value = true
  errors.value = {}
  try {
    const res = await api.post<{ data: Row }>(`/vehicles/${props.truck.id}/crew`, { personnel_id: picked.value, role: role.value })
    const name = people.value.find(p => p.id === picked.value)?.full_name ?? 'Crew member'
    open.value = false
    notify(`${name} added to ${props.truck.name} as ${role.value}.`)
    emit('saved', res.data)
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
    :title="`Add crew to ${truck?.name ?? 'truck'}`"
    subtitle="Truck crew join the event and its outbound trip when the truck is booked."
  >
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Seat
      </legend>
      <UiSegmented
        v-model="role"
        name="crew-seat"
        :options="[{ value: 'driver', label: 'Driver', note: hasDriver ? 'Already has one' : 'One per truck' }, { value: 'helper', label: 'Helper' }]"
      />
      <p
        v-if="errors.role"
        class="err"
      >
        {{ errors.role }}
      </p>
    </fieldset>

    <UiField
      label="Crew member *"
      :error="errors.personnel_id"
    >
      <input
        v-model="query"
        type="search"
        class="ctl"
        placeholder="Search by name or role"
        autocomplete="off"
      >
    </UiField>
    <ul
      class="m-0 flex max-h-[50vh] list-none flex-col overflow-y-auto rounded-md border border-[#DADDE3] p-0"
      aria-label="Crew"
    >
      <li
        v-for="p in choices"
        :key="p.id"
        class="border-b border-[#EEF0F2] last:border-b-0"
      >
        <label class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-[#F5F6F8]">
          <input
            v-model="picked"
            type="radio"
            name="crew-pick"
            :value="p.id"
            class="size-5 accent-[#2F5596]"
          >
          <span class="flex flex-col">
            <span class="font-semibold">{{ p.full_name }}</span>
            <span class="text-[13px] text-[#565B66]">{{ p.usual_role_label }}</span>
          </span>
        </label>
      </li>
      <li
        v-if="!choices.length"
        class="px-3 py-4 text-sm text-[#565B66]"
      >
        No one else to add.
      </li>
    </ul>

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
        :disabled="busy || !picked"
        @click="save"
      >
        Add to truck
      </button>
    </template>
  </UiSlidePanel>
</template>
