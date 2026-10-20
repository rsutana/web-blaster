<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value?: string | number
  sub?: string
  variant?: 'dark' | 'blue' | 'white' | 'red'
  dot?: string
  to?: string
  valueClass?: string
  loading?: boolean
}>(), { variant: 'white', value: undefined, sub: undefined, dot: undefined, to: undefined, valueClass: 'text-[44px]' })

const styles = computed(() => ({
  dark: { box: 'bg-[#0B0B0C] text-white', label: 'text-[#C9CCD2]', sub: 'text-[#C9CCD2]', bone: 'skel-dark' },
  blue: { box: 'bg-[#2F5596] text-white', label: 'text-[#DCE4F2]', sub: 'text-[#DCE4F2]', bone: 'skel-blue' },
  red: { box: 'bg-[#C4141C] text-white', label: 'text-[#FFE3E4]', sub: 'text-[#FFE3E4]', bone: 'skel-blue' },
  white: { box: 'bg-white border border-[#DADDE3]', label: 'text-[#565B66]', sub: 'text-[#565B66]', bone: '' }
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
    <template v-if="loading">
      <span
        aria-hidden="true"
        class="skel mt-1 h-10 w-20"
        :class="styles.bone"
      />
      <span
        aria-hidden="true"
        class="skel mt-auto h-3 w-32"
        :class="styles.bone"
      />
    </template>
    <slot v-else>
      <div
        class="figure"
        :class="valueClass"
      >
        {{ value }}
      </div>
    </slot>
    <slot
      v-if="!loading"
      name="sub"
    >
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
