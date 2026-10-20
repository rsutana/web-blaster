<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  tone?: 'dark' | 'red'
  width?: number
  icon?: string
}>(), { tone: 'dark', width: 440, subtitle: undefined, icon: undefined })
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="subtitle ?? title"
    :ui="{ content: width === 720 ? 'max-w-[720px]' : 'max-w-[440px]' }"
  >
    <template #content>
      <div
        class="flex max-h-[90vh] flex-col overflow-y-auto bg-white font-sans text-[#0B0B0C]"
        role="alertdialog"
      >
        <div
          class="flex items-start gap-3 px-5 py-[18px] text-white"
          :class="tone === 'red' ? 'bg-[#C4141C]' : 'bg-[#0B0B0C]'"
        >
          <UIcon
            v-if="icon"
            :name="icon"
            class="mt-0.5 size-[26px] flex-none"
          />
          <div class="min-w-0 flex-1">
            <h2 class="font-display m-0 text-[26px] leading-[1.05] font-extrabold uppercase">
              {{ title }}
            </h2>
            <p
              v-if="subtitle || $slots.subtitle"
              class="mt-1.5 mb-0 text-sm"
              :class="tone === 'red' ? 'text-[#FFE3E4]' : 'text-[#C9CCD2]'"
            >
              <slot name="subtitle">
                {{ subtitle }}
              </slot>
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-4 px-5 py-[18px]">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="flex flex-wrap items-center justify-end gap-2 border-t border-[#DADDE3] px-5 py-3.5"
        >
          <slot name="footer" />
        </div>
      </div>
    </template>
  </UModal>
</template>
