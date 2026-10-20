<script setup lang="ts">
const props = withDefaults(defineProps<{
  rows?: number
  cols?: number
  label?: string
}>(), { rows: 8, cols: 6, label: 'Loading' })

const WIDTHS = ['78%', '55%', '66%', '84%', '42%', '60%', '72%']
const grid = computed(() => ({ gridTemplateColumns: `minmax(0, 2fr) repeat(${props.cols - 1}, minmax(0, 1fr))` }))
const width = (r: number, c: number) => WIDTHS[(r * 3 + c) % WIDTHS.length]
</script>

<template>
  <div
    role="status"
    :aria-label="label"
    class="skel-table flex flex-col"
  >
    <span class="sr-only">{{ label }}…</span>
    <div
      aria-hidden="true"
      class="skel-row grid items-center gap-4 px-4 py-3.5"
      :style="grid"
    >
      <span
        v-for="c in cols"
        :key="c"
        class="skel h-2.5"
        style="width: 64px"
      />
    </div>
    <div
      v-for="r in rows"
      :key="r"
      aria-hidden="true"
      class="skel-row grid items-start gap-4 border-t border-[#E6E8EC] px-4 py-4"
      :style="grid"
    >
      <div
        v-for="c in cols"
        :key="c"
        class="flex min-w-0 flex-col gap-2"
        :class="{ 'items-end': c === cols }"
      >
        <span
          v-if="c === cols"
          class="skel h-8 w-16 rounded-md"
        />
        <template v-else>
          <span
            class="skel"
            :class="c === 1 ? 'h-4' : 'h-3.5'"
            :style="{ width: width(r, c) }"
          />
          <span
            v-if="c <= 3"
            class="skel h-3"
            :style="{ width: width(r + 2, c + 1) }"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skel-table { container-type: inline-size; }
@container (max-width: 640px) {
  .skel-row { grid-template-columns: minmax(0, 1fr) auto !important; }
  .skel-row > :nth-child(n+3):not(:last-child) { display: none; }
}
</style>
