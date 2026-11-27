<script setup lang="ts">
import type { Row } from '~/types/api'

defineProps<{ trucks: Row[], selected: number | null }>()
const emit = defineEmits<{ select: [id: number] }>()

/** e.g. "4 items · 2 cases · 3 crew" */
function counts(t: Row): string {
  const n = (v: number | undefined, one: string, many: string) => `${v ?? 0} ${(v ?? 0) === 1 ? one : many}`
  return [n(t.items_count, 'item', 'items'), n(t.containers_count, 'case', 'cases'), n(t.crew_count, 'crew', 'crew')].join(' · ')
}
</script>

<template>
  <nav
    aria-label="Trucks"
    class="card flex flex-col overflow-hidden"
  >
    <div class="card-head">
      <h2 class="h-section m-0">
        Trucks
      </h2>
    </div>
    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="t in trucks"
        :key="t.id"
        class="border-b border-[#EEF0F2] last:border-b-0"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 border-0 border-l-4 bg-transparent px-4 py-3 text-left"
          :class="[t.id === selected ? 'border-l-[#2F5596] bg-[#E8EEF8]' : 'border-l-transparent hover:bg-[#F5F6F8]', { 'opacity-60': !t.is_active }]"
          :aria-current="t.id === selected ? 'true' : undefined"
          @click="emit('select', t.id)"
        >
          <UIcon
            :name="t.type === 'van' || t.type === 'pickup' ? 'i-lucide-car-front' : 'i-lucide-truck'"
            class="size-6 flex-none text-[#3B3F47]"
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-[15px] font-bold">{{ t.name }}</span>
            <span class="sub font-mono">{{ t.plate_no }}{{ t.is_active ? '' : ' · inactive' }}</span>
            <span class="text-[13px] text-[#565B66]">{{ counts(t) }}</span>
          </span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4 flex-none text-[#9AA0AB]"
          />
        </button>
      </li>
    </ul>
    <UiEmpty
      v-if="!trucks.length"
      text="No trucks yet. Add one under Logistics → Trucks."
    />
  </nav>
</template>
