<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value?: string | number
  sub?: string
  variant?: 'dark' | 'blue' | 'white' | 'red'
  dot?: string
  to?: string
  valueClass?: string
}>(), { variant: 'white', value: undefined, sub: undefined, dot: undefined, to: undefined, valueClass: 'text-[44px]' })

const styles = computed(() => ({
  dark: { box: 'bg-[#0B0B0C] text-white', label: 'text-[#C9CCD2]', sub: 'text-[#C9CCD2]' },
  blue: { box: 'bg-[#2F5596] text-white', label: 'text-[#DCE4F2]', sub: 'text-[#DCE4F2]' },
  red: { box: 'bg-[#C4141C] text-white', label: 'text-[#FFE3E4]', sub: 'text-[#FFE3E4]' },
  white: { box: 'bg-white border border-[#DADDE3]', label: 'text-[#565B66]', sub: 'text-[#565B66]' }
}[props.variant]))
</script>

<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="flex min-h-[124px] flex-col gap-1.5 rounded-lg p-[18px] no-underline"
    :class="styles.box"
  >
    <div
      class="eyebrow flex items-center gap-2"
      :class="styles.label"
    >
      <span
        v-if="dot"
        aria-hidden="true"
        class="size-2.5 rounded-full"
        :style="{ background: dot }"
      />{{ label }}
    </div>
    <slot>
      <div
        class="figure"
        :class="valueClass"
      >
        {{ value }}
      </div>
    </slot>
    <slot name="sub">
      <div
        v-if="sub"
        class="text-sm"
        :class="styles.sub"
      >
        {{ sub }}
      </div>
    </slot>
  </component>
</template>
