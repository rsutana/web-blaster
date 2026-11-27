<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * Fields for a new case or box: its own ID and QR label, an optional truck, and items scanned in
 * right away. The parent panel owns the footer and calls `save()`.
 */
const props = defineProps<{ vehicleId?: number | null, name?: string }>()
const api = useApi()
const { fail } = useNotify()

const TYPES = [{ value: 'road_case', label: 'Road case' }, { value: 'box', label: 'Box' }, { value: 'rack', label: 'Rack' }, { value: 'bag', label: 'Bag' }]
const blank = () => ({ name: props.name ?? '', type: 'road_case', quantity: 1, vehicle_id: props.vehicleId ?? null as number | null, notes: '' })
const form = reactive(blank())
const codes = ref<string[]>([])
const trucks = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)

const canSave = computed(() => !!form.name.trim() && !busy.value)
const single = computed(() => Number(form.quantity) === 1)

/** Clear the form for a fresh case, keeping the truck the panel was opened for. */
async function reset() {
  Object.assign(form, blank())
  codes.value = []
  errors.value = {}
  trucks.value = (await api.get<{ data: Row[] }>('/vehicles').catch(() => ({ data: [] as Row[] }))).data.filter(t => t.is_active || t.id === form.vehicle_id)
}

function addCode(code: string) {
  const c = code.trim().toUpperCase()
  if (c && !codes.value.includes(c)) {
    codes.value = [...codes.value, c]
  }
}

/** Create the case(s). Returns them, or null when the API refused (errors are shown on the fields). */
async function save(): Promise<{ cases: Row[], packed: string[] } | null> {
  busy.value = true
  errors.value = {}
  const cases: Row[] = []
  let packed: string[] = []
  try {
    const count = Math.max(1, Math.min(20, Number(form.quantity) || 1))
    for (let i = 0; i < count; i++) {
      const res = await api.post<{ data: Row, meta?: Row }>('/containers', {
        name: form.name.trim(),
        type: form.type,
        vehicle_id: form.vehicle_id,
        notes: form.notes.trim() || null,
        ...(count === 1 && codes.value.length ? { codes: codes.value } : {})
      })
      cases.push(res.data)
      packed = res.meta?.packed?.packed ?? packed
    }
    return { cases, packed }
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
    return cases.length ? { cases, packed } : null
  } finally {
    busy.value = false
  }
}

defineExpose({ save, reset, canSave, busy })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-[1fr_96px] gap-3">
      <UiField
        label="Case name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
          placeholder="PAR LED case"
        >
      </UiField>
      <UiField
        label="How many"
        :error="errors.quantity"
      >
        <input
          v-model.number="form.quantity"
          type="number"
          min="1"
          max="20"
          inputmode="numeric"
          class="ctl"
        >
      </UiField>
    </div>
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Type
      </legend>
      <UiSegmented
        v-model="form.type"
        name="case-type"
        :options="TYPES"
      />
    </fieldset>
    <UiField
      label="Truck"
      optional
      :error="errors.vehicle_id"
      help="The case rides on this truck by default and goes with it when the truck is booked."
    >
      <select
        v-model="form.vehicle_id"
        class="ctl"
      >
        <option :value="null">
          No truck yet
        </option>
        <option
          v-for="t in trucks"
          :key="t.id"
          :value="t.id"
        >
          {{ t.label }}
        </option>
      </select>
    </UiField>

    <div
      v-if="single"
      class="flex flex-col gap-2"
    >
      <span class="text-sm font-semibold">Pack items now <span class="font-normal text-[#565B66]">(optional)</span></span>
      <LogisticsCodeScanner
        :busy="busy"
        placeholder="Item ID, e.g. PAR-001"
        hint="Scan each item going into the case. Each keeps its own ID."
        @code="addCode"
      />
      <p
        v-if="errors.codes"
        role="alert"
        class="err m-0"
      >
        {{ errors.codes }}
      </p>
      <div
        v-if="codes.length"
        class="flex flex-wrap gap-1.5"
      >
        <span
          v-for="c in codes"
          :key="c"
          class="badge gap-1 bg-[#ECEEF1] font-mono text-[#3B3F47]"
        >{{ c }}<button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 leading-none text-[#565B66]"
          :aria-label="`Remove ${c}`"
          @click="codes = codes.filter(x => x !== c)"
        ><UIcon
          name="i-lucide-x"
          class="size-3.5"
        /></button></span>
      </div>
    </div>
    <p
      v-else
      class="help m-0"
    >
      Each case gets its own CASE- ID and QR label. Pack items into each one from Cargo or the case page.
    </p>

    <UiField
      label="Notes"
      optional
    >
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. 12 slots, foam insert"
      />
    </UiField>
  </div>
</template>
