<script setup lang="ts">
defineProps<{
  items: { key: string, label: string, count?: number }[]
  label?: string
}>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div
    role="tablist"
    :aria-label="label ?? 'Filter'"
    class="flex flex-wrap gap-1.5"
  >
    <button
      v-for="t in items"
      :key="t.key"
      type="button"
      role="tab"
      :aria-selected="model === t.key"
      class="min-h-10 cursor-pointer rounded-md border px-3.5 text-sm font-semibold"
      :class="model === t.key ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#B9BEC7] bg-white text-[#0B0B0C] hover:bg-[#F2F3F5]'"
      @click="model = t.key"
    >
      {{ t.label }} <span
        v-if="t.count !== undefined"
        class="opacity-75"
      >{{ t.count }}</span>
    </button>
  </div>
</template>
