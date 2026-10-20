<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', module: 'logistics', level: 'own', title: 'Drive' })

const route = useRoute()
const api = useApi()
const { fail } = useNotify()
const { isCrew } = useAuthUser()
const trip = ref<Row | null>(null)

useHead(() => ({ title: `${trip.value?.code ?? 'Trip'} · Blaster Pro Audio` }))

onMounted(async () => {
  try {
    trip.value = (await api.get<{ data: Row }>(`/trips/${route.params.id}`)).data
  } catch (e) {
    fail(e)
  }
})

async function send(path: '' | 'departure' | 'arrival' | 'pings', body: Record<string, unknown> = {}): Promise<Row> {
  return (await api.post<{ data: Row }>(`/trips/${route.params.id}/${path}`, body)).data
}
</script>

<template>
  <div class="contents">
    <header class="flex items-center gap-3 bg-[#0B0B0C] px-5 py-4 text-white">
      <NuxtLink
        :to="isCrew ? '/crew' : `/trips/${route.params.id}`"
        aria-label="Back"
        class="inline-flex size-11 items-center justify-center rounded-md border border-[#3B3F47] text-white hover:text-white"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-5"
        />
      </NuxtLink>
      <div>
        <h1 class="font-display m-0 text-2xl leading-none font-extrabold uppercase">
          Drive
        </h1>
        <div class="text-sm text-[#C9CCD2]">
          {{ trip?.driver?.name ?? '' }}
        </div>
      </div>
    </header>
    <UiSkeletonPage
      v-if="!trip"
      variant="mobile"
    />
    <LogisticsDriverTrip
      v-else
      :trip="trip"
      :storage-key="`trip-${trip.id}`"
      :send="send"
      @update="t => trip = { ...trip, ...t }"
    />
  </div>
</template>
