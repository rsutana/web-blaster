<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Case' })

const route = useRoute()
const api = useApi()
const geo = useGeo()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const box = ref<Row | null>(null)
const history = ref<Row[]>([])
const mode = ref<'pack' | 'check'>('pack')
const busy = ref(false)
const packResult = ref<Row | null>(null)
const checked = ref<string[]>([])
const checkResult = ref<Row | null>(null)
const editOpen = ref(false)
const form = reactive({ name: '', type: 'road_case' })
const editable = computed(() => can('logistics', 'edit'))

useHead(() => ({ title: `${box.value?.code ?? 'Case'} · Blaster Pro Audio` }))

async function load() {
  box.value = (await api.get<{ data: Row }>(`/containers/${route.params.id}`)).data
  history.value = (await api.get<{ data: Row[] }>('/movements', { container: box.value.code, limit: 50 }).catch(() => ({ data: [] as Row[] }))).data
}
onMounted(() => load().catch(fail))

async function onCode(code: string) {
  if (mode.value === 'check') {
    if (!checked.value.includes(code)) {
      checked.value = [...checked.value, code]
    }
    checkResult.value = null
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row, meta: Row }>(`/containers/${box.value!.id}/items`, { codes: [code], gps: await geo.fix() })
    box.value = res.data
    packResult.value = res.meta
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function unpack(item: Row) {
  try {
    box.value = (await api.del<{ data: Row }>(`/containers/${box.value!.id}/items/${item.code}`)).data
    notify(`${item.code} taken out of ${box.value.code}.`)
  } catch (e) {
    fail(e)
  }
}

async function compare() {
  busy.value = true
  try {
    checkResult.value = (await api.post<{ data: Row }>(`/containers/${box.value!.id}/checks`, { codes: checked.value, gps: await geo.fix() })).data
    history.value = (await api.get<{ data: Row[] }>('/movements', { container: box.value!.code, limit: 50 })).data
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

function openEdit() {
  Object.assign(form, { name: box.value!.name, type: box.value!.type })
  editOpen.value = true
}

async function saveEdit() {
  try {
    box.value = (await api.patch<{ data: Row }>(`/containers/${box.value!.id}`, { ...form })).data
    editOpen.value = false
    notify('Saved.')
  } catch (e) {
    fail(e)
  }
}

async function remove() {
  try {
    await api.del(`/containers/${box.value!.id}`)
    notify(`${box.value!.code} deleted.`)
    await navigateTo('/logistics/cases')
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!box"
      variant="detail"
      media="square"
      :stats="0"
    />
    <template v-else>
      <nav
        aria-label="Breadcrumb"
        class="text-sm"
      >
        <NuxtLink to="/logistics/cases">Cases</NuxtLink> <span class="text-[#9AA0AB]">/</span> <span class="font-mono text-[#565B66]">{{ box.code }}</span>
      </nav>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex size-[88px] flex-none items-center justify-center rounded-lg bg-[#0B0B0C] p-2">
            <EquipmentQrCode
              :value="box.code"
              :size="72"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="font-mono text-sm text-[#565B66]">{{ box.code }} · {{ box.type_label }}</span>
            <h1 class="h-page m-0">
              {{ box.name }}
            </h1>
            <div class="flex items-center gap-2 text-sm">
              <UiBadge
                :tone="LOCATION_STATE[box.location_state]!"
                :label="box.location_state_label"
              />
              <span class="text-[#565B66]">{{ box.current_location ?? box.warehouse_name }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <NuxtLink
            :to="`/equipment/labels?codes=${box.code}`"
            class="btn btn-secondary"
          >
            <UIcon
              name="i-lucide-printer"
              class="size-[18px]"
            />Print label
          </NuxtLink>
          <button
            v-if="editable"
            type="button"
            class="btn btn-secondary"
            aria-haspopup="dialog"
            @click="openEdit"
          >
            Edit
          </button>
          <button
            v-if="editable && !box.items.length"
            type="button"
            class="btn btn-red-text"
            @click="remove"
          >
            Delete
          </button>
        </div>
      </header>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr))"
      >
        <section
          aria-labelledby="in-h"
          class="card flex flex-col"
        >
          <div class="card-head">
            <h2
              id="in-h"
              class="h-section m-0"
            >
              Packed inside ({{ box.items.length }})
            </h2>
          </div>
          <ul class="m-0 flex list-none flex-col p-0">
            <li
              v-for="i in box.items"
              :key="i.id"
              class="flex items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-2.5 text-sm"
            >
              <span><NuxtLink
                :to="`/equipment/${i.code}`"
                class="font-mono"
              >{{ i.code }}</NuxtLink> · {{ i.name }}<span class="block text-[13px] text-[#565B66]">{{ i.status_label }} · {{ i.location_state_label }}</span></span>
              <button
                v-if="editable"
                type="button"
                class="btn btn-red-text btn-sm"
                @click="unpack(i)"
              >
                Take out
              </button>
            </li>
            <li
              v-if="!box.items.length"
              class="px-5 py-4 text-sm text-[#565B66]"
            >
              Empty. Scan items to pack them.
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="scan-h"
          class="card flex flex-col gap-3 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="scan-h"
              class="h-section m-0"
            >
              Scan
            </h2>
            <UiSegmented
              v-model="mode"
              name="case-mode"
              size="sm"
              :options="editable ? [{ value: 'pack', label: 'Pack items' }, { value: 'check', label: 'Check contents' }] : [{ value: 'check', label: 'Check contents' }]"
            />
          </div>
          <p class="m-0 text-sm text-[#565B66]">
            {{ mode === 'pack' ? 'Each item scanned goes into this case. An item already in another case moves here.' : 'Scan everything you find in the case, then compare with what should be inside.' }}
          </p>
          <LogisticsCodeScanner
            :busy="busy"
            placeholder="Item ID, e.g. LGT-021"
            @code="onCode"
          />
          <div
            v-if="mode === 'pack' && packResult"
            aria-live="polite"
            class="rounded-md bg-[#F2F3F5] p-3 text-sm"
          >
            <span v-if="packResult.packed.length"><b class="text-[#1D6B3C]">Packed:</b> {{ packResult.packed.join(', ') }}</span>
            <span v-if="packResult.moved.length"> · moved from another case: {{ packResult.moved.join(', ') }}</span>
            <span v-if="packResult.already.length">Already in this case: {{ packResult.already.join(', ') }}</span>
          </div>
          <template v-if="mode === 'check'">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="c in checked"
                :key="c"
                class="badge bg-[#ECEEF1] font-mono text-[#3B3F47]"
              >{{ c }}</span>
              <span
                v-if="!checked.length"
                class="text-sm text-[#565B66]"
              >Nothing scanned yet.</span>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="busy"
                @click="compare"
              >
                Compare ({{ checked.length }} scanned)
              </button>
              <button
                v-if="checked.length"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="checked = []; checkResult = null"
              >
                Start over
              </button>
            </div>
            <div
              v-if="checkResult"
              aria-live="polite"
              class="flex flex-col gap-1 rounded-md p-3 text-sm"
              :class="checkResult.is_complete ? 'bg-[#E2F2E8] text-[#1D6B3C]' : 'bg-[#FDE7E8] text-[#8F0F15]'"
            >
              <b>{{ checkResult.is_complete ? `All ${checkResult.expected} items are inside.` : `${checkResult.found.length} of ${checkResult.expected} found.` }}</b>
              <span v-if="checkResult.missing.length">Missing: {{ checkResult.missing.map((m: Row) => `${m.code} (${m.name})`).join(', ') }}</span>
              <span v-if="checkResult.extra.length">Not supposed to be in here: {{ checkResult.extra.join(', ') }}</span>
            </div>
          </template>
        </section>
      </div>

      <section
        aria-labelledby="hist-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="hist-h"
            class="h-section m-0"
          >
            History
          </h2>
        </div>
        <ol class="m-0 flex list-none flex-col px-5 py-2">
          <li
            v-for="m in history"
            :key="m.id"
            class="border-b border-[#EEF0F2] py-2.5 text-sm"
          >
            <b>{{ m.subject?.code }}</b> {{ m.action_label.toLowerCase() }}{{ m.event ? ` · Event ${m.event.code}` : '' }}{{ m.trip ? ` · ${m.trip.code}` : '' }} · {{ m.actor }}
            <div class="text-[13px] text-[#565B66]">
              {{ m.at }} · {{ m.place_label ?? 'no place' }} · {{ m.gps_label }}
            </div>
          </li>
          <li
            v-if="!history.length"
            class="py-4 text-sm text-[#565B66]"
          >
            No moves yet.
          </li>
        </ol>
      </section>

      <UiSlidePanel
        v-model:open="editOpen"
        :title="`Edit ${box.code}`"
      >
        <UiField label="Name">
          <input
            v-model="form.name"
            type="text"
            class="ctl"
          >
        </UiField>
        <UiField label="Type">
          <select
            v-model="form.type"
            class="ctl"
          >
            <option value="road_case">
              Road case
            </option>
            <option value="box">
              Box
            </option>
            <option value="rack">
              Rack
            </option>
            <option value="bag">
              Bag
            </option>
          </select>
        </UiField>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            @click="editOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="saveEdit"
          >
            Save changes
          </button>
        </template>
      </UiSlidePanel>
    </template>
  </div>
</template>
