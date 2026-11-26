<script setup lang="ts">
defineProps<{ title: string }>()
provide(IN_FORM_SECTION, true)
</script>

<template>
  <fieldset class="m-0 flex min-w-0 flex-col border-0 p-0">
    <legend class="eyebrow mb-2 p-0 text-xs font-bold text-[#2F5596]">
      {{ title }}
    </legend>
    <div class="flex flex-col gap-3.5 rounded-lg border border-[#E6ECF6] bg-[#F3F6FB] p-3.5">
      <slot />
    </div>
  </fieldset>
</template>
