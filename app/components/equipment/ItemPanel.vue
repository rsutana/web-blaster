<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ item?: Row | null }>()
const emit = defineEmits<{ saved: [items: Row[], isNew: boolean, print: boolean, again: boolean], statusChanged: [status: string, note: string, previous: string] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const CATS = [['audio', 'Audio'], ['lighting', 'Lighting'], ['cables', 'Cables'], ['stage_truss', 'Stage & truss'], ['power', 'Power'], ['video', 'Video'], ['other', 'Other']]
const blank = () => ({ name: '', category: 'audio', prefix: 'SPK', quantity: 1, brand: '', model: '', serial_no: '', home_location: 'Warehouse · Shelf A2', condition: 'good', rental_rate: '', rate_per_event: '', replacement_value: '', purchase_cost: '', purchase_date: '', notes: '' })
const form = reactive(blank())
const photo = ref<File | null>(null)
const photoUrl = ref<string | null>(null)
const codes = ref<string[]>([])
const printLabels = ref(true)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const statusOpen = ref(false)
const changed = ref<{ status: string, note: string } | null>(null)
const isEdit = computed(() => !!props.item)

watch(open, (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  photo.value = null
  changed.value = null
  Object.assign(form, blank())
  photoUrl.value = props.item?.photo_url ?? null
  if (props.item) {
    const i = props.item
    const m = (n: number | null) => n === null || n === undefined ? '' : Number(n).toLocaleString('en-PH')
    Object.assign(form, { name: i.name, category: i.category, brand: i.brand ?? '', model: i.model ?? '', serial_no: i.serial_no ?? '', home_location: i.home_location ?? '', condition: i.condition, rental_rate: m(i.rental_rate), rate_per_event: m(i.rate_per_event), replacement_value: m(i.replacement_value), purchase_cost: m(i.purchase_cost), purchase_date: i.purchase_date ?? '', notes: i.notes ?? '' })
  }
}, { immediate: true })

let timer: ReturnType<typeof setTimeout> | undefined
watch(() => [form.prefix, form.quantity, open.value], () => {
  if (isEdit.value || !open.value) {
    return
  }
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const res = await api.get<{ data: { prefix: string, codes: string[] } }>('/equipment-codes', { prefix: form.prefix, quantity: Math.max(1, Math.min(50, Number(form.quantity) || 1)) })
    codes.value = res.data.codes
  }, 200)
}, { immediate: true })

const preview = computed(() => codes.value.length > 4 ? codes.value.slice(0, 4).join(' · ') + ' … ' + codes.value[codes.value.length - 1] : codes.value.join(' · '))

function onPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) {
    photo.value = f
    photoUrl.value = URL.createObjectURL(f)
  }
}

