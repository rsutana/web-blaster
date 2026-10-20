<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'crew', title: 'Crew' })
useHead({ title: 'Personnel · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can, canSeeRates } = useAuthUser()

const people = ref<Row[]>([])
const loading = ref(true)
const tab = ref('active')
const role = ref('all')
const sched = ref('all')
const query = ref('')
const page = ref(1)
const panelOpen = ref(false)
const editing = ref<Row | null>(null)
const deleting = ref<Row | null>(null)
const deleteOpen = ref(false)

async function load() {
  people.value = (await api.get<{ data: Row[] }>('/personnel')).data
  loading.value = false
}
onMounted(load)

const TABS = [
  { key: 'active', label: 'Active', test: (p: Row) => p.status === 'active' },
  { key: 'today', label: 'On event today', test: (p: Row) => p.status === 'active' && p.event_line?.is_today },
  { key: 'free', label: 'Free today', test: (p: Row) => p.status === 'active' && !p.event_line?.is_today },
  { key: 'inactive', label: 'Inactive', test: (p: Row) => p.status !== 'active' }
]
const ROLES = [['all', 'All roles'], ['audio_engineer', 'Audio engineer'], ['driver', 'Driver'], ['event_lead', 'Event lead'], ['lights', 'Lights'], ['rigger', 'Rigger'], ['sound_tech', 'Sound tech'], ['stagehand', 'Stagehand'], ['utility', 'Utility'], ['video_tech', 'Video tech']]
const SCHEDS = [['all', 'All schedules'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['semi_monthly', 'Every 15 days'], ['monthly', 'Monthly']]

const match = (p: Row) => {
  const q = query.value.trim().toLowerCase()
  return (role.value === 'all' || p.usual_role === role.value) && (sched.value === 'all' || p.pay_schedule === sched.value)
    && (!q || `${p.full_name} ${p.usual_role_label} ${p.event_line?.line} ${p.event_line?.note}`.toLowerCase().includes(q))
}
const filtered = computed(() => people.value.filter(p => TABS.find(t => t.key === tab.value)!.test(p) && match(p)))
const rows = computed(() => filtered.value.slice((page.value - 1) * 15, page.value * 15))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: people.value.filter(p => t.test(p) && match(p)).length })))
const hasFilters = computed(() => tab.value !== 'active' || role.value !== 'all' || sched.value !== 'all' || !!query.value.trim())
watch([tab, role, sched, query], () => {
  page.value = 1
})

const stats = computed(() => {
  const active = people.value.filter(p => p.status === 'active')
  const logins = people.value.filter(p => p.login?.state === 'crew')
  const advances = people.value.filter(p => (p.advance?.balance ?? 0) > 0)
  return {
    active: active.length,
    inactive: people.value.length - active.length,
    today: active.filter(p => p.event_line?.is_today).length,
    logins: logins.length,
    loginNote: [logins.filter(p => p.login.note === 'not signed in yet').length + ' not signed in', logins.filter(p => p.login.note === 'locked').length + ' locked'].join(' · '),
    advance: advances.reduce((n, p) => n + p.advance.balance, 0),
    advancePeople: advances.length
  }
})

function clear() {
  tab.value = 'active'
  role.value = 'all'
  sched.value = 'all'
  query.value = ''
}

function add() {
  editing.value = null
  panelOpen.value = true
}

function edit(p: Row) {
  editing.value = p
  panelOpen.value = true
}

function del(p: Row) {
  deleting.value = p
  deleteOpen.value = true
}

async function reactivate(p: Row, undo = true) {
  try {
    await api.del(`/personnel/${p.id}/deactivation`)
    await load()
    if (undo) {
      notify(`${p.full_name} is Active again and can be added to events.`, async () => {
        await api.post(`/personnel/${p.id}/deactivation`, { reason: p.inactive_reason ?? 'other' })
        await load()
      })
    }
  } catch (e) {
    fail(e)
  }
}

