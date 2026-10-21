<script setup lang="ts">
import type { Row } from '~/types/api'

/** Which truck an item is on, who's driving and how to reach them. */
defineProps<{ trip: Row }>()
const { can } = useAuthUser()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-[#565B66]">
    <UIcon
      name="i-lucide-truck"
      class="size-4 flex-none text-[#0B0B0C]"
    />
    <NuxtLink
      v-if="can('logistics')"
      :to="`/trips/${trip.id}`"
      class="font-mono font-medium"
    >{{ trip.code }}</NuxtLink>
    <span
      v-else
      class="font-mono font-medium text-[#0B0B0C]"
    >{{ trip.code }}</span>
    <UiBadge
      :tone="TRIP_STATUS[trip.status]!"
      :label="trip.status_label"
    />
    <span>· Driver <b class="text-[#0B0B0C]">{{ trip.driver?.name ?? 'not set' }}</b><template v-if="trip.driver?.company"> ({{ trip.driver.company }})</template></span>
    <a
      v-if="trip.driver?.mobile"
      :href="`tel:${trip.driver.mobile}`"
      class="font-semibold"
    >{{ trip.driver.mobile }}</a>
    <span v-if="trip.vehicle">· {{ trip.vehicle }}</span>
  </div>
</template>
