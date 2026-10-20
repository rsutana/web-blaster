<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'payroll', title: 'Payroll' })
useHead({ title: 'Payroll · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()

const schedule = ref('semi_monthly')
const date = ref(todayIso())
const run = ref<Row | null>(null)
const eventFilter = ref('all')
const selected = ref<number[]>([])
const busy = ref(false)

async function load() {
  run.value = (await api.get<{ data: Row }>('/payroll-cutoff', { schedule: schedule.value, date: date.value })).data
  selected.value = []
}
onMounted(load)
watch(schedule, () => {
  eventFilter.value = 'all'
  load()
})
watch(date, load)

const events = computed(() => {
  const map = new Map<number, string>()
  for (const l of run.value?.lines ?? []) {
    for (const e of l.events) {
      map.set(e.event_id, e.event_label)
    }
  }
  return [...map.entries()]
})
const lines = computed(() => (run.value?.lines ?? []).filter((l: Row) => eventFilter.value === 'all' || l.events.some((e: Row) => String(e.event_id) === eventFilter.value)))
const editable = computed(() => can('payroll', 'edit'))
const status = computed(() => run.value?.status ?? 'draft')
const shortLabel = (l: Row) => l.is_paid ? `Paid ${run.value!.payday_label}` : status.value === 'finalized' ? 'Ready to pay' : 'Unpaid'

async function setStatus(to: string) {
  busy.value = true
  try {
    run.value = (await api.patch<{ data: Row }>(`/payroll-runs/${run.value!.id}`, { status: to })).data
    notify(to === 'finalized' ? `Run finalized. Attendance in ${run.value!.cutoff_label} is now locked.` : to === 'paid' ? `Run marked as paid on ${run.value!.payday_label}.` : 'Run reopened. Attendance can be changed again.')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function paySelected() {
  try {
    run.value = (await api.post<{ data: Row }>(`/payroll-runs/${run.value!.id}/line-payments`, { line_ids: selected.value })).data
    notify(`${plural(selected.value.length, 'person', 'people')} marked as paid.`)
    selected.value = []
  } catch (e) {
    fail(e)
  }
}

async function exportPayslips() {
  const res = await api.raw(`/payroll-runs/${run.value!.id}/payslips`)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(res._data as Blob)
  a.download = `payslips-${run.value!.schedule}-${run.value!.cutoff_start}.csv`
  a.click()
}

const scheduleRule = computed(() => ({
  daily: 'Daily: one day per run, paid the same day.',
  weekly: 'Weekly: Monday to Sunday, paid the day after the cutoff.',
  semi_monthly: 'Every 15 days: 1st–15th paid on the 16th, 16th–end paid on the 1st.',
  monthly: 'Monthly: the calendar month, paid on the 1st of the next month. Flat per-event pay is paid in the run that covers the event\'s first day.'
} as Record<string, string>)[schedule.value])
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Payroll"
      subtitle="Each person is paid on their own schedule. A run adds up their event pay in the cutoff, then takes off advances and deductions."
    >
      <template #actions>
        <button
          type="button"
          class="btn btn-strong"
          :disabled="!run"
          @click="exportPayslips"
        >
          Export payslips
        </button>
        <template v-if="editable && run">
          <button
            v-if="status === 'draft'"
            type="button"
            class="btn btn-primary"
            :disabled="busy || !run.lines.length"
            @click="setStatus('finalized')"
          >
            Finalize run
          </button>
          <template v-else-if="status === 'finalized'">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="busy"
              @click="setStatus('draft')"
            >
              Reopen run
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="busy"
              @click="setStatus('paid')"
            >
              Mark run as paid
            </button>
          </template>
        </template>
      </template>
    </UiPageHeader>

    <UiSkeletonPage
      v-if="!run"
      variant="payroll"
    />
    <template v-else>
      <section class="card flex flex-col gap-3 p-5">
        <div class="flex flex-wrap items-end gap-4">
          <fieldset class="m-0 min-w-[360px] flex-[2_1_360px] border-0 p-0">
            <legend class="mb-1.5 text-sm font-semibold">
              Pay schedule
            </legend>
            <UiSegmented
              v-model="schedule"
              name="schedule"
              :options="[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'semi_monthly', label: 'Every 15 days' }, { value: 'monthly', label: 'Monthly' }]"
            />
          </fieldset>
          <div class="flex flex-[1_1_260px] flex-col gap-1.5">
            <span class="text-sm font-semibold">Cutoff</span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                aria-label="Previous cutoff"
                @click="date = run.previous_date"
              >
                ‹
              </button>
              <div class="flex min-h-12 flex-1 items-center rounded-md border border-[#DADDE3] bg-[#F2F3F5] px-3 text-[15px] whitespace-nowrap">
                <b>{{ run.cutoff_label }}</b>&nbsp;· payday {{ run.payday_label }}
              </div>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                aria-label="Next cutoff"
                @click="date = run.next_date"
              >
                ›
              </button>
            </div>
          </div>
          <label class="field-label flex-[1_1_220px]">Event
            <select
              v-model="eventFilter"
              class="ctl"
              style="min-height: 48px"
            >
              <option value="all">All events in this cutoff</option>
              <option
                v-for="[id, l] in events"
                :key="id"
                :value="String(id)"
              >{{ l }}</option>
            </select>
          </label>
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Run status</span>
            <span
              class="inline-flex min-h-12 items-center rounded-md px-4 text-[13px] font-bold tracking-[.05em] uppercase"
              :style="{ background: RUN_STATUS[status]!.bg, color: RUN_STATUS[status]!.fg }"
            >{{ run.status_label }}</span>
          </div>
        </div>
        <p class="m-0 text-sm text-[#565B66]">
          {{ run.description }}
        </p>
      </section>

      <section
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
      >
        <UiStatCard
          label="Gross event pay"
          :value="peso(run.totals.gross)"
          value-class="text-[40px]"
        />
        <UiStatCard
          label="Advances & deductions"
          :value="run.totals.deductions ? '− ' + peso(run.totals.deductions) : '₱0'"
          value-class="text-[40px] text-[#B4121A]"
        />
        <UiStatCard
          variant="blue"
          label="Net payable"
          :value="peso(run.totals.net)"
          value-class="text-[40px]"
        />
        <UiStatCard
          variant="dark"
          label="Advances owed after run"
          :value="peso(run.totals.advances_owed_after)"
          value-class="text-[40px]"
        />
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            People in this run
          </h2>
          <div
            v-if="selected.length"
            class="flex items-center gap-2"
          >
            <span class="text-sm font-semibold">{{ selected.length }} selected</span>
            <button
              type="button"
              class="btn btn-dark btn-sm"
              @click="paySelected"
            >
              Mark selected as paid
            </button>
          </div>
          <span
            v-else
            class="text-sm text-[#565B66]"
          >{{ status === 'finalized' ? 'Tick people to mark them paid one by one.' : 'Rows group each person\'s events. Rates differ per event.' }}</span>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 1040px"
          >
            <thead>
              <tr>
                <th><span class="sr-only">Select</span></th><th>Person / event</th><th>Rate</th><th>Worked</th><th class="text-right">
                  Gross
                </th><th class="text-right">
                  Advance
                </th><th class="text-right">
                  Other ded.
                </th><th class="text-right">
                  Net pay
                </th><th>Status</th>
              </tr>
            </thead>
            <tbody
              v-for="l in lines"
              :key="l.personnel_id"
            >
              <tr :class="l.id && selected.includes(l.id) ? 'bg-[#E6ECF6]' : 'bg-[#FAFAFB]'">
                <td data-cell="select">
                  <input
                    v-model="selected"
                    type="checkbox"
                    :value="l.id"
                    :disabled="!l.id || l.is_paid || status !== 'finalized' || !editable"
                    :aria-label="`Select ${l.name}`"
                    class="size-[18px] accent-[#2F5596]"
                  >
                </td>
                <td data-cell="title">
                  <NuxtLink
                    :to="`/personnel/${l.personnel_id}`"
                    class="text-[15px] font-bold text-[#0B0B0C]"
                  >{{ l.name }}</NuxtLink><span class="text-[#565B66]"> · {{ l.sub }}</span>
                </td>
                <td />
                <td />
                <td
                  data-label="Gross"
                  class="text-right font-semibold"
                >
                  {{ peso(l.gross) }}
                </td>
                <td
                  data-label="Advance"
                  class="text-right"
                >
                  <template v-if="l.advance_amount > 0">
                    <span class="text-[#B4121A]">− {{ peso(l.advance_amount) }}</span><div class="sub text-[13px]">
                      {{ peso(l.advance_balance_after) }} left
                    </div>
                  </template><span
                    v-else
                    class="text-[#565B66]"
                  >—</span>
                </td>
                <td
                  data-label="Other ded."
                  class="text-right"
                >
                  <template v-if="l.other_deductions > 0">
                    <span class="text-[#B4121A]">− {{ peso(l.other_deductions) }}</span><div class="sub text-[13px]">
                      {{ l.deductions_note }}
                    </div>
                  </template><span
                    v-else
                    class="text-[#565B66]"
                  >—</span>
                </td>
                <td
                  data-label="Net pay"
                  class="text-right"
                >
                  <span class="font-display text-[22px] font-extrabold">{{ peso(l.net) }}</span>
                </td>
                <td data-label="Status">
                  <UiBadge
                    :tone="l.is_paid ? RUN_STATUS.paid! : RUN_STATUS[status]!"
                    :label="shortLabel(l)"
                  />
                </td>
              </tr>
              <tr
                v-for="e in l.events"
                :key="e.event_id"
                class="text-[#3B3F47]"
              >
                <td data-cell="select" />
                <td
                  data-label="Event"
                  style="padding-left: 28px"
                >
                  {{ e.event_label }}<div class="sub text-[13px]">
                    {{ e.dates }} · {{ e.role }}
                  </div>
                </td>
                <td data-label="Rate">
                  {{ e.rate_label }}
                </td>
                <td data-label="Worked">
                  {{ e.worked_label }}<div
                    v-if="e.extra_label"
                    class="sub text-[13px]"
                  >
                    {{ e.extra_label }}
                  </div>
                </td>
                <td
                  data-label="Gross"
                  class="text-right"
                >
                  {{ peso(e.gross) }}
                </td>
                <td /><td /><td /><td />
              </tr>
            </tbody>
            <tfoot v-if="lines.length">
              <tr class="border-t-2 border-[#0B0B0C]">
                <th
                  colspan="4"
                  class="px-4 py-3.5 text-left"
                  data-label=""
                >
                  <span class="eyebrow font-bold">Run total · {{ plural(run.totals.people, 'person', 'people') }}</span>
                </th>
                <td
                  class="text-right font-semibold"
                  data-label="Gross"
                >
                  {{ peso(run.totals.gross) }}
                </td>
                <td
                  colspan="2"
                  class="text-right text-[#B4121A]"
                  data-label="Deductions"
                >
                  − {{ peso(run.totals.deductions) }}
                </td>
                <td
                  class="text-right"
                  data-label="Net"
                >
                  <span class="font-display text-2xl font-extrabold text-[#2F5596]">{{ peso(run.totals.net) }}</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <UiEmpty
          v-if="!lines.length"
          :text="run.lines.length ? 'Nobody in this run worked that event.' : 'Nobody on this schedule worked in this cutoff.'"
          :action="run.lines.length ? 'Show all events' : undefined"
          @action="eventFilter = 'all'"
        />
        <div class="flex flex-col gap-1 border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
          <span>Showing {{ lines.length }} of {{ run.lines.length }} people{{ eventFilter !== 'all' ? ' · ' + events.find(([id]) => String(id) === eventFilter)?.[1] : '' }}</span>
          <span>{{ scheduleRule }} A person only appears in runs for their own pay schedule.</span>
        </div>
      </section>
    </template>
  </div>
</template>
