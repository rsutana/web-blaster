<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * Fields for a new case or box: its own ID and QR label, and items scanned in right away.
 * `vehicleId` puts it on a truck (Cargo); there's no truck picker here. The parent panel owns the
 * footer and calls `save()`.
 */
const props = defineProps<{ vehicleId?: number | null, name?: string }>()
const api = useApi()
const { notify, success, fail } = useNotify()

const TYPES = [{ value: 'road_case', label: 'Road case' }, { value: 'box', label: 'Box' }, { value: 'rack', label: 'Rack' }, { value: 'bag', label: 'Bag' }]
const blank = () => ({ name: props.name ?? '', type: 'road_case', notes: '' })
const form = reactive(blank())
/** Items scanned in so far, packed into the case when it's saved. */
const packing = ref<{ code: string, name: string | null }[]>([])
const codes = computed(() => packing.value.map(p => p.code))
const checking = ref(false)
const errors = ref<Record<string, string>>({})
const busy = ref(false)

const canSave = computed(() => !!form.name.trim() && !busy.value)

/** Clear the form for a fresh case. */
async function reset() {
  Object.assign(form, blank())
  packing.value = []
  errors.value = {}
}

/** Look the scanned item up so the person scanning sees right away whether it counts. */
async function addCode(code: string) {
  const c = code.trim().toUpperCase()
  if (!c) {
    return
  }
  if (codes.value.includes(c)) {
    notify({ title: 'Already listed', description: `${c} is already in this case.` })
    return
  }
  checking.value = true
  try {
    const item = (await api.get<{ data: Row }>(`/equipment/${c}`)).data
    if (item.case) {
      fail({ title: 'In another case', description: `${c} · ${item.name} is in ${item.case.code}. Take it out there first.` })
      return
    }
    packing.value = [...packing.value, { code: c, name: item.name }]
    success({ title: 'Added to case', description: `${c} · ${item.name}` })
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 404) {
      fail({ title: 'Not found', description: `No item with the ID ${c}.` })
    } else if (status === 403) {
      packing.value = [...packing.value, { code: c, name: null }]
      success({ title: 'Added to case', description: c })
    } else {
      fail(e)
    }
  } finally {
    checking.value = false
  }
}

function removeCode(c: string) {
  packing.value = packing.value.filter(p => p.code !== c)
  notify({ title: 'Removed', description: `${c} taken out of the case.` })
}

/** Create the case with everything scanned packed inside. Returns null when the API refused (errors show on the fields). */
async function save(): Promise<{ cases: Row[], packed: string[] } | null> {
  busy.value = true
  errors.value = {}
  try {
    const res = await api.post<{ data: Row, meta?: Row }>('/containers', {
      name: form.name.trim(),
      type: form.type,
      vehicle_id: props.vehicleId ?? null,
      notes: form.notes.trim() || null,
      ...(codes.value.length ? { codes: codes.value } : {})
    })
    return { cases: [res.data], packed: res.meta?.packed?.packed ?? [] }
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
    return null
  } finally {
    busy.value = false
  }
}

defineExpose({ save, reset, canSave, busy })
</script>

<template>
  <div class="flex flex-col gap-4">
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

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold">Items inside <span class="font-normal text-[#565B66]">(optional)</span></span>
        <span
          class="badge"
          :class="packing.length ? 'bg-[#E6ECF6] text-[#244677]' : 'bg-[#ECEEF1] text-[#565B66]'"
          aria-live="polite"
        >{{ plural(packing.length, 'item') }}</span>
      </div>
      <LogisticsCodeScanner
        :busy="busy || checking"
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
        v-if="packing.length"
        class="flex flex-wrap gap-1.5"
        aria-label="Items to pack"
      >
        <span
          v-for="p in packing"
          :key="p.code"
          class="badge gap-1 bg-[#ECEEF1] text-[#3B3F47]"
        ><span class="font-mono">{{ p.code }}</span><span v-if="p.name">· {{ p.name }}</span><button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 leading-none text-[#565B66]"
          :aria-label="`Remove ${p.code}`"
          @click="removeCode(p.code)"
        ><UIcon
          name="i-lucide-x"
          class="size-3.5"
        /></button></span>
      </div>
    </div>

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
