<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row, rental?: Row | null }>()
const emit = defineEmits<{ saved: [rental: Row, isNew: boolean] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const { canSeeRates } = useAuthUser()

const CATS = [['audio', 'Audio'], ['lighting', 'Lighting'], ['cables', 'Cables'], ['stage_truss', 'Stage & truss'], ['power', 'Power'], ['video', 'Video'], ['other', 'Other']]
const blank = () => ({ name: '', category: 'audio', quantity: 1 as number | string, brand: '', model: '', serial_no: '', storage_spot: '', condition: 'good', notes: '', cost: '' as string | number })
const form = reactive(blank())
const photo = ref<File | null>(null)
const photoUrl = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const isEdit = computed(() => !!props.rental)

watch(open, (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  setPhoto(null, props.rental?.photo_url ?? null)
  Object.assign(form, blank())
  if (props.rental) {
    const r = props.rental
    Object.assign(form, { name: r.name, category: r.category, quantity: r.quantity, brand: r.brand ?? '', model: r.model ?? '', serial_no: r.serial_no ?? '', storage_spot: r.storage_spot ?? '', condition: r.condition, notes: r.notes ?? '', cost: r.cost ?? '' })
  }
}, { immediate: true })

function setPhoto(file: File | null, url: string | null) {
  if (photoUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(photoUrl.value)
  }
  photo.value = file
  photoUrl.value = url
}
onBeforeUnmount(() => setPhoto(null, null))

function onPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) {
    setPhoto(f, URL.createObjectURL(f))
  }
}

async function save(again = false) {
  busy.value = true
  errors.value = {}
  const fd = new FormData()
  for (const [k, v] of Object.entries({ ...form, quantity: Math.max(1, Number(form.quantity) || 1), cost: String(form.cost).replace(/[^0-9.]/g, '') })) {
    if (k === 'cost' && !canSeeRates.value) {
      continue
    }
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
    let res: { data: Row }
    if (isEdit.value) {
      fd.append('_method', 'PATCH')
      res = await api.post<{ data: Row }>(`/rentals/${props.rental!.id}`, fd)
    } else {
      res = await api.post<{ data: Row }>(`/events/${props.event.id}/rentals`, fd)
    }
    emit('saved', res.data, !isEdit.value)
    if (again) {
      Object.assign(form, { ...blank(), category: form.category, storage_spot: form.storage_spot })
      setPhoto(null, null)
    } else {
      open.value = false
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
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isEdit ? 'Edit rented equipment' : 'Add equipment manually'"
    :subtitle="`${event.label} · ${event.short_dates}`"
  >
    <div class="flex gap-2.5 rounded-md bg-[#FFF1D6] p-3 text-sm text-[#6B4100]">
      <UIcon
        name="i-lucide-info"
        class="mt-0.5 size-[18px] flex-none"
      />
      <span>For gear you rented from someone else. It's tracked on this event only: it isn't added to your inventory and gets no ID or QR label. Your own gear? <NuxtLink
        :to="`/scan?event=${event.id}`"
        class="font-semibold text-[#6B4100]"
      >Scan its QR</NuxtLink> instead.</span>
    </div>

    <label class="flex cursor-pointer items-center gap-3">
      <span class="flex size-[84px] flex-none items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-center text-xs text-[#565B66]">
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
    <p
      v-if="errors.photo"
      role="alert"
      class="err -mt-2 mb-0"
    >
      {{ errors.photo }}
    </p>

    <UiField
      label="Item name *"
      :error="errors.name"
    >
      <input
        v-model="form.name"
        type="text"
        class="ctl"
        :class="{ 'ctl-error': errors.name }"
        placeholder="e.g. Moving head"
      >
    </UiField>
    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Category *"
        :error="errors.category"
      >
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
      <UiField
        label="Quantity *"
        :error="errors.quantity"
      >
        <input
          v-model.number="form.quantity"
          type="number"
          min="1"
          max="999"
          inputmode="numeric"
          class="ctl"
          :class="{ 'ctl-error': errors.quantity }"
        >
      </UiField>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <UiField
        label="Brand"
        :error="errors.brand"
      >
        <input
          v-model="form.brand"
          type="text"
          class="ctl"
          placeholder="e.g. Robe"
          autocomplete="off"
        >
      </UiField>
      <UiField
        label="Model"
        :error="errors.model"
      >
        <input
          v-model="form.model"
          type="text"
          class="ctl"
          placeholder="e.g. MegaPointe"
          autocomplete="off"
        >
      </UiField>
    </div>
    <UiField
      label="Serial no."
      :error="errors.serial_no"
    >
      <input
        v-model="form.serial_no"
        type="text"
        class="ctl"
        autocomplete="off"
      >
    </UiField>
    <UiField
      label="Storage spot"
      help="Where it's kept during the event."
      :error="errors.storage_spot"
    >
      <input
        v-model="form.storage_spot"
        type="text"
        class="ctl"
        placeholder="e.g. Truck 2 · stage left"
      >
    </UiField>
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Condition when received
      </legend>
      <UiSegmented
        v-model="form.condition"
        name="rental-condition"
        :options="[{ value: 'good', label: 'Good' }, { value: 'minor_wear', label: 'Minor wear' }, { value: 'damaged', label: 'Damaged' }]"
      />
    </fieldset>
    <UiField
      v-if="canSeeRates"
      label="Rental cost (₱)"
      optional
      help="What we pay the owner for this rental. Shows in the event's cost overview."
      :error="errors.cost"
    >
      <input
        v-model="form.cost"
        inputmode="decimal"
        class="ctl"
        placeholder="e.g. 18,000"
      >
    </UiField>
    <UiField
      label="Notes"
      :error="errors.notes"
    >
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. Rented from Lumina Rentals · return by Oct 21"
      />
    </UiField>
    <p
      v-if="!isEdit"
      class="m-0 text-[13px] text-[#565B66]"
    >
      Logged as added by <b class="text-[#0B0B0C]">you</b> · now
    </p>

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
        :disabled="busy || !form.name.trim()"
        @click="save(true)"
      >
        Save &amp; add another
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || !form.name.trim()"
        @click="save()"
      >
        {{ isEdit ? 'Save changes' : 'Add to event' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
