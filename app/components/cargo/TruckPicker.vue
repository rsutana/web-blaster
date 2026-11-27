<script setup lang="ts">
import type { Row } from '~/types/api'

/** Tick the trucks a booking uses. Each one brings its crew and an outbound trip to the event. */
const model = defineModel<number[]>({ required: true })
const props = defineProps<{ trucks: Row[] }>()

const active = computed(() => props.trucks.filter(t => t.is_active || model.value.includes(t.id)))

function toggle(id: number) {
  model.value = model.value.includes(id) ? model.value.filter(x => x !== id) : [...model.value, id]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      v-for="t in active"
      :key="t.id"
      class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5"
      :class="model.includes(t.id) ? 'border-[#2F5596] bg-[#E8EEF8]' : 'border-[#DADDE3] bg-white'"
    >
      <input
        type="checkbox"
        class="mt-0.5 size-5 flex-none accent-[#2F5596]"
        :checked="model.includes(t.id)"
        @change="toggle(t.id)"
      >
      <span class="flex flex-col">
        <span class="text-sm font-semibold">{{ t.name }} <span class="font-mono font-normal text-[#565B66]">{{ t.plate_no }}</span></span>
        <span class="text-[13px] text-[#565B66]">{{ t.crew_count ?? 0 }} crew · {{ t.items_count ?? 0 }} loose · {{ t.containers_count ?? 0 }} {{ t.containers_count === 1 ? 'case' : 'cases' }}</span>
      </span>
    </label>
    <p
      v-if="!active.length"
      class="m-0 text-sm text-[#565B66]"
    >
      No trucks yet. Add them under Logistics → Trucks, then fill them in Cargo.
    </p>
  </div>
</template>
