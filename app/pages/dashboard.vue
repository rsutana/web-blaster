<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'dash', title: 'Dashboard' })
useHead({ title: 'Dashboard · Blaster Pro Audio' })

const api = useApi()
const { notify } = useNotify()
const { can, isAdminish } = useAuthUser()
const d = ref<Row | null>(null)
const clientOpen = ref(false)

onMounted(async () => {
  d.value = (await api.get<{ data: Row }>('/dashboard')).data
})

const FLEET = [
  { key: 'out', label: 'Out on events', color: '#2F5596' },
  { key: 'rent', label: 'On rent (dry hire)', color: '#6E8CC4' },
  { key: 'available', label: 'Available', color: '#1D6B3C' },
  { key: 'repair', label: 'In repair', color: '#C98A1B' },
  { key: 'damaged', label: 'Damaged', color: '#ED1B24' },
  { key: 'lost', label: 'Lost', color: '#0B0B0C' }
]
const fleetLabel = computed(() => d.value ? `${d.value.fleet.total} items: ` + FLEET.map(f => `${d.value!.fleet.counts[f.key]} ${f.label.toLowerCase()}`).join(', ') : '')
const DOT: Record<string, string> = { on_site: '#1D6B3C', en_route: '#C98A1B', clocked_out: '#9AA0AB', not_started: '#9AA0AB' }
const GANTT: Record<string, string> = { done: 'background:#9AA0AB', live: 'background:#C4141C', conf: 'background:#2F5596', quote: 'background:#FFFFFF;border:1px solid #2F5596', cancel: 'background:#0B0B0C' }
</script>

