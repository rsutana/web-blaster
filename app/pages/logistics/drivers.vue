<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Drivers' })
useHead({ title: 'Drivers · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const outside = ref<Row[]>([])
const crew = ref<Row[]>([])
const loading = ref(true)
const open = ref(false)
const editing = ref<Row | null>(null)
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const blank = () => ({ name: '', mobile: '', license_no: '', license_expiry: '', company: '', notes: '', is_active: true })
const form = reactive(blank())
const editable = computed(() => can('logistics', 'edit'))

async function load() {
  const [o, p] = await Promise.all([
    api.get<{ data: Row[] }>('/external-drivers'),
    api.get<{ data: Row[] }>('/personnel').catch(() => ({ data: [] as Row[] }))
  ])
  outside.value = o.data
  crew.value = p.data.filter(x => x.usual_role === 'driver')
  loading.value = false
}
onMounted(load)

function edit(d: Row | null) {
  editing.value = d
  errors.value = {}
  Object.assign(form, blank(), d ? { name: d.name, mobile: d.mobile ?? '', license_no: d.license_no ?? '', license_expiry: d.license_expiry ?? '', company: d.company ?? '', notes: d.notes ?? '', is_active: d.is_active } : {})
  open.value = true
}

async function save() {
  busy.value = true
  errors.value = {}
  const body = { ...form, license_expiry: form.license_expiry || null }
  try {
    const res = editing.value
      ? await api.patch<{ data: Row }>(`/external-drivers/${editing.value.id}`, body)
      : await api.post<{ data: Row }>('/external-drivers', body)
    open.value = false
    notify(`Saved ${res.data.name}.`)
    await load()
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}

async function remove(d: Row) {
  try {
    await api.del(`/external-drivers/${d.id}`)
    notify(`${d.name} removed.`)
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Drivers"
      subtitle="Your crew drivers sign in to the crew app. Outside drivers get a trip link instead."
    >
      <template #actions>
        <button
          v-if="editable"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="edit(null)"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add outside driver
        </button>
      </template>
    </UiPageHeader>
    <LogisticsNav />

    <div
      class="grid items-start gap-4"
      style="grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr))"
    >
      <section
        aria-labelledby="crew-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="crew-h"
            class="h-section m-0"
          >
            Our drivers ({{ crew.length }})
          </h2>
          <NuxtLink
            to="/personnel"
            class="text-sm font-semibold"
          >Crew list</NuxtLink>
        </div>
        <ul class="m-0 flex list-none flex-col p-0">
          <li
            v-for="p in crew"
            :key="p.id"
            class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3 text-sm"
          >
            <span><NuxtLink
              :to="`/personnel/${p.id}`"
              class="font-semibold text-[#0B0B0C]"
            >{{ p.full_name }}</NuxtLink><span class="block text-[13px] text-[#565B66]">{{ phone(p.mobile) }}</span></span>
            <span class="text-[13px] text-[#565B66]">{{ p.login?.state === 'crew' ? 'Has app login' : 'No login yet' }}</span>
          </li>
          <li
            v-if="!loading && !crew.length"
            class="px-5 py-4 text-sm text-[#565B66]"
          >
            Nobody on the crew list has Driver as their usual role.
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="out-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="out-h"
            class="h-section m-0"
          >
            Outside drivers ({{ outside.length }})
          </h2>
        </div>
        <UiSkeletonTable
          v-if="loading"
          :cols="3"
          :rows="3"
        />
        <ul
          v-else
          class="m-0 flex list-none flex-col p-0"
        >
          <li
            v-for="d in outside"
            :key="d.id"
            class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3 text-sm"
            :class="{ 'opacity-60': !d.is_active }"
          >
            <span>
              <b>{{ d.name }}</b><span v-if="d.company"> · {{ d.company }}</span>
              <span class="block text-[13px] text-[#565B66]">{{ d.mobile ? phone(d.mobile) : 'No mobile' }}{{ d.license_no ? ` · License ${d.license_no}` : '' }}<span
                v-if="d.license_expiry_label"
                :class="d.is_license_expired ? 'font-semibold text-[#B4121A]' : ''"
              > · {{ d.is_license_expired ? 'expired' : 'expires' }} {{ d.license_expiry_label }}</span></span>
            </span>
            <span
              v-if="editable"
              class="inline-flex gap-1.5"
            >
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                aria-haspopup="dialog"
                @click="edit(d)"
              >Edit</button>
              <button
                type="button"
                class="btn btn-red-text btn-sm"
                @click="remove(d)"
              >Delete</button>
            </span>
          </li>
          <li
            v-if="!outside.length"
            class="px-5 py-4 text-sm text-[#565B66]"
          >
            No outside drivers yet.
          </li>
        </ul>
      </section>
    </div>

    <UiSlidePanel
      v-model:open="open"
      :title="editing ? `Edit ${editing.name}` : 'Add outside driver'"
      subtitle="Someone who drives for you but isn't on the crew list."
    >
      <UiField
        label="Name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Mobile"
          :error="errors.mobile"
        >
          <input
            v-model="form.mobile"
            type="tel"
            class="ctl"
            placeholder="09XX XXX XXXX"
          >
        </UiField>
        <UiField
          label="Company"
          optional
        >
          <input
            v-model="form.company"
            type="text"
            class="ctl"
            placeholder="e.g. JRS Haulers"
          >
        </UiField>
        <UiField
          label="License no."
          optional
        >
          <input
            v-model="form.license_no"
            type="text"
            class="ctl font-mono"
          >
        </UiField>
        <UiField
          label="License expiry"
          optional
          :error="errors.license_expiry"
        >
          <input
            v-model="form.license_expiry"
            type="date"
            class="ctl"
          >
        </UiField>
      </div>
      <UiField
        label="Notes"
        optional
      >
        <textarea
          v-model="form.notes"
          rows="2"
          class="ctl"
        />
      </UiField>
      <label class="flex items-center gap-2 text-sm font-semibold">
        <input
          v-model="form.is_active"
          type="checkbox"
          class="size-5 accent-[#2F5596]"
        > Available for new trips
      </label>
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
          :disabled="busy || !form.name.trim()"
          @click="save"
        >
          {{ editing ? 'Save changes' : 'Add driver' }}
        </button>
      </template>
    </UiSlidePanel>
  </div>
</template>
