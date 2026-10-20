<script setup lang="ts">
withDefaults(defineProps<{
  lines?: number
  rows?: number
  cols?: number
}>(), { lines: 4, rows: 0, cols: 5 })

const WIDTHS = ['92%', '70%', '84%', '58%', '76%']
</script>

<template>
  <section
    aria-hidden="true"
    class="card flex flex-col"
  >
    <div class="card-head">
      <span class="skel h-5 w-40" />
      <span class="skel h-8 w-24 rounded-md" />
    </div>
    <UiSkeletonTable
      v-if="rows"
      :rows="rows"
      :cols="cols"
    />
    <div
      v-else
      class="flex flex-col gap-3.5 p-5"
    >
      <div
        v-for="l in lines"
        :key="l"
        class="flex items-center justify-between gap-6"
      >
        <span
          class="skel h-3.5"
          :style="{ width: `calc(${WIDTHS[l % WIDTHS.length]} - 96px)` }"
        />
        <span class="skel h-3.5 w-16" />
      </div>
    </div>
  </section>
</template>
