<script setup lang="ts">
definePageMeta({ module: 'users', title: 'Access map' })
useHead({ title: 'Access map · Blaster Pro Audio' })

const R = (screen: string, to: string, extra: string, o: string, a: string, m: string, c: string) => ({ screen, to, extra, cells: [o, a, m, c] })
const rows = [
  R('Dashboard', '/dashboard', '', 'Yes · home page', 'Yes · home page', 'View, no revenue figures', 'No'),
  R('Calendar', '/calendar', '', 'Yes', 'Yes', 'Yes · home page · add expenses', 'Own events only'),
  R('Events list', '/events', '', 'Yes', 'Yes', 'Yes · create, schedule, assign crew and tasks', 'No'),
  R('Event detail', '/events', '', 'Yes', 'Yes', 'Yes · rates hidden', 'Assigned events only (Crew home). Pay hidden.'),
  R('Bookings · quotes', '/bookings', ' · detail, packages', 'Yes', 'Yes', 'Create and edit · no payment recording', 'No'),
  R('Invoices & deposits', '/bookings', '', 'Yes', 'Yes', 'No', 'No'),
  R('Clients', '/clients', '', 'Yes', 'Yes', 'View', 'No (client name on their event only)'),
  R('Scan QR', '/scan', ' · blocked', 'Yes · can override', 'Yes · can override', 'Yes · dispatch and return any event', 'Assigned events · can only notify'),
  R('Add crew to event', '/events', ' · edit days', 'Yes', 'Yes', 'Yes · reconciles time in/out', 'No'),
  R('Remove equipment', '/events', ' · phone version', 'Yes · spare and charge', 'Yes · spare and charge', 'Yes · spare, no charge', 'Yes · reasons only'),
  R('Crew home', '/crew', '', 'No (unless linked to a crew record)', 'No (unless linked)', 'If linked to a crew record', 'Yes · home page · time in/out'),
  R('Crew list', '/personnel', ' · profile', 'Yes', 'Yes', 'Edit · rates hidden', 'Own profile, read-only'),
  R('Equipment', '/equipment', ' · item', 'Yes', 'Yes', 'View', 'Item read-only from a scan'),
  R('Payroll', '/payroll', '', 'Yes', 'Yes', 'No', 'Own payslips only'),
  R('Users & roles', '/users', '', 'Yes · edits the permission grid', 'Add and edit users · grid read-only', 'No', 'No')
]
const ROLES = [['Owner', '#C4141C'], ['Admin', '#0B0B0C'], ['Manager', '#244677'], ['Crew', '#2F5596']]
const CARDS = [
  { title: 'Owner', color: '#C4141C', how: 'Email + password', to: '/dashboard', home: 'Dashboard', text: 'Superadmin. Everything, always. The only one who can edit the permission grid.' },
  { title: 'Admin', color: '#0B0B0C', how: 'Email + password', to: '/dashboard', home: 'Dashboard', text: 'Full access by default. The Owner can narrow it module by module.' },
  { title: 'Manager', color: '#244677', how: 'Email + password', to: '/calendar', home: 'Calendar', text: 'Bookings and schedule, add crew, assign tasks, time in/out, dispatch and return gear. No money pages.' },
  { title: 'Crew', color: '#2F5596', how: 'Mobile + 6-digit PIN', to: '/crew', home: 'Crew home', text: 'Phone only. Time in/out with location, dispatch and return gear on their events.' }
]
</script>

