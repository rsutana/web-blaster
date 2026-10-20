<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  back?: { to: string, label: string }
}>()
</script>

<template>
  <header class="flex flex-col gap-2">
    <NuxtLink
      v-if="back"
      :to="back.to"
      class="text-sm font-semibold no-underline"
    >← {{ back.label }}</NuxtLink>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-1">
        <div
          v-if="eyebrow"
          class="text-sm font-semibold tracking-[.06em] text-[#565B66] uppercase"
        >
          {{ eyebrow }}
        </div>
        <h1 class="h-page m-0">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="m-0 text-[15px] text-[#565B66]"
        >
          {{ subtitle }}
        </p>
        <slot name="below" />
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap gap-2.5"
      >
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
