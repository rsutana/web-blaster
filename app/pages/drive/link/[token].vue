<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', public: true })
useHead({ title: 'Trip · Blaster Pro Audio' })

const route = useRoute()
const config = useRuntimeConfig()
const trip = ref<Row | null>(null)
const notFound = ref('')
const base = computed(() => `${config.public.apiBase}/driver-links/${route.params.token}`)

onMounted(async () => {
  try {
    trip.value = (await $fetch<{ data: Row }>(base.value, { headers: { Accept: 'application/json' } })).data
  } catch (e) {
    notFound.value = errorMessage(e, 'This trip link isn\'t valid any more. Ask the office for a new one.')
  }
})

async function send(path: '' | 'departure' | 'arrival' | 'pings', body: Record<string, unknown> = {}): Promise<Row> {
  return (await $fetch<{ data: Row }>(`${base.value}/${path}`, { method: 'POST', body, headers: { Accept: 'application/json' } })).data
}
</script>

<template>
  <div class="contents">
    <header class="bg-[#0B0B0C] px-5 pt-5 pb-[18px] text-white">
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
        class="h-auto w-[150px]"
      >
      <h1 class="font-display mt-3 mb-0 text-2xl leading-none font-extrabold uppercase">
        Your trip
      </h1>
      <div
        v-if="trip?.driver"
        class="text-sm text-[#C9CCD2]"
      >
        {{ trip.driver.name }}
      </div>
    </header>
    <main
      v-if="notFound"
      class="p-4"
    >
      <p
        role="alert"
        class="card m-0 p-4 text-[15px]"
      >
        {{ notFound }}
      </p>
    </main>
    <UiSkeletonPage
      v-else-if="!trip"
      variant="mobile"
    />
    <LogisticsDriverTrip
      v-else
      :trip="trip"
      :storage-key="`link-${String(route.params.token).slice(0, 12)}`"
      :send="send"
      @update="t => trip = t"
    />
  </div>
</template>
