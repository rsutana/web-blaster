<script setup lang="ts">
import type { MapPin, Row } from '~/types/api'

definePageMeta({ module: 'equip', title: 'Equipment item' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const item = ref<Row | null>(null)
const statusOpen = ref(false)

async function load() {
  item.value = (await api.get<{ data: Row }>(`/equipment/${route.params.code}`)).data
  useHead({ title: `${item.value.code} · Blaster Pro Audio` })
}
onMounted(load)

const statusNote = computed(() => ({
  under_repair: { t: 'Can\'t be scanned into events until marked repaired.', c: '#6B4100' },
  available: { t: `In stock · ${item.value?.home_location ?? ''}. Can be booked.`, c: '#1D6B3C' },
  retired: { t: 'Out of service for good. History is kept.', c: '#3B3F47' },
  lost: { t: 'Missing. It stays in reports until it\'s found or written off.', c: '#B4121A' },
  deployed: { t: `On ${item.value?.active_event?.label ?? 'an event'}.`, c: '#244677' }
} as Record<string, { t: string, c: string }>)[item.value?.status ?? 'available'])

const movementPins = computed<MapPin[]>(() => (item.value?.movements ?? []).filter((m: Row) => m.latitude !== null).slice(0, 25).reverse()
  .map((m: Row) => ({ lat: m.latitude, lng: m.longitude, kind: 'point', color: m.is_off_site ? '#C4141C' : '#2F5596', label: `${m.action_label} · ${m.at} · ${m.actor}` })))
const movementPath = computed<[number, number][]>(() => movementPins.value.map(p => [p.lat, p.lng]))

async function quick(status: string, note: string) {
  try {
    await api.post(`/equipment/${item.value!.code}/status-changes`, { status, note })
    await load()
    notify(`${item.value!.code} is now ${EQUIPMENT_STATUS[status]!.label}.`)
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!item"
      variant="detail"
      media="square"
    />
    <template v-else>
      <nav
        aria-label="Breadcrumb"
        class="text-sm"
      >
        <NuxtLink to="/equipment">Equipment</NuxtLink> <span class="text-[#9AA0AB]">/</span> <span class="font-mono text-[#565B66]">{{ item.code }}</span>
      </nav>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex size-[88px] flex-none items-center justify-center rounded-lg bg-[#0B0B0C] p-2">
            <EquipmentQrCode
              :value="item.code"
              :size="72"
              dark="#FFFFFF"
              light="#0B0B0C"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="font-display m-0 text-[40px] leading-none font-extrabold uppercase">
                {{ item.name }}
              </h1>
              <UiBadge
                :tone="(item.is_overdue ? EQUIPMENT_STATUS.overdue : EQUIPMENT_STATUS[item.status])!.tone"
                :label="(item.is_overdue ? EQUIPMENT_STATUS.overdue : EQUIPMENT_STATUS[item.status])!.label"
              />
            </div>
            <p class="m-0 text-[15px] text-[#565B66]">
              <span class="font-mono">{{ item.code }}</span> · {{ item.category_label }} · Owned · Serial {{ item.serial_no ?? '[—]' }}
            </p>
            <p
              class="m-0 text-sm font-semibold"
              :style="{ color: statusNote?.c }"
            >
              {{ statusNote?.t }}
            </p>
            <p class="m-0 flex flex-wrap items-center gap-2 text-sm">
              <UiBadge
                :tone="LOCATION_STATE[item.location_state]!"
                :label="item.location_state_label"
              />
              <span class="text-[#565B66]">{{ item.current_location }}</span>
              <NuxtLink
                v-if="item.case"
                :to="`/logistics/cases/${item.case.id}`"
                class="font-semibold"
              >in {{ item.case.code }} · {{ item.case.name }}</NuxtLink>
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <NuxtLink
            :to="`/equipment/labels?codes=${item.code}`"
            class="btn btn-secondary"
          >Print QR label</NuxtLink>
          <template v-if="can('equip', 'edit')">
            <template v-if="item.status === 'under_repair'">
              <button
                type="button"
                class="btn btn-strong"
                @click="quick('retired', 'worn out')"
              >
                Retire (worn out)
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="quick('available', 'marked repaired')"
              >
                Mark repaired → Available
              </button>
            </template>
            <button
              v-else
              type="button"
              class="btn btn-dark"
              @click="statusOpen = true"
            >
              Change status
            </button>
          </template>
        </div>
      </header>

      <section
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
      >
        <UiStatCard
          variant="dark"
          label="Events used on"
          :value="item.detail.stats.events_used"
        />
        <UiStatCard
          label="Days deployed"
          :value="item.detail.stats.days_deployed"
        />
        <UiStatCard
          label="Times repaired"
          :value="item.detail.stats.times_repaired"
        />
        <UiStatCard
          label="In service since"
          :value="item.detail.stats.in_service_since"
          value-class="text-[32px]"
        />
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            Pricing
          </h2>
          <span class="text-sm text-[#565B66]">Reference only · not used in totals yet · edit from Equipment → Edit</span>
        </div>
        <div
          class="grid gap-3 p-4"
          style="grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr))"
        >
          <div
            v-for="[l, v] in [['Rental rate', item.rental_rate ? peso(item.rental_rate) + ' / day' : '—'], ['Rate per event', item.rate_per_event ? peso(item.rate_per_event) : '—'], ['Replacement value', peso(item.replacement_value)], ['Purchase cost', peso(item.purchase_cost)]]"
            :key="l"
            class="rounded-md bg-[#F2F3F5] p-3.5"
          >
            <div class="eyebrow text-[#565B66]">
              {{ l }}
            </div>
            <div class="font-display mt-1 text-2xl font-bold">
              {{ v }}
            </div>
          </div>
        </div>
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            Event history
          </h2>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 900px"
          >
            <thead>
              <tr>
                <th>Event</th><th>Dates</th><th>Added by</th><th>Ended</th><th>Condition</th><th>Reason / note</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(h, i) in item.detail.history"
                :key="i"
              >
                <td data-cell="title">
                  <NuxtLink
                    :to="`/events/${h.event_id}`"
                    class="font-semibold"
                  >{{ h.event_label }}</NuxtLink>
                </td>
                <td data-label="Dates">
                  {{ h.dates }}
                </td>
                <td data-label="Added by">
                  {{ h.added }}
                </td>
                <td data-label="Ended">
                  {{ h.ended }}
                </td>
                <td data-label="Condition">
                  <UiBadge
                    v-if="h.is_removed"
                    :tone="TONES.redTint"
                    :label="h.condition_label"
                  />
                  <template v-else>
                    {{ h.condition_label }}
                  </template>
                </td>
                <td data-label="Note">
                  {{ h.note }}<template v-if="h.photo_url">
                    · <a
                      :href="h.photo_url"
                      target="_blank"
                      rel="noopener"
                    >photo</a>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-if="!item.detail.history.length"
          text="Not used on an event yet."
        />
      </section>

      <section
        aria-labelledby="mv-h"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2
            id="mv-h"
            class="h-section m-0"
          >
            Movements
          </h2>
          <span class="text-[13px] text-[#565B66]">Every physical move, with who, when and where</span>
        </div>
        <div
          v-if="movementPins.length"
          class="px-5 pt-4"
        >
          <UiMapView
            :pins="movementPins"
            :path="movementPath"
            :height="240"
            :label="`Map of where ${item.code} was scanned`"
          />
        </div>
        <ol class="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto px-5 py-2">
          <li
            v-for="m in item.movements"
            :key="m.id"
            class="border-b border-[#EEF0F2] py-2.5 text-sm"
          >
            <b>{{ m.action_label }}</b><template v-if="m.event">
              · <NuxtLink :to="`/events/${m.event.id}`">Event {{ m.event.code }}</NuxtLink>
            </template><template v-if="m.trip">
              · <NuxtLink :to="`/trips/${m.trip.id}`">{{ m.trip.code }}</NuxtLink>{{ m.trip.vehicle ? ` (${m.trip.vehicle})` : '' }}
            </template><template v-if="m.via_case">
              · via {{ m.via_case }}
            </template> · {{ m.actor }}
            <div class="text-[13px] text-[#565B66]">
              {{ m.at }} · {{ m.place_label ?? 'no place' }} · {{ m.gps_label }}<span
                v-if="m.is_off_site"
                class="font-semibold text-[#B4121A]"
              > · {{ m.distance_m ? `${(m.distance_m / 1000).toFixed(1)} km from the expected place` : 'off site' }}</span><template v-if="m.note">
                · {{ m.note }}
              </template>
            </div>
          </li>
          <li
            v-if="!item.movements.length"
            class="py-4 text-sm text-[#565B66]"
          >
            No moves recorded yet. They start with the next scan.
          </li>
        </ol>
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            Status log
          </h2>
        </div>
        <ol class="m-0 flex list-none flex-col px-5 pt-2 pb-4">
          <li
            v-for="(l, i) in item.detail.logs"
            :key="i"
            class="flex gap-3 border-b border-[#E6E8EC] py-2.5"
          >
            <span
              aria-hidden="true"
              class="mt-1.5 size-2.5 flex-none rounded-sm"
              :style="{ background: EQUIPMENT_STATUS[l.status]?.dot }"
            />
            <div class="text-sm">
              <b>{{ l.status_label }}</b> · {{ l.what }}<div class="mt-0.5 text-[13px] text-[#565B66]">
                {{ l.when }}
              </div>
            </div>
          </li>
        </ol>
        <div class="border-t border-[#DADDE3] px-5 py-3 text-[13px] text-[#565B66]">
          Statuses: Available · Deployed · Under repair · Retired · Lost. Retired and Lost items keep their full history but leave the active inventory.
        </div>
      </section>

      <EquipmentChangeStatusModal
        v-model:open="statusOpen"
        :item="item"
        @changed="load"
      />
    </template>
  </div>
</template>
