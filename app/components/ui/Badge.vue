<script setup lang="ts">
import type { Tone } from '~/utils/badges'

defineProps<{
  tone: Tone
  label: string
  dot?: string
}>()
</script>

<template>
  <span
    class="badge"
    :style="{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd ?? tone.bg}` }"
  >
    <span
      v-if="dot"
      aria-hidden="true"
      class="size-2 rounded-full"
      :style="{ background: dot }"
    />{{ label }}
  </span>
</template>
