<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * One truck as a tree: loose equipment, cases (each opening to what's packed inside), crew, trips.
 * Changes go straight to the API; the parent reloads the tree from `update` or `reload`.
 */
const props = defineProps<{ cargo: Row, editable: boolean }>()
const emit = defineEmits<{
  'update': [cargo: Row]
  'reload': []
  'add-gear': [target: { kind: 'truck' | 'case', id: number, name: string }]
  'add-crew': []
  'new-case': []
  'plan-trip': []
}>()
const api = useApi()
const { notify, fail } = useNotify()

/** Top-level groups start open; cases start closed so a full truck stays scannable. */
const open = reactive<Record<string, boolean>>({ items: true, cases: true, crew: true, trips: true })
const busy = ref<string | null>(null)

const truck = computed(() => props.cargo.vehicle as Row)
const pieces = computed(() => props.cargo.items.length + props.cargo.containers.reduce((n: number, c: Row) => n + c.items.length, 0))

async function run(key: string, job: () => Promise<void>) {
  busy.value = key
  try {
    await job()
  } catch (e) {
    fail(e)
  } finally {
    busy.value = null
  }
}

function takeOff(code: string) {
  return run(`off:${code}`, async () => {
    emit('update', (await api.del<{ data: Row }>(`/vehicles/${truck.value.id}/loadout/${code}`)).data)
    notify(`${code} taken off ${truck.value.name}.`)
  })
}

function unpack(box: Row, item: Row) {
  return run(`out:${item.code}`, async () => {
    await api.del(`/containers/${box.id}/items/${item.code}`)
    notify(`${item.code} taken out of ${box.code}.`)
    emit('reload')
  })
}

function setSeat(person: Row, role: string) {
  if (role === person.role) {
    return
  }
  return run(`seat:${person.seat_id}`, async () => {
    emit('update', (await api.patch<{ data: Row }>(`/crew/${person.seat_id}`, { role })).data)
  })
}

function removeCrew(person: Row) {
  return run(`crew:${person.seat_id}`, async () => {
    await api.del(`/crew/${person.seat_id}`)
    notify(`${person.name} taken off ${truck.value.name}.`)
    emit('reload')
  })
}
</script>

<template>
  <section
    :aria-label="`${truck.name} cargo`"
    class="card flex flex-col"
  >
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] px-5 py-4">
      <div class="flex items-center gap-3">
        <span class="flex size-11 flex-none items-center justify-center rounded-lg bg-[#0B0B0C] text-white">
          <UIcon
            name="i-lucide-truck"
            class="size-6"
          />
        </span>
        <div class="flex flex-col">
          <h2 class="h-section m-0">
            {{ truck.name }}
          </h2>
          <span class="sub font-mono">{{ truck.plate_no }} · {{ truck.type_label }}{{ truck.capacity_note ? ` · ${truck.capacity_note}` : '' }}</span>
        </div>
      </div>
      <span class="text-sm text-[#565B66]">{{ pieces }} {{ pieces === 1 ? 'piece' : 'pieces' }} · {{ cargo.containers.length }} {{ cargo.containers.length === 1 ? 'case' : 'cases' }} · {{ cargo.crew.length }} crew</span>
    </header>

    <ul
      role="tree"
      :aria-label="truck.name"
      class="m-0 flex list-none flex-col p-0"
    >
      <!-- Loose equipment -->
      <li
        role="treeitem"
        :aria-expanded="open.items"
        class="border-b border-[#EEF0F2]"
      >
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[15px] font-bold"
            @click="open.items = !open.items"
          >
            <UIcon
              :name="open.items ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4"
            />
            <UIcon
              name="i-lucide-speaker"
              class="size-[18px] text-[#565B66]"
            />Equipment <span class="font-normal text-[#565B66]">({{ cargo.items.length }})</span>
          </button>
          <button
            v-if="editable"
            type="button"
            class="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            @click="emit('add-gear', { kind: 'truck', id: truck.id, name: truck.name })"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />Add gear or case
          </button>
        </div>
        <ul
          v-if="open.items"
          role="group"
          class="m-0 mb-3 ml-7 flex list-none flex-col border-l-2 border-[#DADDE3] p-0 pl-4"
        >
          <li
            v-for="i in cargo.items"
            :key="i.id"
            role="treeitem"
            class="flex items-center justify-between gap-3 py-1.5 text-sm"
          >
            <span class="flex min-w-0 flex-wrap items-center gap-x-2">
              <NuxtLink
                :to="`/equipment/${i.code}`"
                class="font-mono"
              >{{ i.code }}</NuxtLink>
              <span>{{ i.name }}</span>
              <UiBadge
                :tone="EQUIPMENT_STATUS[i.status]?.tone ?? TONES.grey"
                :label="i.status_label"
              />
            </span>
            <button
              v-if="editable"
              type="button"
              class="btn btn-red-text btn-sm"
              :disabled="busy === `off:${i.code}`"
              @click="takeOff(i.code)"
            >
              Take off
            </button>
          </li>
          <li
            v-if="!cargo.items.length"
            class="py-1.5 text-sm text-[#565B66]"
          >
            No loose gear. Big items like subs and mixers go here; small things ride in cases.
          </li>
        </ul>
      </li>

      <!-- Cases -->
      <li
        role="treeitem"
        :aria-expanded="open.cases"
        class="border-b border-[#EEF0F2]"
      >
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[15px] font-bold"
            @click="open.cases = !open.cases"
          >
            <UIcon
              :name="open.cases ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4"
            />
            <UIcon
              name="i-lucide-package"
              class="size-[18px] text-[#565B66]"
            />Cases &amp; boxes <span class="font-normal text-[#565B66]">({{ cargo.containers.length }})</span>
          </button>
          <span
            v-if="editable"
            class="inline-flex gap-1.5"
          >
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              aria-haspopup="dialog"
              @click="emit('new-case')"
            >
              <UIcon
                name="i-lucide-plus"
                class="size-4"
              />New case
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              aria-haspopup="dialog"
              @click="emit('add-gear', { kind: 'truck', id: truck.id, name: truck.name })"
            >
              Add existing
            </button>
          </span>
        </div>
        <ul
          v-if="open.cases"
          role="group"
          class="m-0 mb-3 ml-7 flex list-none flex-col border-l-2 border-[#DADDE3] p-0 pl-4"
        >
          <li
            v-for="c in cargo.containers"
            :key="c.id"
            role="treeitem"
            :aria-expanded="!!open[`case:${c.id}`]"
            class="py-1"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                class="flex cursor-pointer flex-wrap items-center gap-x-2 border-0 bg-transparent p-0 text-left text-sm"
                @click="open[`case:${c.id}`] = !open[`case:${c.id}`]"
              >
                <UIcon
                  :name="open[`case:${c.id}`] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="size-4"
                />
                <span class="font-mono font-semibold">{{ c.code }}</span>
                <span class="font-semibold">{{ c.name }}</span>
                <span class="text-[#565B66]">{{ c.items.length }} {{ c.items.length === 1 ? 'item' : 'items' }}</span>
                <UiBadge
                  :tone="LOCATION_STATE[c.location_state] ?? TONES.grey"
                  :label="c.location_state_label"
                />
              </button>
              <span class="inline-flex gap-1.5">
                <NuxtLink
                  :to="`/logistics/cases/${c.id}`"
                  class="btn btn-secondary btn-sm"
                >Open</NuxtLink>
                <button
                  v-if="editable"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  aria-haspopup="dialog"
                  @click="emit('add-gear', { kind: 'case', id: c.id, name: c.code })"
                >
                  Pack item
                </button>
                <button
                  v-if="editable"
                  type="button"
                  class="btn btn-red-text btn-sm"
                  :disabled="busy === `off:${c.code}`"
                  @click="takeOff(c.code)"
                >
                  Take off
                </button>
              </span>
            </div>
            <ul
              v-if="open[`case:${c.id}`]"
              role="group"
              class="m-0 mt-1 ml-2 flex list-none flex-col border-l-2 border-dashed border-[#DADDE3] p-0 pl-5"
            >
              <li
                v-for="i in c.items"
                :key="i.id"
                role="treeitem"
                class="flex items-center justify-between gap-3 py-1 text-sm"
              >
                <span class="flex min-w-0 flex-wrap items-center gap-x-2">
                  <NuxtLink
                    :to="`/equipment/${i.code}`"
                    class="font-mono"
                  >{{ i.code }}</NuxtLink>
                  <span>{{ i.name }}</span>
                  <span
                    v-if="i.status !== 'available'"
                    class="text-[13px] text-[#565B66]"
                  >· {{ i.status_label }}</span>
                </span>
                <button
                  v-if="editable"
                  type="button"
                  class="btn btn-red-text btn-sm"
                  :disabled="busy === `out:${i.code}`"
                  @click="unpack(c, i)"
                >
                  Take out
                </button>
              </li>
              <li
                v-if="!c.items.length"
                class="py-1 text-sm text-[#565B66]"
              >
                Empty. Pack items by scanning them.
              </li>
            </ul>
          </li>
          <li
            v-if="!cargo.containers.length"
            class="py-1.5 text-sm text-[#565B66]"
          >
            No cases yet. Make a new one, or add an existing case by its CASE- ID.
          </li>
        </ul>
      </li>

      <!-- Crew -->
      <li
        role="treeitem"
        :aria-expanded="open.crew"
        class="border-b border-[#EEF0F2]"
      >
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[15px] font-bold"
            @click="open.crew = !open.crew"
          >
            <UIcon
              :name="open.crew ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4"
            />
            <UIcon
              name="i-lucide-users"
              class="size-[18px] text-[#565B66]"
            />Crew <span class="font-normal text-[#565B66]">({{ cargo.crew.length }})</span>
          </button>
          <button
            v-if="editable"
            type="button"
            class="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            @click="emit('add-crew')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />Add crew
          </button>
        </div>
        <ul
          v-if="open.crew"
          role="group"
          class="m-0 mb-3 ml-7 flex list-none flex-col border-l-2 border-[#DADDE3] p-0 pl-4"
        >
          <li
            v-for="p in cargo.crew"
            :key="p.seat_id"
            role="treeitem"
            class="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm"
          >
            <span class="flex items-center gap-2">
              <UIcon
                :name="p.role === 'driver' ? 'i-lucide-id-card' : 'i-lucide-user'"
                class="size-4 text-[#565B66]"
              />
              <span class="font-semibold">{{ p.name }}</span>
              <span class="text-[13px] text-[#565B66]">{{ p.usual_role_label }}{{ p.is_active ? '' : ' · inactive' }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <UiSegmented
                v-if="editable"
                :model-value="p.role"
                :name="`seat-${p.seat_id}`"
                size="sm"
                :options="[{ value: 'driver', label: 'Driver' }, { value: 'helper', label: 'Helper' }]"
                @update:model-value="setSeat(p, $event)"
              />
              <UiBadge
                v-else
                :tone="p.role === 'driver' ? TONES.blueTint : TONES.grey"
                :label="p.role_label"
              />
              <button
                v-if="editable"
                type="button"
                class="btn btn-red-text btn-sm"
                :disabled="busy === `crew:${p.seat_id}`"
                @click="removeCrew(p)"
              >
                Remove
              </button>
            </span>
          </li>
          <li
            v-if="!cargo.crew.length"
            class="py-1.5 text-sm text-[#565B66]"
          >
            No crew yet. Add a driver and helpers who usually ride this truck.
          </li>
        </ul>
      </li>

      <!-- Trips -->
      <li
        role="treeitem"
        :aria-expanded="open.trips"
      >
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[15px] font-bold"
            @click="open.trips = !open.trips"
          >
            <UIcon
              :name="open.trips ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4"
            />
            <UIcon
              name="i-lucide-route"
              class="size-[18px] text-[#565B66]"
            />Trips <span class="font-normal text-[#565B66]">({{ cargo.trips.length }})</span>
          </button>
          <button
            v-if="editable"
            type="button"
            class="btn btn-secondary btn-sm"
            aria-haspopup="dialog"
            @click="emit('plan-trip')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-4"
            />Plan trip
          </button>
        </div>
        <ul
          v-if="open.trips"
          role="group"
          class="m-0 mb-3 ml-7 flex list-none flex-col border-l-2 border-[#DADDE3] p-0 pl-4"
        >
          <li
            v-for="t in cargo.trips"
            :key="t.id"
            role="treeitem"
            class="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm"
          >
            <span class="flex min-w-0 flex-col">
              <span class="flex flex-wrap items-center gap-x-2">
                <NuxtLink
                  :to="`/trips/${t.id}`"
                  class="font-mono font-semibold"
                >{{ t.code }}</NuxtLink>
                <span>{{ t.direction_label }} · {{ t.event.label }}</span>
              </span>
              <span class="text-[13px] text-[#565B66]">{{ t.driver?.name ?? 'No driver yet' }}{{ t.scheduled_at ? ` · leaves ${t.scheduled_at}` : '' }}</span>
            </span>
            <UiBadge
              :tone="TRIP_STATUS[t.status] ?? TONES.grey"
              :label="t.status_label"
            />
          </li>
          <li
            v-if="!cargo.trips.length"
            class="py-1.5 text-sm text-[#565B66]"
          >
            No trips yet. Book this truck on a booking, or plan a trip here.
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
