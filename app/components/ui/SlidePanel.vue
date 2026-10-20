<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :title="title"
    :description="subtitle ?? title"
  >
    <template #content>
      <div class="flex h-full flex-col overflow-y-auto bg-white font-sans text-[#0B0B0C]">
        <header class="sticky top-0 z-[2] flex items-start justify-between gap-3 bg-[#0B0B0C] px-5 py-[18px] text-white">
          <div class="min-w-0">
            <h2 class="font-display m-0 text-[28px] leading-none font-extrabold uppercase">
              {{ title }}
            </h2>
            <p
              v-if="subtitle"
              class="mt-1.5 mb-0 text-sm text-[#C9CCD2]"
            >
              <slot name="subtitle">
                {{ subtitle }}
              </slot>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            class="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border border-[#3B3F47] bg-transparent text-white hover:bg-white/10"
            @click="open = false"
          >
            <UIcon
              name="i-lucide-x"
              class="size-[18px]"
            />
          </button>
        </header>
        <div class="flex flex-1 flex-col gap-[18px] p-5">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-[#DADDE3] bg-white px-5 py-3.5"
        >
          <slot name="footer" />
        </footer>
      </div>
    </template>
  </USlideover>
</template>
