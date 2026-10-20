<script setup lang="ts" generic="T extends string">
withDefaults(defineProps<{
  options: { value: T, label: string, note?: string }[]
  name: string
  dark?: boolean
  columns?: number
  size?: 'md' | 'sm'
}>(), { dark: false, columns: 0, size: 'md' })
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    class="grid gap-1 rounded-md p-1"
    :class="dark ? 'bg-[#1A1B1E]' : 'bg-[#F2F3F5]'"
    :style="{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }"
  >
    <label
      v-for="o in options"
      :key="o.value"
      class="flex cursor-pointer items-center justify-center gap-1.5 rounded px-2 text-center font-semibold"
      :class="[
        size === 'sm' ? 'min-h-9 text-[13px]' : 'min-h-11 text-sm',
        model === o.value ? (dark ? 'bg-[#2F5596] text-white' : 'bg-[#0B0B0C] text-white') : (dark ? 'text-[#C9CCD2]' : 'text-[#0B0B0C]')
      ]"
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="o.value"
        class="sr-only"
      >
      {{ o.label }}
    </label>
  </div>
</template>
