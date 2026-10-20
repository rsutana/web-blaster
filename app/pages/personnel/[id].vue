<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'crew', title: 'Personnel profile' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()

const p = ref<Row | null>(null)
const editOpen = ref(false)
const deleteOpen = ref(false)
const moneyOpen = ref(false)
const moneyKind = ref<'advance' | 'deduction'>('advance')

async function load() {
  p.value = (await api.get<{ data: Row }>(`/personnel/${route.params.id}`)).data
  useHead({ title: `${p.value.full_name} · Blaster Pro Audio` })
}
onMounted(load)

const money = computed(() => p.value?.can_see_money)
const prof = computed(() => p.value?.profile ?? {})

function openMoney(kind: 'advance' | 'deduction') {
  moneyKind.value = kind
  moneyOpen.value = true
}

async function reactivate() {
  try {
    await api.del(`/personnel/${p.value!.id}/deactivation`)
    await load()
    notify(`${p.value!.full_name} is Active again.`)
  } catch (e) {
    fail(e)
  }
}

async function deleteDeduction(d: Row) {
  try {
    await api.del(`/deductions/${d.id}`)
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <UiSpinner v-if="!p" />
    <template v-else>
      <nav
        aria-label="Breadcrumb"
        class="text-sm"
      >
        <NuxtLink to="/personnel">Personnel</NuxtLink> <span class="text-[#9AA0AB]">/</span> <span class="text-[#565B66]">{{ p.full_name }}</span>
      </nav>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex items-center gap-4">
          <span
            aria-hidden="true"
            class="font-display inline-flex size-[72px] flex-none items-center justify-center rounded-lg text-[32px] font-extrabold text-white"
            :class="p.status === 'active' ? 'bg-[#0B0B0C]' : 'bg-[#9AA0AB]'"
          >{{ p.initials }}</span>
          <div class="flex flex-col gap-1.5">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="h-page m-0">
                {{ p.full_name }}
              </h1>
              <UiBadge
                :tone="p.status === 'active' ? TONES.green : TONES.black"
                :label="p.status === 'active' ? 'Active' : 'Inactive'"
              />
            </div>
            <p class="m-0 text-[15px] text-[#565B66]">
              Usual role: {{ p.usual_role_label }} · <a :href="`tel:+63${p.mobile?.slice(1)}`">{{ phone(p.mobile) }}</a> · {{ p.payout_method_label }}{{ p.wallet_number ? ' ' + phone(p.wallet_number) : '' }}
            </p>
          </div>
        </div>
        <div
          v-if="can('crew', 'edit')"
          class="flex flex-wrap gap-2.5"
        >
          <button
            v-if="p.status === 'active'"
            type="button"
            class="btn btn-red-text"
            @click="deleteOpen = true"
          >
            Delete
          </button>
          <button
            type="button"
            class="btn btn-strong"
            @click="editOpen = true"
          >
            Edit profile
          </button>
          <button
            v-if="money && can('payroll', 'edit')"
            type="button"
            class="btn btn-primary"
            @click="openMoney('advance')"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-[18px]"
            />Record advance
          </button>
        </div>
      </header>

      <div
        v-if="p.status !== 'active'"
        class="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#0B0B0C] px-4 py-3.5 text-white"
      >
        <span class="flex-[1_1_320px] text-[15px]"><b>Inactive</b> · {{ p.inactive_reason_label }}. <span class="text-[#C9CCD2]">Not available for new events, and their Crew login is off. Pay history, unpaid pay and any advance balance are kept.</span></span>
        <button
          v-if="can('crew', 'edit')"
          type="button"
          class="btn bg-white font-bold text-[#0B0B0C]"
          @click="reactivate"
        >
          Reactivate
        </button>
      </div>

      <section
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
      >
        <UiStatCard
          label="Pay schedule"
          :value="p.pay_schedule_label"
          :sub="prof.summary.schedule_note"
          value-class="text-[30px]"
        />
        <UiStatCard
          v-if="money"
          variant="blue"
          label="Earned this cutoff"
          :value="peso(prof.summary.earned_this_cutoff)"
          :sub="prof.summary.cutoff_label"
          value-class="text-[40px]"
        />
        <UiStatCard
          v-if="money"
          variant="dark"
          label="Advance balance"
          :value="peso(prof.summary.advance_balance)"
          :sub="prof.summary.advance_note"
          value-class="text-[40px]"
        />
        <UiStatCard
          label="App access"
          :value="p.login?.state === 'crew' ? 'Crew login' : p.login?.state === 'disabled' ? 'Login off' : 'No login'"
          :sub="p.login?.state === 'crew' ? 'can scan · sees own pay' : p.status !== 'active' ? 'turned off while Inactive' : 'an admin records attendance'"
          value-class="text-[30px]"
        />
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <div>
            <h2 class="h-section m-0">
              Events{{ money ? ' & rates' : '' }}
            </h2>
            <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
              The rate is set per event, so it changes from event to event.
            </p>
          </div>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 800px"
          >
            <thead>
              <tr>
                <th>Event</th><th>Dates</th><th>Role</th>
                <template v-if="money">
                  <th>Rate</th><th>OT rate</th><th class="text-right">
                    Event pay
                  </th>
                </template>
                <th>Paid in</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="e in prof.events"
                :key="e.event_id"
              >
                <td data-cell="title">
                  <NuxtLink
                    :to="`/events/${e.event_id}`"
                    class="font-semibold"
                  >{{ e.event_label }}</NuxtLink>
                </td>
                <td data-label="Dates">
                  {{ e.dates }}
                </td>
                <td data-label="Role">
                  {{ e.role }}
                </td>
                <template v-if="money">
                  <td data-label="Rate">
                    {{ e.rate_label }}
                  </td>
                  <td data-label="OT rate">
                    {{ e.ot_label }}
                  </td>
                  <td
                    data-label="Event pay"
                    class="text-right"
                  >
                    <span :class="e.is_estimate ? 'text-[#565B66]' : 'font-display text-lg font-bold'">{{ peso(e.pay) }}{{ e.is_estimate ? ' sched.' : '' }}</span>
                  </td>
                </template>
                <td data-label="Paid in">
                  {{ e.paid_in }} ·
                  <UiBadge
                    v-if="e.paid_status !== 'paid'"
                    :tone="e.paid_status === 'cancelled' ? TONES.grey : RUN_STATUS[e.paid_status] ?? TONES.amber"
                    :label="e.paid_status === 'draft' ? 'Unpaid' : e.paid_status"
                  />
                  <span
                    v-else
                    class="text-[#1D6B3C]"
                  >paid</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-if="!prof.events.length"
          text="Not on any event yet."
        />
      </section>

      <div
        v-if="money"
        class="grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fit, minmax(min(440px, 100%), 1fr))"
      >
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Cash advances
            </h2>
            <button
              v-if="can('payroll', 'edit')"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="openMoney('advance')"
            >
              + Record advance
            </button>
          </div>
          <div
            v-for="a in prof.advance_summary"
            :key="a.id"
            class="m-4 mb-0 rounded-md bg-[#F2F3F5] p-3 text-sm"
          >
            <b>{{ a.title }}</b><div class="text-[#565B66]">
              {{ a.detail }}
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Entry</th><th class="text-right">
                    Amount
                  </th><th class="text-right">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(l, i) in prof.advances"
                  :key="i"
                  :class="l.state === 'planned' ? 'text-[#9AA0AB]' : ''"
                >
                  <td data-label="Date">
                    {{ l.date }}
                  </td>
                  <td data-cell="title">
                    {{ l.entry }}<span
                      v-if="l.state === 'pending'"
                      class="font-semibold text-[#6B4100]"
                    > (pending)</span>
                  </td>
                  <td
                    data-label="Amount"
                    class="text-right"
                    :class="l.amount < 0 && l.state !== 'planned' ? 'text-[#B4121A]' : ''"
                  >
                    {{ l.amount > 0 ? '+ ' + peso(l.amount) : peso(l.amount) }}
                  </td>
                  <td
                    data-label="Balance"
                    class="text-right"
                  >
                    {{ peso(l.balance) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <UiEmpty
            v-if="!prof.advances.length"
            text="No advances."
          />
        </section>
        <section class="card flex flex-col">
          <div class="card-head">
            <h2 class="h-section m-0">
              Other deductions
            </h2>
            <button
              v-if="can('payroll', 'edit')"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="openMoney('deduction')"
            >
              + Add deduction
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Note</th><th class="text-right">
                    Amount
                  </th><th>Run</th><th><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="d in prof.deductions"
                  :key="d.id"
                >
                  <td data-label="Date">
                    {{ d.date }}
                  </td>
                  <td data-cell="title">
                    {{ d.type_label }}
                  </td>
                  <td data-label="Note">
                    {{ d.note }}
                  </td>
                  <td
                    data-label="Amount"
                    class="text-right text-[#B4121A]"
                  >
                    − {{ peso(d.amount) }}
                  </td>
                  <td data-label="Run">
                    {{ d.run }}
                  </td>
                  <td data-cell="actions">
                    <button
                      v-if="!d.is_applied && can('payroll', 'edit')"
                      type="button"
                      class="btn btn-red-text btn-xs"
                      @click="deleteDeduction(d)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <UiEmpty
            v-if="!prof.deductions.length"
            text="No deductions."
          />
          <div class="border-t border-[#DADDE3] px-5 py-3 text-[13px] text-[#565B66]">
            Types: equipment damage, uniform / gear, late or absence penalty, other. Each comes off the payroll run that covers its date.
          </div>
        </section>
      </div>

      <section
        v-if="money"
        class="card flex flex-col"
      >
        <div class="card-head">
          <h2 class="h-section m-0">
            Payout history
          </h2>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 760px"
          >
            <thead>
              <tr>
                <th>Cutoff</th><th>Events</th><th class="text-right">
                  Gross
                </th><th class="text-right">
                  Advance
                </th><th class="text-right">
                  Other ded.
                </th><th class="text-right">
                  Net
                </th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in prof.payouts"
                :key="i"
              >
                <td data-cell="title">
                  {{ r.cutoff }}
                </td>
                <td data-label="Events">
                  {{ r.events }}
                </td>
                <td
                  data-label="Gross"
                  class="text-right"
                >
                  {{ peso(r.gross) }}
                </td>
                <td
                  data-label="Advance"
                  class="text-right"
                >
                  {{ r.advance ? '− ' + peso(r.advance) : '—' }}
                </td>
                <td
                  data-label="Other ded."
                  class="text-right"
                >
                  {{ r.other ? '− ' + peso(r.other) : '—' }}
                </td>
                <td
                  data-label="Net"
                  class="text-right"
                >
                  <span
                    class="font-display text-xl font-extrabold"
                    :class="r.status === 'draft' ? 'text-[#2F5596]' : ''"
                  >{{ peso(r.net) }}</span>
                </td>
                <td data-label="Status">
                  <UiBadge
                    :tone="RUN_STATUS[r.status] ?? TONES.grey"
                    :label="r.status_label"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <UiEmpty
          v-if="!prof.payouts.length"
          text="No payroll runs yet."
        />
      </section>

      <PersonnelPersonPanel
        v-model:open="editOpen"
        :person="p"
        @saved="load"
        @deleted="load"
        @reactivated="load"
        @changed="load"
      />
      <PersonnelDeletePersonModal
        v-model:open="deleteOpen"
        :person="p"
        @deleted="load"
      />
      <PersonnelMoneyModal
        v-model:open="moneyOpen"
        :person="p"
        :kind="moneyKind"
        @saved="load"
      />
    </template>
  </div>
</template>
