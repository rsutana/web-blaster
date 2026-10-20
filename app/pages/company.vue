<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'dash', level: 'edit', title: 'Company profile' })
useHead({ title: 'Company profile · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const form = reactive<Record<string, string | boolean>>({ name: '', address: '', tin: '', is_vat_registered: true, phone: '', billing_email: '', history: '', bank_details: '', gcash_details: '' })
const photos = ref<Row[]>([])
const files = ref<Record<string, File>>({})
const busy = ref(false)

async function load() {
  const d = (await api.get<{ data: Row }>('/company')).data
  for (const k of Object.keys(form)) {
    form[k] = d[k] ?? (k === 'is_vat_registered' ? true : '')
  }
  photos.value = d.photos
}
onMounted(load)

async function save() {
  busy.value = true
  const fd = new FormData()
  fd.append('_method', 'PUT')
  for (const [k, v] of Object.entries(form)) {
    fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : v)
  }
  photos.value.forEach((p, i) => {
    fd.append(`photos[${i}][category]`, p.category)
    if (files.value[p.category]) {
      fd.append(`photos[${i}][file]`, files.value[p.category]!)
    }
  })
  try {
    await api.post('/company', fd)
    files.value = {}
    await load()
    notify('Company profile saved.')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Company profile"
      subtitle="Shown on the dashboard and printed on every invoice."
      :back="{ to: '/dashboard', label: 'Dashboard' }"
    >
      <template #actions>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy"
          @click="save"
        >
          Save profile
        </button>
      </template>
    </UiPageHeader>
    <section class="card grid gap-4 p-5 md:grid-cols-2">
      <UiField label="Business name">
        <input
          v-model="form.name"
          class="ctl"
        >
      </UiField>
      <UiField label="Phone">
        <input
          v-model="form.phone"
          class="ctl"
        >
      </UiField>
      <UiField label="Business address">
        <input
          v-model="form.address"
          class="ctl"
        >
      </UiField>
      <UiField label="TIN">
        <input
          v-model="form.tin"
          class="ctl"
        >
      </UiField>
      <UiField label="Billing email">
        <input
          v-model="form.billing_email"
          type="email"
          class="ctl"
        >
      </UiField>
      <label class="flex items-center gap-2.5 self-end text-[15px] font-semibold">
        <input
          v-model="form.is_vat_registered"
          type="checkbox"
          class="size-5 accent-[#2F5596]"
        > VAT registered
      </label>
      <UiField
        label="Company history"
        class="md:col-span-2"
      >
        <textarea
          v-model="form.history as string"
          rows="3"
          class="ctl"
        />
      </UiField>
      <UiField label="Bank transfer details (on invoices)">
        <textarea
          v-model="form.bank_details as string"
          rows="3"
          class="ctl"
        />
      </UiField>
      <UiField label="GCash details (on invoices)">
        <textarea
          v-model="form.gcash_details as string"
          rows="3"
          class="ctl"
        />
      </UiField>
    </section>
    <section class="card flex flex-col gap-3 p-5">
      <h2 class="h-section m-0">
        Portfolio photos
      </h2>
      <div class="grid gap-3 md:grid-cols-3">
        <label
          v-for="p in photos"
          :key="p.id"
          class="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-sm text-[#565B66]"
        >
          <img
            v-if="p.url"
            :src="p.url"
            alt=""
            class="size-full object-cover"
          >
          <template v-else>{{ p.caption }} · {{ files[p.category]?.name ?? 'add a photo' }}</template>
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            @change="(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) files[p.category] = f }"
          >
        </label>
      </div>
    </section>
  </div>
</template>