async function save(again = false) {
  busy.value = true
  errors.value = {}
  const fd = new FormData()
  const data: Row = { ...form }
  if (isEdit.value) {
    delete data.prefix
    delete data.quantity
  } else {
    data.prefix = String(form.prefix).replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'ITM'
    data.quantity = Math.max(1, Math.min(50, Number(form.quantity) || 1))
  }
  for (const [k, v] of Object.entries(data)) {
    if (v !== '' && v !== null) {
      fd.append(k, String(v))
    } else if (isEdit.value) {
      fd.append(k, '')
    }
  }
  if (photo.value) {
    fd.append('photo', photo.value)
  }
  try {
    if (isEdit.value) {
      fd.append('_method', 'PATCH')
      const res = await api.post<{ data: Row }>(`/equipment/${props.item!.code}`, fd)
      open.value = false
      emit('saved', [res.data], false, false, false)
    } else {
      const res = await api.post<{ data: Row[] }>('/equipment', fd)
      emit('saved', res.data, true, printLabels.value, again)
      if (again) {
        Object.assign(form, { ...blank(), category: form.category, prefix: form.prefix, home_location: form.home_location })
        photo.value = null
        photoUrl.value = null
      } else {
        open.value = false
      }
    }
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}

function onStatus(status: string, note: string, previous: string) {
  changed.value = { status, note }
  emit('statusChanged', status, note, previous)
}

const statusNow = computed(() => changed.value?.status ?? props.item?.status)
const whereNow = computed(() => {
  if (!changed.value) {
    return props.item?.where?.line ?? ''
  }
  return ({ available: `In stock · ${props.item?.home_location ?? ''}`, under_repair: 'Repair shelf', lost: 'Missing', retired: 'Out of service' } as Record<string, string>)[changed.value.status] ?? ''
})
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isEdit ? 'Edit equipment' : 'Add equipment'"
    :subtitle="isEdit ? `${item!.code} · used ${item!.used_count ?? 0} times${item!.last_scan ? ' · last scan ' + item!.last_scan.who + ', ' + item!.last_scan.date : ''}` : 'Each item gets its own ID and QR label.'"
  >
    <div
      v-if="isEdit"
      class="flex flex-col gap-2.5 rounded-lg border-2 border-[#0B0B0C] p-3.5"
    >
      <div class="flex items-center gap-2.5">
        <h3 class="h-section m-0 text-lg">
          Status
        </h3>
        <UiBadge
          :tone="EQUIPMENT_STATUS[statusNow!]!.tone"
          :label="EQUIPMENT_STATUS[statusNow!]!.label"
        />
      </div>
      <p class="m-0 text-sm text-[#565B66]">
        {{ whereNow }}
      </p>
      <div
        v-if="changed"
        class="rounded-md bg-[#E6ECF6] p-2.5 text-sm text-[#244677]"
      >
        Status changed to {{ EQUIPMENT_STATUS[changed.status]!.label }}{{ changed.note ? ` · "${changed.note}"` : '' }}. Saved to history.
      </div>
      <button
        v-else
        type="button"
        class="btn btn-dark btn-sm self-start"
        @click="statusOpen = true"
      >
        Change status…
      </button>
      <EquipmentChangeStatusModal
        v-model:open="statusOpen"
        :item="item!"
        @changed="onStatus"
      />
    </div>

    <label class="flex cursor-pointer items-center gap-3">
      <span
        class="flex size-[84px] flex-none items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-center text-xs text-[#565B66]"
      >
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt=""
          class="size-full object-cover"
        >
        <template v-else>+ Photo</template>
      </span>
      <span class="btn btn-secondary btn-sm">{{ photoUrl ? 'Replace photo' : 'Add a photo (optional)' }}</span>
      <input
        type="file"
        accept="image/*"
        class="sr-only"
        @change="onPhoto"
      >
    </label>

    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Item name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
          :class="{ 'ctl-error': errors.name }"
          placeholder="Line array speaker"
        >
      </UiField>
      <UiField label="Category *">
        <select
          v-model="form.category"
          class="ctl"
        >
          <option
            v-for="[v, l] in CATS"
            :key="v"
            :value="v"
          >
            {{ l }}
          </option>
        </select>
      </UiField>
    </div>

    <template v-if="!isEdit">
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="ID prefix"
          :error="errors.prefix"
        >
          <input
            v-model="form.prefix"
            type="text"
            maxlength="4"
            class="ctl font-mono uppercase"
          >
        </UiField>
        <UiField
          label="Quantity"
          :error="errors.quantity"
        >
          <input
            v-model.number="form.quantity"
            type="number"
            min="1"
            max="50"
            class="ctl"
          >
        </UiField>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold">IDs to be created</span>
        <output class="rounded-md bg-[#0B0B0C] px-3.5 py-3 font-mono text-sm text-white">{{ preview || '…' }}</output>
      </div>
    </template>
    <div
      v-else
      class="flex flex-col gap-1.5"
    >
      <span class="text-sm font-semibold">Item ID</span>
      <div class="flex gap-2">
        <output class="flex flex-1 items-center rounded-md bg-[#0B0B0C] px-3.5 font-mono text-lg text-white">{{ item!.code }}</output>
        <NuxtLink
          :to="`/equipment/labels?codes=${item!.code}`"
          class="btn btn-secondary"
        >Reprint QR</NuxtLink>
      </div>
      <span class="help">Fixed, so printed labels keep working.</span>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <UiField label="Brand">
        <input
          v-model="form.brand"
          type="text"
          class="ctl"
          placeholder="e.g. L-Acoustics"
          autocomplete="off"
        >
      </UiField>
      <UiField label="Model">
        <input
          v-model="form.model"
          type="text"
          class="ctl"
          placeholder="e.g. KARA II"
          autocomplete="off"
        >
      </UiField>
    </div>
    <UiField label="Serial no.">
      <input
        v-model="form.serial_no"
        type="text"
        class="ctl"
        :placeholder="isEdit ? '' : 'Per item, after saving'"
        :disabled="!isEdit && Number(form.quantity) > 1"
      >
    </UiField>
    <UiField
      :label="isEdit ? 'Home storage spot' : 'Storage spot'"
      :help="isEdit ? 'Where it goes back to after each event.' : undefined"
    >
      <input
        v-model="form.home_location"
        type="text"
        class="ctl"
      >
    </UiField>
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Condition
      </legend>
      <UiSegmented
        v-model="form.condition"
        name="condition"
        :options="[{ value: 'good', label: isEdit ? 'Good' : 'New / good' }, { value: 'minor_wear', label: 'Minor wear' }, { value: 'needs_repair', label: 'Needs repair' }]"
      />
    </fieldset>

    <fieldset class="m-0 flex flex-col gap-3 rounded-lg bg-[#F2F3F5] p-3.5">
      <legend class="h-section mb-2 text-lg">
        Pricing
      </legend>
      <div class="grid grid-cols-2 gap-3">
        <UiField label="Rental rate (₱ / day)">
          <input
            v-model="form.rental_rate"
            inputmode="decimal"
            class="ctl"
            placeholder="2,500"
          >
        </UiField>
        <UiField
          label="Rate per event (₱)"
          optional
        >
          <input
            v-model="form.rate_per_event"
            inputmode="decimal"
            class="ctl"
            placeholder="Flat price"
          >
        </UiField>
        <UiField
          label="Replacement value (₱)"
          help="To replace it if lost or beyond repair."
        >
          <input
            v-model="form.replacement_value"
            inputmode="decimal"
            class="ctl"
            placeholder="120,000"
          >
        </UiField>
        <UiField
          label="Purchase cost (₱)"
          optional
          help="Per item, what you paid."
        >
          <input
            v-model="form.purchase_cost"
            inputmode="decimal"
            class="ctl"
          >
        </UiField>
        <UiField label="Purchase date">
          <input
            v-model="form.purchase_date"
            type="date"
            class="ctl"
          >
        </UiField>
      </div>
      <span class="help">For reference only. Not used in event totals, quotes or payroll yet.</span>
    </fieldset>

    <UiField label="Notes">
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. comes with rain cover"
      />
    </UiField>

    <div
      v-if="!isEdit"
      class="flex items-center gap-3.5 rounded-lg border border-[#DADDE3] p-3.5"
    >
      <EquipmentQrCode
        :value="codes[0] ?? 'ITM-001'"
        :size="76"
      />
      <div class="flex flex-col gap-2">
        <span class="text-sm">Label preview · Blaster Pro Audio · <span class="font-mono">{{ codes[0] }}</span></span>
        <label class="flex items-center gap-2 text-sm font-semibold">
          <input
            v-model="printLabels"
            type="checkbox"
            class="size-5 accent-[#2F5596]"
          > Print {{ plural(codes.length, 'QR label') }} after saving
        </label>
      </div>
    </div>
    <NuxtLink
      v-else
      :to="`/equipment/${item!.code}`"
      class="text-sm font-semibold"
    >See full history for {{ item!.code }} →</NuxtLink>

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
        @click="save(true)"
      >
        Save &amp; add another
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save(false)"
      >
        {{ isEdit ? 'Save changes' : `Save ${plural(codes.length || 1, 'item')}` }}
      </button>
    </template>
  </UiSlidePanel>
</template>
