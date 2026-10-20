<script setup lang="ts">
defineProps<{
  label: string
  help?: string
  error?: string
  required?: boolean
  optional?: boolean
}>()
</script>

<template>
  <label class="field-label">
    <span>{{ label }}<span v-if="required"> *</span><span
      v-if="optional"
      class="font-normal text-[#565B66]"
    > (optional)</span></span>
    <slot />
    <span
      v-if="error"
      role="alert"
      class="err"
    >{{ error }}</span>
    <span
      v-else-if="help"
      class="help"
    >{{ help }}</span>
  </label>
</template>