async function onDeleted(p: Row, label: string) {
  await load()
  notify(`${p.full_name} is now Inactive · ${label}.`, () => reactivate(p, false))
}

async function onSaved(p: Row, isNew: boolean, pin?: string | null) {
  await load()
  notify(isNew ? `${p.full_name} was added.${pin ? ` Temporary PIN ${pin.slice(0, 3)} ${pin.slice(3)}. Hand it over in person.` : ''}` : `Saved ${p.full_name}.`)
}

async function exportCsv() {
  const header = ['Name', 'Mobile', 'Usual role', 'Pay schedule', 'Payout', 'Status', 'App login']
  const lines = filtered.value.map(p => [p.full_name, p.mobile, p.usual_role_label, p.pay_schedule_label, p.payout_method_label, p.status, p.login?.state])
  const csv = [header, ...lines].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'personnel.csv'
  a.click()
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Personnel"
      subtitle="Everyone you assign to events and pay. Rates are set per event, not here."
    >
      <template #actions>
        <button
          type="button"
          class="btn btn-strong"
          @click="exportCsv"
        >
          Export list
        </button>
        <button
          v-if="can('crew', 'edit')"
          type="button"
          class="btn btn-primary"
          aria-haspopup="dialog"
          @click="add"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add person
        </button>
      </template>
    </UiPageHeader>

    <section
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
    >
      <UiStatCard
        variant="dark"
        label="Active personnel"
      >
        <div class="flex items-baseline gap-1.5">
          <span class="figure text-[44px]">{{ stats.active }}</span><span class="text-sm text-[#C9CCD2]">· {{ stats.inactive }} inactive</span>
        </div>
      </UiStatCard>
      <UiStatCard
        variant="red"
        label="On an event today"
        :value="stats.today"
      />
      <UiStatCard
        label="With app login"
        :value="stats.logins"
        :sub="stats.loginNote"
      />
      <UiStatCard
        v-if="canSeeRates"
        label="Advances outstanding"
        :value="peso(stats.advance)"
        :sub="plural(stats.advancePeople, 'person', 'people')"
      />
    </section>

    <section class="card flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter personnel"
        />
        <div class="flex flex-wrap items-center gap-2">
          <UiSearchBox
            v-model="query"
            label="Search personnel"
            placeholder="Name, role, event"
            :width="220"
          />
          <label class="flex items-center gap-2 text-sm text-[#565B66]">Role
            <select
              v-model="role"
              class="ctl ctl-sm"
              style="width: auto"
            ><option
              v-for="[v, l] in ROLES"
              :key="v"
              :value="v"
            >{{ l }}</option></select>
          </label>
          <label class="flex items-center gap-2 text-sm text-[#565B66]">Pay
            <select
              v-model="sched"
              class="ctl ctl-sm"
              style="width: auto"
            ><option
              v-for="[v, l] in SCHEDS"
              :key="v"
              :value="v"
            >{{ l }}</option></select>
          </label>
          <button
            v-if="hasFilters"
            type="button"
            class="min-h-10 cursor-pointer border-0 bg-transparent px-2.5 text-sm font-semibold text-[#2F5596] underline"
            @click="clear"
          >
            Clear filters
          </button>
        </div>
      </div>
      <UiSpinner v-if="loading" />
      <div
        v-else
        class="tbl-wrap"
      >
        <table
          class="tbl"
          style="min-width: 1080px"
        >
          <thead>
            <tr>
              <th>Name</th><th>Usual role</th><th>Pay schedule</th><th>App login</th><th>Today / next event</th>
              <template v-if="canSeeRates">
                <th class="text-right">
                  Unpaid
                </th><th class="text-right">
                  Advance
                </th>
              </template>
              <th>Status</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in rows"
              :key="p.id"
            >
              <td data-cell="title">
                <div class="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    class="font-display inline-flex size-[34px] flex-none items-center justify-center rounded-md text-sm font-bold text-white"
                    :class="p.status === 'active' ? 'bg-[#0B0B0C]' : 'bg-[#9AA0AB]'"
                  >{{ p.initials }}</span>
                  <div>
                    <NuxtLink
                      :to="`/personnel/${p.id}`"
                      class="text-[15px] font-bold"
                      :class="p.status === 'active' ? 'text-[#0B0B0C]' : 'text-[#565B66]'"
                    >{{ p.full_name }}</NuxtLink>
                    <div class="sub">
                      {{ phone(p.mobile) }}
                    </div>
                  </div>
                </div>
              </td>
              <td data-label="Usual role">
                {{ p.usual_role_label }}
              </td>
              <td data-label="Pay schedule">
                {{ p.pay_schedule_label }}
              </td>
              <td data-label="App login">
                {{ p.login?.state === 'crew' ? 'Crew' : p.login?.state === 'disabled' ? 'Login disabled' : 'No login' }}
                <div
                  v-if="p.login?.note"
                  class="mt-0.5 font-semibold"
                  :class="p.login.note === 'locked' ? 'text-[#B4121A]' : 'text-[#6B4100]'"
                >
                  {{ p.login.note }}
                </div>
              </td>
              <td data-label="Today / next">
                <span :class="p.event_line?.is_today ? 'font-bold text-[#B4121A]' : ''">{{ p.event_line?.line }}</span>
                <div class="sub">
                  {{ p.event_line?.note }}
                </div>
              </td>
              <template v-if="canSeeRates">
                <td
                  data-label="Unpaid"
                  class="text-right"
                >
                  <span class="font-display text-lg font-bold">{{ peso(p.unpaid?.amount ?? 0) }}</span>
                  <div class="sub text-[13px]">
                    {{ p.unpaid?.note }}
                  </div>
                </td>
                <td
                  data-label="Advance"
                  class="text-right"
                >
                  <template v-if="p.advance?.balance > 0">
                    {{ peso(p.advance.balance) }}<div class="sub text-[13px]">
                      {{ p.advance.note }}
                    </div>
                  </template>
                  <template v-else-if="p.advance?.note">
                    ₱0<div class="sub text-[13px]">
                      {{ p.advance.note }}
                    </div>
                  </template>
                  <span
                    v-else
                    class="text-[#565B66]"
                  >—</span>
                </td>
              </template>
              <td data-label="Status">
                <UiBadge
                  :tone="p.status === 'active' ? TONES.green : TONES.black"
                  :label="p.status === 'active' ? 'Active' : 'Inactive'"
                />
                <div
                  v-if="p.status !== 'active'"
                  class="mt-1 text-[13px] text-[#565B66]"
                >
                  {{ p.notes === 'One-time helper' ? p.notes : p.inactive_reason_label }}
                </div>
              </td>
              <td
                data-cell="actions"
                class="text-right whitespace-nowrap"
              >
                <div
                  v-if="can('crew', 'edit')"
                  class="inline-flex gap-1.5"
                >
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="edit(p)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="p.status === 'active'"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    @click="del(p)"
                  >
                    Delete
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn btn-sm btn-outline-blue"
                    style="border-width: 1px"
                    @click="reactivate(p)"
                  >
                    Reactivate
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UiEmpty
        v-if="!loading && !filtered.length"
        text="No people match these filters."
        action="Clear filters"
        @action="clear"
      />
      <UiPager
        v-model="page"
        :total="filtered.length"
        :per-page="15"
        noun="people"
      />
    </section>

    <PersonnelPersonPanel
      v-model:open="panelOpen"
      :person="editing"
      @saved="onSaved"
      @deleted="onDeleted"
      @reactivated="(p: Row) => { load(); notify(`${p.full_name} is Active again.`) }"
      @changed="load"
    />
    <PersonnelDeletePersonModal
      v-if="deleting"
      v-model:open="deleteOpen"
      :person="deleting"
      @deleted="onDeleted"
    />
  </div>
</template>
