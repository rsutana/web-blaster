<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'book', title: 'Bookings' })
useHead({ title: 'Bookings · Blaster Pro Audio' })

const api = useApi()
const route = useRoute()
const { can, canSeeRevenue } = useAuthUser()
const bookings = ref<Row[]>([])
const kpis = ref<Row>({})
const loading = ref(true)
const tab = ref('all')
const query = ref('')
const newOpen = ref(false)

onMounted(async () => {
  if (route.query.new) {
    newOpen.value = true
  }
  const res = await api.get<{ data: Row[], meta: { kpis: Row } }>('/bookings')
  bookings.value = res.data
  kpis.value = res.meta.kpis
  loading.value = false
})

const TABS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'quote', label: 'Quotes', test: (b: Row) => b.stage_key === 'quote' },
  { key: 'contract', label: 'Contracts', test: (b: Row) => b.stage_key === 'contract' },
  { key: 'confirmed', label: 'Confirmed', test: (b: Row) => ['confirmed', 'ongoing'].includes(b.stage_key) },
  { key: 'done', label: 'Completed', test: (b: Row) => b.stage_key === 'done' },
  { key: 'cancelled', label: 'Cancelled', test: (b: Row) => b.stage_key === 'cancelled' }
]
const match = (b: Row) => {
  const q = query.value.trim().toLowerCase()
  return !q || `${b.client.name} ${b.code} ${b.name}`.toLowerCase().includes(q)
}
const rows = computed(() => bookings.value.filter(b => TABS.find(t => t.key === tab.value)!.test(b) && match(b)))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: bookings.value.filter(b => t.test(b) && match(b)).length })))
const sums = computed(() => ({
  total: rows.value.reduce((n, b) => n + b.total, 0),
  paid: rows.value.reduce((n, b) => n + b.paid, 0),
  balance: rows.value.reduce((n, b) => n + Math.max(0, b.balance), 0)
}))

function nextLink(b: Row): string {
  return b.next_step.target === 'invoice' ? `/bookings/${b.id}?tab=invoices` : `/bookings/${b.id}?tab=${b.next_step.target === 'quote' ? 'quote' : b.next_step.target}`
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Bookings"
      subtitle="From first quote to final payment. A booking becomes an event once the contract is signed and the deposit is in."
    >
      <template #actions>
        <NuxtLink
          to="/bookings/packages"
          class="btn btn-strong"
        >
          Packages &amp; rates
        </NuxtLink>
        <button
          v-if="can('book', 'edit')"
          type="button"
          class="btn btn-primary"
          @click="newOpen = true"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />New booking
        </button>
      </template>
    </UiPageHeader>

    <section
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
    >
      <UiStatCard
        :loading="loading"
        label="Quotes out"
        :value="kpis.quotes_count"
        :sub="canSeeRevenue ? `${peso(kpis.quotes_total)} if all accepted` : undefined"
        value-class="text-[34px]"
      />
      <UiStatCard
        :loading="loading"
        label="Awaiting signature"
        :value="kpis.awaiting_count"
        :sub="kpis.awaiting_note"
        value-class="text-[34px]"
      />
      <UiStatCard
        v-if="canSeeRevenue"
        :loading="loading"
        variant="blue"
        label="Confirmed & upcoming"
        :value="peso(kpis.confirmed_total)"
        :sub="`${plural(kpis.confirmed_count ?? 0, 'booking')} · deposits in`"
        value-class="text-[34px]"
      />
      <UiStatCard
        v-if="canSeeRevenue"
        :loading="loading"
        variant="dark"
        label="Outstanding balance"
        :value="peso(kpis.outstanding)"
        :sub="kpis.overdue_note"
        value-class="text-[34px]"
      />
    </section>

    <section class="card flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter bookings"
        />
        <UiSearchBox
          v-model="query"
          label="Search bookings"
          placeholder="Search client or BK number"
        />
      </div>
      <UiSkeletonTable
        v-if="loading"
        :cols="7"
      />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 1040px"
        >
          <thead>
            <tr>
              <th>Booking</th><th>Dates</th><th>Stage</th>
              <template v-if="canSeeRevenue">
                <th class="text-right">
                  Total
                </th><th class="text-right">
                  Paid
                </th><th class="text-right">
                  Balance
                </th><th>Payment</th>
              </template>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in rows"
              :key="b.id"
            >
              <td data-cell="title">
                <NuxtLink
                  :to="`/bookings/${b.id}`"
                  class="text-[15px] font-bold text-[#0B0B0C]"
                >{{ b.name }}</NuxtLink>
                <div class="sub">
                  {{ b.client.name }} · <span class="font-mono text-xs">{{ b.code }}</span>
                </div>
              </td>
              <td
                data-label="Dates"
                class="whitespace-nowrap"
              >
                {{ b.dates_label }}
              </td>
              <td data-label="Stage">
                <UiBadge
                  :tone="BOOKING_STAGE[b.stage_key]!"
                  :label="b.stage_label"
                />
              </td>
              <template v-if="canSeeRevenue">
                <td
                  data-label="Total"
                  class="text-right font-bold whitespace-nowrap"
                >
                  {{ b.total ? peso(b.total) : '—' }}
                </td>
                <td
                  data-label="Paid"
                  class="text-right whitespace-nowrap"
                >
                  {{ b.paid ? peso(b.paid) : '—' }}
                </td>
                <td
                  data-label="Balance"
                  class="text-right whitespace-nowrap"
                  :class="b.payment.key === 'overdue' ? 'font-semibold text-[#B4121A]' : ''"
                >
                  {{ b.balance > 0 && b.stage_key !== 'cancelled' ? peso(b.balance) : '—' }}
                </td>
                <td data-label="Payment">
                  <UiBadge
                    :tone="PAYMENT_STATUS[b.payment.key] ?? TONES.grey"
                    :label="b.payment.label"
                  />
                </td>
              </template>
              <td data-label="Next step">
                <NuxtLink
                  v-if="b.next_step.target !== 'none'"
                  :to="nextLink(b)"
                  class="font-semibold"
                >{{ b.next_step.text }}</NuxtLink>
                <span
                  v-else
                  class="text-[#565B66]"
                >None</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !rows.length"
        text="No bookings match."
        action="Clear filters"
        @action="tab = 'all'; query = ''"
      />
      <div class="flex flex-wrap justify-between gap-2 border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
        <span>{{ rows.length }} of {{ bookings.length }} bookings</span>
        <span v-if="canSeeRevenue">Shown: <b class="text-[#0B0B0C]">{{ peso(sums.total) }}</b> booked · <b class="text-[#1D6B3C]">{{ peso(sums.paid) }}</b> paid · <b class="text-[#B4121A]">{{ peso(sums.balance) }}</b> balance</span>
      </div>
    </section>
    <BookingsNewBookingPanel v-model:open="newOpen" />
  </div>
</template>