<template>
  <div class="contents">
    <header class="flex flex-wrap items-center justify-between gap-5 rounded-lg bg-[#0B0B0C] px-7 py-6 text-white">
      <div class="flex max-w-[720px] flex-col gap-2">
        <h1 class="font-display m-0 text-[44px] leading-none font-extrabold uppercase">
          Who lands where, who sees what
        </h1>
        <p class="m-0 text-base text-[#C9CCD2]">
          Four roles, two sign-in links. Crew use <NuxtLink
            to="/crew/login"
            class="font-semibold text-white"
          >the crew sign-in</NuxtLink> (crew accounts only). Owner, Admin and Manager use <NuxtLink
            to="/login"
            class="font-semibold text-white"
          >the office sign-in</NuxtLink>. The account's role, not the link, decides which pages open.
        </p>
      </div>
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
        class="h-auto w-[220px]"
      >
    </header>
    <div
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr))"
    >
      <div
        v-for="c in CARDS"
        :key="c.title"
        class="card flex flex-col overflow-hidden"
      >
        <div
          class="font-display px-4 py-3 text-[22px] font-extrabold text-white uppercase"
          :style="{ background: c.color }"
        >
          {{ c.title }}
        </div>
        <div class="flex flex-col gap-1.5 px-4 py-3.5 text-[15px]">
          <div>
            {{ c.how }} → <NuxtLink
              :to="c.to"
              class="font-bold"
            >{{ c.home }}</NuxtLink>
          </div><div class="text-sm">
            {{ c.text }}
          </div>
        </div>
      </div>
    </div>
    <section class="card flex flex-col">
      <div class="border-b border-[#DADDE3] px-5 py-4">
        <h2 class="h-section m-0">
          Pages by role (defaults)
        </h2>
        <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
          "No" means the page isn't in their menu, and opening its link shows <NuxtLink to="/no-access">Not allowed</NuxtLink>, then their own home. The live grid is on <NuxtLink to="/users">Users &amp; roles</NuxtLink>.
        </p>
      </div>
      <div class="tbl-wrap">
        <table
          class="tbl"
          style="min-width: 980px"
        >
          <thead>
            <tr>
              <th>Screen</th>
              <th
                v-for="[r, c] in ROLES"
                :key="r"
                class="text-white"
                :style="{ background: c }"
              >
                {{ r }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.screen"
            >
              <th
                scope="row"
                data-cell="title"
                class="px-5 py-3 text-left font-semibold"
              >
                <NuxtLink :to="r.to">
                  {{ r.screen }}
                </NuxtLink><span class="font-normal text-[#565B66]">{{ r.extra }}</span>
              </th>
              <td
                v-for="(c, i) in r.cells"
                :key="i"
                :data-label="ROLES[i]![0]"
                :class="[c.includes('home page') ? 'font-bold' : 'font-medium', c.startsWith('No') ? 'text-[#565B66]' : '']"
              >
                {{ c }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="card flex flex-col gap-3 px-6 py-5">
      <h2 class="h-section m-0">
        How access is enforced
      </h2>
      <ol class="m-0 flex flex-col gap-2.5 pl-[22px] text-[15px] text-[#3B3F47]">
        <li><b class="text-[#0B0B0C]">Permissions come from the grid.</b> Role × module levels (none, own, view, edit, full) are stored on the server. The Owner row is fixed at full.</li>
        <li><b class="text-[#0B0B0C]">The server checks the role every time.</b> Every page load and every action checks the signed-in user's permission first.</li>
        <li><b class="text-[#0B0B0C]">Crew data is filtered at the source.</b> A crew request only returns their own events, rates and pay.</li>
        <li><b class="text-[#0B0B0C]">Crew PIN:</b> 6 digits; easy ones are refused. 5 wrong tries locks the account for 15 minutes or until an admin unlocks it. PINs and passwords are stored hashed.</li>
        <li><b class="text-[#0B0B0C]">No SMS or email.</b> New accounts start with a temporary PIN or password handed over in person, changed at first sign-in.</li>
        <li><b class="text-[#0B0B0C]">Disabled accounts</b> are signed out on their next request.</li>
        <li><b class="text-[#0B0B0C]">Every action records the user</b>, which fills "Added by", "Removed by" and the activity log.</li>
      </ol>
    </section>
  </div>
</template>
