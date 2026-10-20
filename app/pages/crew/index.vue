<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', crewHome: true, title: 'Crew home' })
useHead({ title: 'Crew home · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { user } = useAuthUser()
const { logout } = useSanctumAuth()

const home = ref<Row | null>(null)
const clocking = ref(false)

async function load() {
  home.value = (await api.get<{ data: Row }>('/crew-home')).data
}
onMounted(load)

function position(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000 })
  })
}

async function clock(type: 'in' | 'out') {
  clocking.value = true
  try {
    const pos = await position()
    await api.post('/time-logs', {
      type,
      event_id: home.value?.today?.event_id ?? null,
      latitude: pos?.coords.latitude ?? null,
      longitude: pos?.coords.longitude ?? null,
      accuracy: pos?.coords.accuracy ?? null,
      location_label: home.value?.today?.venue ?? null,
      is_on_site: !!pos
    })
    await load()
    notify(type === 'in' ? `Clocked in${pos ? ' with your location' : ' (location not shared)'}.` : 'Clocked out. Thanks for today.')
  } catch (e) {
    fail(e)
  } finally {
    clocking.value = false
  }
}
</script>

<template>
  <div class="contents">
    <header class="bg-[#0B0B0C] px-5 pt-4 pb-5 text-white">
      <div class="flex items-center justify-between">
        <img
          src="/logo.png"
          alt="Blaster Pro Audio Touring Group"
          class="h-auto w-[150px]"
        >
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-md border border-[#3B3F47] bg-transparent px-3.5 text-sm font-semibold text-white"
          @click="logout()"
        >
          Sign out
        </button>
      </div>
      <div class="mt-4 text-sm text-[#C9CCD2]">
        Crew · {{ home?.person?.role_label ?? user?.role_label }}
      </div>
      <h1 class="font-display m-0 text-[32px] leading-none font-extrabold uppercase">
        Hi, {{ home?.person?.first_name ?? user?.first_name }}
      </h1>
    </header>

    <UiSkeletonPage
      v-if="!home"
      variant="mobile"
    />
    <main
      v-else
      class="flex flex-col gap-3 p-4"
    >
      <section
        v-if="home.today"
        class="card flex flex-col gap-2.5 p-4"
      >
        <div class="flex items-center justify-between">
          <span class="eyebrow font-bold text-[#565B66]">Today</span>
          <span class="badge bg-[#C4141C] text-white"><span class="size-2 rounded-full bg-white" />{{ home.today.day_label }}</span>
        </div>
        <h2 class="font-display m-0 text-[26px] leading-none font-extrabold uppercase">
          {{ home.today.name }}
        </h2>
        <div class="text-[15px]">
          {{ home.today.venue }}
        </div>
        <div class="text-sm text-[#565B66]">
          {{ home.today.call }}{{ home.today.is_lead ? ' · You\'re the event lead' : '' }}
        </div>
        <div class="text-sm">
          Your rate here: <b>{{ home.today.rate_label }}</b>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="btn btn-phone"
            :class="home.time.is_clocked_in ? 'btn-secondary' : 'btn-dark'"
            :disabled="clocking"
            @click="clock(home.time.is_clocked_in ? 'out' : 'in')"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="size-5"
            />{{ home.time.is_clocked_in ? 'Time out' : 'Time in' }}
          </button>
          <span class="flex items-center text-[13px] text-[#565B66]">{{ home.time.last_label ?? 'Not clocked in yet today' }}</span>
        </div>
        <NuxtLink
          to="/scan"
          class="font-display flex min-h-16 items-center justify-center gap-2.5 rounded-md bg-[#2F5596] text-[22px] font-extrabold text-white uppercase no-underline hover:text-white"
        >
          <UIcon
            name="i-lucide-qr-code"
            class="size-6"
          />Scan equipment
        </NuxtLink>
        <div class="rounded-md bg-[#0B0B0C] px-3.5 py-2.5 text-sm text-white">
          {{ plural(home.today.items_total, 'item') }} on this event · <b>{{ home.today.items_out }} still out</b>
        </div>
      </section>
      <section
        v-else
        class="card flex flex-col gap-2.5 p-4"
      >
        <span class="eyebrow font-bold text-[#565B66]">Today</span>
        <p class="m-0 text-[15px]">
          No event today. Your next one is below.
        </p>
        <NuxtLink
          to="/scan"
          class="btn btn-primary btn-phone"
        >
          <UIcon
            name="i-lucide-qr-code"
            class="size-5"
          />Scan equipment
        </NuxtLink>
      </section>

      <section class="card flex flex-col gap-2 p-4">
        <h2 class="h-section m-0 text-lg">
          My pay · {{ home.pay.cutoff }}
        </h2>
        <div
          v-for="e in home.pay.events"
          :key="e.label"
          class="flex justify-between text-[15px]"
        >
          <span>{{ e.label.split(' · ')[1] ?? e.label }}{{ home.today ? ' (so far)' : '' }}</span><span>{{ peso(e.gross) }}</span>
        </div>
        <div
          v-if="home.pay.advance"
          class="flex justify-between text-[15px]"
        >
          <span>Cash advance installment</span><span class="text-[#B4121A]">− {{ peso(home.pay.advance) }}</span>
        </div>
        <div
          v-if="home.pay.deductions"
          class="flex justify-between text-[15px]"
        >
          <span>Other deductions</span><span class="text-[#B4121A]">− {{ peso(home.pay.deductions) }}</span>
        </div>
        <div class="flex items-baseline justify-between border-t-2 border-[#0B0B0C] pt-2">
          <span class="font-semibold">{{ home.pay.is_paid ? 'Paid' : 'Estimated net' }}</span>
          <span class="figure text-[30px] text-[#2F5596]">{{ peso(home.pay.net) }}</span>
        </div>
        <div class="text-[13px] text-[#565B66]">
          Payday {{ home.pay.payday }}<template v-if="home.pay.advance_left">
            · Advance left after: {{ peso(home.pay.advance_left) }}
          </template>
        </div>
      </section>

      <section
        v-if="home.next"
        class="card flex items-center gap-3.5 p-4"
      >
        <div class="flex h-[52px] w-12 flex-none flex-col items-center justify-center rounded-md bg-[#0B0B0C] text-white">
          <span class="text-[11px] font-bold text-[#ED1B24]">{{ home.next.month }}</span>
          <span class="font-display text-2xl leading-none font-extrabold">{{ home.next.day }}</span>
        </div>
        <div class="flex-1">
          <div class="eyebrow text-[#565B66]">
            Next
          </div>
          <div class="font-semibold">
            {{ home.next.name }}
          </div>
          <div class="text-sm text-[#565B66]">
            {{ home.next.city }} · {{ home.next.rate_label }}
          </div>
        </div>
      </section>
      <NuxtLink
        to="/calendar"
        class="px-1 text-sm font-semibold"
      >See all my events &amp; past pay</NuxtLink>
    </main>
  </div>
</template>
