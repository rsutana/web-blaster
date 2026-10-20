<script setup lang="ts">
defineProps<{ text: string, action?: string }>()
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2.5 px-4 py-10 text-center text-[#565B66]">
    <div>{{ text }}</div>
    <button
      v-if="action"
      type="button"
      class="btn btn-secondary btn-sm"
      @click="$emit('action')"
    >
      {{ action }}
    </button>
  </div>
</template>
