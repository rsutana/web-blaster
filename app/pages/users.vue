<script setup lang="ts">
import type { Row } from '~/types/api'
import type { Tone } from '~/utils/badges'

definePageMeta({ module: 'users', title: 'Users & roles' })
useHead({ title: 'Users & roles · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()

const users = ref<Row[]>([])
const perms = ref<Row | null>(null)
const draft = ref<Record<string, Record<string, string>>>({})
const tab = ref('all')
const query = ref('')
const panelOpen = ref(false)
const editing = ref<Row | null>(null)
const credOpen = ref(false)
const credKind = ref<'reset' | 'disable' | 'enable'>('reset')
const credUser = ref<Row | null>(null)
const saving = ref(false)

async function loadUsers() {
  users.value = (await api.get<{ data: Row[] }>('/users')).data
}
async function loadPerms() {
  perms.value = (await api.get<{ data: Row }>('/permissions')).data
  draft.value = JSON.parse(JSON.stringify(perms.value.grid))
}
onMounted(() => {
  loadUsers()
  loadPerms()
})

const TABS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'admins', label: 'Owner & admins', test: (u: Row) => ['owner', 'admin'].includes(u.role) },
  { key: 'managers', label: 'Managers', test: (u: Row) => u.role === 'manager' },
  { key: 'crew', label: 'Crew', test: (u: Row) => u.role === 'crew' },
  { key: 'attention', label: 'Locked / new', test: (u: Row) => ['locked', 'temp', 'temppw'].includes(u.status) },
  { key: 'disabled', label: 'Disabled', test: (u: Row) => u.status === 'disabled' }
]
const match = (u: Row) => {
  const q = query.value.trim().toLowerCase()
  return !q || `${u.name} ${u.email} ${u.mobile} ${u.personnel?.name}`.toLowerCase().includes(q)
}
const rows = computed(() => users.value.filter(u => TABS.find(t => t.key === tab.value)!.test(u) && match(u)))
const tabs = computed(() => TABS.map(t => ({ key: t.key, label: t.label, count: users.value.filter(u => t.test(u) && match(u)).length })))
const ROLE_TONE: Record<string, Tone> = { owner: TONES.live, admin: TONES.black, manager: TONES.blueTint, crew: TONES.blue }
const STATUS_TONE: Record<string, Tone> = { active: TONES.green, locked: TONES.live, temp: TONES.amber, temppw: TONES.amber, disabled: TONES.grey }
const LEVEL: Record<string, { bg: string, fg: string }> = { none: { bg: '#F2F3F5', fg: '#565B66' }, own: { bg: '#FFF1D6', fg: '#6B4100' }, view: { bg: '#FFFFFF', fg: '#0B0B0C' }, edit: { bg: '#E6ECF6', fg: '#244677' }, full: { bg: '#0B0B0C', fg: '#FFFFFF' } }
const changes = computed(() => {
  if (!perms.value) {
    return 0
  }
  let n = 0
  for (const role of ['admin', 'manager', 'crew']) {
    for (const m of perms.value.modules) {
      if (draft.value[role]?.[m.key] !== perms.value.grid[role][m.key]) {
        n++
      }
    }
  }
  return n
})
const editableGrid = computed(() => perms.value?.is_editable ?? false)

function openAdd() {
  editing.value = null
  panelOpen.value = true
}
function openEdit(u: Row) {
  editing.value = u
  panelOpen.value = true
}
function openCred(u: Row, kind: 'reset' | 'disable' | 'enable') {
  credUser.value = u
  credKind.value = kind
  credOpen.value = true
}

async function unlock(u: Row) {
  try {
    await api.del(`/users/${u.id}/lock`)
    await loadUsers()
    notify(`${u.name} is unlocked and can sign in with their current ${u.credential_word}.`)
  } catch (e) {
    fail(e)
  }
}

async function onCred(result: Row) {
  const u = credUser.value!
  await loadUsers()
  if (credKind.value === 'disable') {
    notify(`${u.name}'s login is disabled.`, async () => {
      await api.del(`/users/${u.id}/disablement`)
      await loadUsers()
    })
  } else {
    notify(`Temporary ${u.credential_word} ${result.display} set for ${u.name}. Hand it over in person.`)
  }
}