<template>
  <div class="contents">
    <UiSpinner v-if="!d" />
    <template v-else>
      <UiPageHeader
        :eyebrow="d.date_label"
        :title="d.greeting"
      >
        <template #actions>
          <NuxtLink
            v-if="can('track', 'edit')"
            to="/scan?mode=add"
            class="btn btn-dark"
          >
            <UIcon
              name="i-lucide-arrow-right"
              class="size-[18px]"
            />Dispatch gear
          </NuxtLink>
          <NuxtLink
            v-if="can('track', 'edit')"
            to="/scan?mode=remove"
            class="btn btn-dark"
          >
            <UIcon
              name="i-lucide-arrow-left"
              class="size-[18px]"
            />Check in gear
          </NuxtLink>
          <button
            v-if="can('clients', 'edit')"
            type="button"
            class="btn btn-strong"
            @click="clientOpen = true"
          >
            Add client
          </button>
          <NuxtLink
            v-if="can('inv')"
            to="/bookings?tab=all"
            class="btn btn-strong"
          >
            Invoice
          </NuxtLink>
          <NuxtLink
            v-if="can('book', 'edit')"
            to="/bookings?new=1"
            class="btn btn-primary"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-[18px]"
            />New booking
          </NuxtLink>
        </template>
      </UiPageHeader>

      <section
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr))"
      >
        <UiStatCard
          v-if="d.revenue"
          variant="blue"
          :label="`Revenue · ${d.revenue.month}`"
          to="/bookings"
        >
          <div class="figure text-[44px]">
            {{ peso(d.revenue.booked) }}
          </div>
          <template #sub>
            <div class="text-sm text-[#DCE4F2]">
              booked · {{ peso(d.revenue.collected) }} collected · {{ peso(d.revenue.outstanding) }} outstanding
            </div>
            <div class="mt-1 h-2 overflow-hidden rounded bg-[#5A7AB2]">
              <div
                class="h-full bg-white"
                :style="{ width: d.revenue.pct + '%' }"
              />
            </div>
          </template>
        </UiStatCard>
        <UiStatCard
          variant="dark"
          label="Events · next 7 days"
          dot="#ED1B24"
          :value="d.events_week.count"
          :sub="d.events_week.text"
          to="/calendar"
        />
        <UiStatCard
          label="Needs action"
          :value="d.needs_action.count"
          value-class="text-[44px] text-[#B4121A]"
          :sub="d.needs_action.text"
          :to="can('book') ? '/bookings' : undefined"
        />
      </section>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr))"
      >
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Today's schedule
            </h2>
            <NuxtLink
              to="/calendar"
              class="text-sm font-semibold"
            >Calendar</NuxtLink>
          </div>
          <div class="flex flex-col gap-2.5 p-4">
            <NuxtLink
              v-for="(s, i) in d.schedule"
              :key="i"
              :to="`/events/${s.event_id}`"
              class="flex flex-col gap-0.5 rounded-md border-l-[6px] bg-[#F2F3F5] p-3 text-[#0B0B0C] no-underline hover:text-[#0B0B0C]"
              :style="{ borderColor: s.is_live ? '#C4141C' : '#2F5596' }"
            >
              <b>{{ s.title }}</b>
              <span class="text-sm">{{ s.place }}</span>
              <span class="text-sm text-[#565B66]">{{ s.detail }}</span>
            </NuxtLink>
            <p
              v-if="!d.schedule.length"
              class="m-0 text-sm text-[#565B66]"
            >
              Nothing on today.
            </p>
            <div class="flex h-[150px] items-center justify-center rounded-md border-2 border-dashed border-[#9AA0AB] bg-[#F2F3F5] text-sm text-[#565B66]">
              Map · crew pins from their last clock-in
            </div>
            <h3 class="h-section mt-1 mb-0 text-base">
              Crew locations
            </h3>
            <ul class="m-0 flex list-none flex-col p-0">
              <li
                v-for="c in d.crew_locations"
                :key="c.name"
                class="flex items-start justify-between gap-3 border-b border-[#EEF0F2] py-2 text-sm"
              >
                <span class="flex items-center gap-2"><span
                  aria-hidden="true"
                  class="size-2.5 flex-none rounded-sm"
                  :style="{ background: DOT[c.state] }"
                /><b>{{ c.name }}</b> <span class="text-[#565B66]">{{ c.role }}</span></span>
                <span class="text-right">{{ c.place }}<span
                  class="block text-[13px]"
                  :class="c.state === 'en_route' || c.is_proxy ? 'text-[#6B4100]' : 'text-[#565B66]'"
                >{{ c.when }}</span></span>
              </li>
              <li
                v-if="!d.crew_locations.length"
                class="py-2 text-sm text-[#565B66]"
              >
                No crew on an event today.
              </li>
            </ul>
          </div>
        </section>

        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Equipment &amp; fleet
            </h2>
            <NuxtLink
              to="/equipment"
              class="text-sm font-semibold"
            >Inventory</NuxtLink>
          </div>
          <div class="flex flex-col gap-3 p-4">
            <div
              role="img"
              :aria-label="fleetLabel"
              class="flex h-7 overflow-hidden rounded"
            >
              <span
                v-for="f in FLEET"
                :key="f.key"
                :style="{ background: f.color, width: (d.fleet.counts[f.key] / Math.max(1, d.fleet.total) * 100) + '%' }"
              />
            </div>
            <div
              class="grid gap-2"
              style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr))"
            >
              <div
                v-for="f in FLEET"
                :key="f.key"
                class="flex flex-col gap-1 rounded-md border border-[#DADDE3] p-2.5"
              >
                <span class="flex items-center gap-1.5 text-[13px] text-[#565B66]"><span
                  class="size-2.5 rounded-sm"
                  :style="{ background: f.color }"
                />{{ f.label }}</span>
                <span class="figure text-[28px]">{{ d.fleet.counts[f.key] }}</span>
              </div>
            </div>
            <h3 class="h-section mt-1 mb-0 text-base">
              Rentals in progress
            </h3>
            <ul class="m-0 flex list-none flex-col p-0">
              <li
                v-for="(r, i) in d.rentals"
                :key="i"
                class="flex justify-between gap-3 border-b border-[#EEF0F2] py-2 text-sm"
              >
                <NuxtLink
                  :to="`/events/${r.event_id}`"
                  :class="r.is_overdue ? 'font-semibold text-[#B4121A]' : 'font-semibold text-[#0B0B0C]'"
                >{{ r.label }}</NuxtLink>
                <span :class="r.is_overdue ? 'font-semibold text-[#B4121A]' : 'text-[#565B66]'">{{ r.note }}</span>
              </li>
              <li
                v-if="!d.rentals.length"
                class="py-2 text-sm text-[#565B66]"
              >
                Nothing out right now.
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            Bookings · {{ d.gantt.title }}
          </h2>
          <NuxtLink
            to="/calendar"
            class="text-sm font-semibold"
          >Open calendar</NuxtLink>
        </div>
        <div class="overflow-x-auto p-4">
          <div class="flex min-w-[820px] flex-col gap-2">
            <div class="grid grid-cols-[200px_1fr] text-xs font-bold tracking-[.06em] text-[#565B66] uppercase">
              <span />
              <div class="relative h-4">
                <span
                  v-for="t in d.gantt.ticks"
                  :key="t.label"
                  class="absolute"
                  :style="{ left: (t.offset / d.gantt.span * 100) + '%' }"
                >{{ t.label }}</span>
              </div>
            </div>
            <div
              v-for="r in d.gantt.rows"
              :key="r.booking_id"
              class="grid grid-cols-[200px_1fr] items-center gap-0"
            >
              <NuxtLink
                :to="r.event_id ? `/events/${r.event_id}` : `/bookings/${r.booking_id}`"
                class="truncate pr-2 text-sm font-semibold text-[#0B0B0C]"
              >{{ r.label }}</NuxtLink>
              <div class="relative h-[26px] rounded bg-[#F2F3F5]">
                <span
                  class="absolute top-0 bottom-0 w-0.5 bg-[#ED1B24]"
                  :style="{ left: (d.gantt.today_offset / d.gantt.span * 100) + '%' }"
                />
                <span
                  class="absolute top-[3px] bottom-[3px] min-w-2.5 rounded-[3px]"
                  :style="`left:${Math.max(0, r.offset) / d.gantt.span * 100}%;width:${r.days / d.gantt.span * 100}%;${GANTT[r.kind]}`"
                />
                <span
                  class="absolute top-1/2 -translate-y-1/2 text-xs font-bold whitespace-nowrap"
                  :style="{ left: `calc(${(Math.max(0, r.offset) + r.days) / d.gantt.span * 100}% + 6px)` }"
                >{{ r.text }}</span>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap gap-4 text-[13px] text-[#565B66]">
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm bg-[#2F5596]" />Confirmed</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm border border-dashed border-[#2F5596] bg-white" />Quote / contract out</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm bg-[#9AA0AB]" />Completed</span>
              <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 bg-[#ED1B24]" />Today</span>
            </div>
          </div>
        </div>
      </section>

      <div
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr))"
      >
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Recent bookings
            </h2>
            <NuxtLink
              to="/bookings"
              class="text-sm font-semibold"
            >All bookings</NuxtLink>
          </div>
          <div
            v-for="r in d.recent_bookings"
            :key="r.id"
            class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3"
          >
            <div>
              <NuxtLink
                :to="`/bookings/${r.id}`"
                class="font-bold text-[#0B0B0C]"
              >{{ r.name }}</NuxtLink>
              <div class="text-[13px] text-[#565B66]">
                {{ r.meta }}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UiBadge
                :tone="BOOKING_STAGE[r.stage] ?? TONES.grey"
                :label="r.stage_label"
              />
              <span
                v-if="r.total !== null"
                class="font-display text-lg font-bold"
              >{{ peso(r.total) }}</span>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-4 rounded-lg bg-[#0B0B0C] p-5 text-white">
          <div class="flex items-start justify-between gap-3">
            <img
              src="/logo.png"
              alt="Blaster Pro Audio Touring Group"
              class="h-auto w-[220px]"
            >
            <NuxtLink
              v-if="isAdminish"
              to="/company"
              class="btn btn-sm border border-[#3B3F47] bg-transparent text-white hover:text-white"
            >Edit profile</NuxtLink>
          </div>
          <h2 class="h-section m-0">
            Company &amp; portfolio
          </h2>
          <p class="m-0 text-sm text-[#C9CCD2]">
            {{ d.company.history }}
          </p>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="[l, v] in [['Events done', d.company.events_done], ['Clients', d.company.clients], ['Items owned', d.company.items_owned]]"
              :key="l"
              class="rounded-md bg-[#1A1B1E] p-3"
            >
              <div class="text-[13px] text-[#9EA3AD]">
                {{ l }}
              </div>
              <div class="figure text-[28px]">
                {{ v }}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="p in d.company.photos"
              :key="p.id"
              class="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-[#5B606B] text-sm text-[#9EA3AD]"
            >
              {{ p.caption }}
            </div>
          </div>
        </section>
      </div>

      <ClientsClientPanel
        v-model:open="clientOpen"
        @saved="(c: Row) => notify(`${c.name} was added to Clients.`)"
      />
    </template>
  </div>
</template>
