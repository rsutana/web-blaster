<script setup lang="ts">
withDefaults(defineProps<{
  tones?: Array<'dark' | 'blue' | 'white'>
}>(), { tones: () => ['white', 'white', 'white', 'white'] })

const BOX = { dark: 'bg-[#0B0B0C]', blue: 'bg-[#2F5596]', white: 'border border-[#DADDE3] bg-white' }
const BONE = { dark: 'skel-dark', blue: 'skel-blue', white: '' }
</script>

<template>
  <div
    aria-hidden="true"
    class="grid gap-3"
    style="grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr))"
  >
    <div
      v-for="(tone, i) in tones"
      :key="i"
      class="flex min-h-[124px] flex-col gap-3 rounded-lg p-[18px]"
      :class="BOX[tone]"
    >
      <span
        class="skel h-3 w-24"
        :class="BONE[tone]"
      />
      <span
        class="skel h-10 w-20"
        :class="BONE[tone]"
      />
      <span
        class="skel mt-auto h-3 w-32"
        :class="BONE[tone]"
      />
    </div>
  </div>
</template>
