<script setup lang="ts">
withDefaults(defineProps<{ label: string, placeholder: string, width?: number }>(), { width: 260 })
const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="relative flex items-center">
    <span class="sr-only">{{ label }}</span>
    <UIcon
      name="i-lucide-search"
      class="absolute left-3 size-4 text-[#565B66]"
    />
    <input
      v-model="model"
      type="search"
      :placeholder="placeholder"
      class="ctl ctl-sm"
      :style="{ width: width + 'px', maxWidth: '100%', paddingLeft: '36px' }"
    >
  </label>
</template>