async function onSaved(result: Row, isNew: boolean, previousRole?: string) {
  await loadUsers()
  const u = result.user
  if (isNew) {
    notify(`${u.name} can sign in with temporary ${u.credential_word} ${result.display}. Hand it over in person.`)
    return
  }
  if (previousRole && previousRole !== u.role) {
    notify(`${u.name} is now ${u.role === 'admin' ? 'an Admin' : u.role === 'manager' ? 'a Manager' : 'Crew'}${result.credential ? ` with a temporary ${u.credential_word} ${result.display}` : ''}.`)
  } else {
    notify(`Saved changes to ${u.name}.`)
  }
}

async function savePerms() {
  saving.value = true
  const before = JSON.parse(JSON.stringify(perms.value!.grid))
  try {
    const res = await api.put<{ data: Row, meta: { changes: number } }>('/permissions', { grid: draft.value })
    perms.value = res.data
    draft.value = JSON.parse(JSON.stringify(res.data.grid))
    notify(`Permissions saved. ${plural(res.meta.changes, 'change')} logged.`, async () => {
      const undone = await api.put<{ data: Row }>('/permissions', { grid: before })
      perms.value = undone.data
      draft.value = JSON.parse(JSON.stringify(undone.data.grid))
    })
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

function resetDefaults() {
  draft.value = JSON.parse(JSON.stringify(perms.value!.defaults))
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Users & roles"
      subtitle="Who can sign in, and what each role is allowed to do."
    >
      <template #actions>
        <NuxtLink
          to="/access-map"
          class="btn btn-strong"
        >
          Access map
        </NuxtLink>
        <button
          v-if="can('users', 'edit')"
          type="button"
          class="btn btn-primary"
          @click="openAdd"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-[18px]"
          />Add user
        </button>
      </template>
    </UiPageHeader>

    <section class="card flex flex-col">
      <div class="card-head">
        <h2 class="h-section m-0">
          Users ({{ users.length }})
        </h2>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#DADDE3] p-4">
        <UiFilterTabs
          v-model="tab"
          :items="tabs"
          label="Filter users"
        />
        <UiSearchBox
          v-model="query"
          label="Search users"
          placeholder="Name, email or mobile"
          :width="240"
        />
      </div>
      <div class="tbl-wrap">
        <table
          class="tbl"
          style="min-width: 1000px"
        >
          <thead>
            <tr>
              <th>User</th><th>Role</th><th>Linked personnel</th><th>Sign-in</th><th>Last active</th><th>Status</th><th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in rows"
              :key="u.id"
            >
              <td data-cell="title">
                <span
                  class="text-[15px] font-bold"
                  :class="u.status === 'disabled' ? 'text-[#565B66]' : ''"
                >{{ u.name }}</span>
                <div class="sub">
                  {{ u.role === 'crew' ? phone(u.mobile) : (u.email ?? phone(u.mobile)) }}
                </div>
              </td>
              <td data-label="Role">
                <UiBadge
                  :tone="u.status === 'disabled' ? TONES.grey : ROLE_TONE[u.role]!"
                  :label="u.role_label"
                />
                <span
                  v-if="u.is_owner"
                  class="ml-1.5 text-[13px] text-[#565B66]"
                >superadmin</span>
              </td>
              <td data-label="Linked personnel">
                <NuxtLink
                  v-if="u.personnel"
                  :to="`/personnel/${u.personnel.id}`"
                >{{ u.personnel.name }}</NuxtLink>
                <span
                  v-else
                  class="text-[#565B66]"
                >—</span>
              </td>
              <td data-label="Sign-in">
                {{ u.sign_in }}
              </td>
              <td
                data-label="Last active"
                :class="u.status === 'temp' || u.status === 'temppw' ? 'text-[#565B66]' : ''"
              >
                {{ u.last_active }}
              </td>
              <td data-label="Status">
                <UiBadge
                  :tone="STATUS_TONE[u.status]!"
                  :label="u.status_label"
                />
              </td>
              <td
                data-cell="actions"
                class="text-right whitespace-nowrap"
              >
                <span
                  v-if="u.is_owner"
                  class="text-[13px] text-[#565B66]"
                >Owner can't be removed</span>
                <div
                  v-else-if="can('users', 'edit')"
                  class="inline-flex justify-end gap-1.5"
                >
                  <button
                    v-if="u.status !== 'disabled'"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="openEdit(u)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="u.status === 'locked'"
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="unlock(u)"
                  >
                    Unlock
                  </button>
                  <button
                    v-if="u.status !== 'disabled'"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="openCred(u, 'reset')"
                  >
                    Reset {{ u.credential_word === 'PIN' ? 'PIN' : 'password' }}
                  </button>
                  <button
                    v-if="u.status !== 'disabled'"
                    type="button"
                    class="btn btn-red-text btn-sm"
                    @click="openCred(u, 'disable')"
                  >
                    Disable
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="openCred(u, 'enable')"
                  >
                    Re-enable
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
        Showing {{ rows.length }} of {{ users.length }} users. Personnel without a login are still in Crew and get paid; an admin records their attendance.
      </div>
    </section>

    <section
      v-if="perms"
      class="card flex flex-col"
    >
      <div class="card-head">
        <div>
          <h2 class="h-section m-0">
            Permissions by role
          </h2>
          <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
            Only the Owner can change this grid. The Owner always has full access.
          </p>
        </div>
        <div
          v-if="editableGrid"
          class="flex flex-wrap items-center gap-2"
        >
          <span
            v-if="changes"
            class="badge bg-[#FFF1D6] text-[#6B4100]"
          >{{ plural(changes, 'unsaved change') }}</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="resetDefaults"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!changes || saving"
            @click="savePerms"
          >
            Save permissions
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-[#DADDE3] px-5 py-3 text-[13px]">
        <span><b>No access</b> hidden from the menu</span>
        <span><b>Own only</b> their own events, time and pay</span>
        <span><b>View</b> read only</span>
        <span><b>Edit</b> add and change</span>
        <span><b>Full</b> edit, delete, approve, export</span>
      </div>
      <div class="overflow-x-auto">
        <table
          class="w-full border-collapse text-sm"
          style="min-width: 760px"
        >
          <thead>
            <tr class="text-left text-xs tracking-[.06em] uppercase">
              <th class="px-5 py-3 font-semibold text-[#565B66]">
                Module
              </th>
              <th class="bg-[#C4141C] px-3 py-3 font-bold text-white">
                Owner
              </th>
              <th class="bg-[#0B0B0C] px-3 py-3 font-bold text-white">
                Admin
              </th>
              <th class="bg-[#244677] px-3 py-3 font-bold text-white">
                Manager
              </th>
              <th class="bg-[#2F5596] px-3 py-3 font-bold text-white">
                Crew
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in perms.modules"
              :key="m.key"
              class="border-t border-[#E6E8EC]"
            >
              <th
                scope="row"
                class="px-5 py-2.5 text-left font-semibold"
              >
                {{ m.label }}<span class="block text-[13px] font-normal text-[#565B66]">{{ m.hint }}</span>
              </th>
              <td class="px-3 py-2.5 font-bold text-[#B4121A]">
                Full
              </td>
              <td
                v-for="role in ['admin', 'manager', 'crew']"
                :key="role"
                class="px-3 py-2.5"
              >
                <select
                  v-model="draft[role]![m.key]"
                  :aria-label="`${m.label} for ${role}`"
                  :disabled="!editableGrid"
                  class="h-[38px] w-[120px] cursor-pointer rounded-md border-2 px-2 text-sm font-semibold disabled:cursor-default"
                  :style="{ background: LEVEL[draft[role]![m.key]!]!.bg, color: LEVEL[draft[role]![m.key]!]!.fg, borderColor: draft[role]![m.key] !== perms.grid[role][m.key] ? '#ED1B24' : '#B9BEC7' }"
                >
                  <option
                    v-for="l in perms.levels"
                    :key="l.value"
                    :value="l.value"
                  >
                    {{ l.label }}
                  </option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="border-t border-[#DADDE3] px-5 py-3 text-[13px] text-[#565B66]">
        Changes apply at each user's next page load. Every save is kept in the history log. See the <NuxtLink to="/access-map">access map</NuxtLink> for where each role lands after sign-in.
      </div>
    </section>

    <UsersUserPanel
      v-model:open="panelOpen"
      :user="editing"
      @saved="onSaved"
    />
    <UsersCredentialModal
      v-if="credUser"
      v-model:open="credOpen"
      :user="credUser"
      :kind="credKind"
      @done="onCred"
    />
  </div>
</template>
