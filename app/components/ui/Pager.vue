<script setup lang="ts">
const props = defineProps<{
  total: number
  perPage: number
  noun: string
}>()
const page = defineModel<number>({ required: true })
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))
const from = computed(() => props.total === 0 ? 0 : (page.value - 1) * props.perPage + 1)
const to = computed(() => Math.min(props.total, page.value * props.perPage))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] px-4 py-3 text-[13px] text-[#565B66]">
    <span aria-live="polite">Showing {{ from }}–{{ to }} of {{ total }} {{ noun }}</span>
    <nav
      v-if="pages > 1"
      aria-label="Pages"
      class="flex flex-wrap gap-1"
    >
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="page === 1"
        @click="page--"
      >
        ‹ Prev
      </button>
      <button
        v-for="p in pages"
        :key="p"
        type="button"
        class="inline-flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold"
        :class="p === page ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#B9BEC7] bg-white text-[#0B0B0C]'"
        :aria-current="p === page ? 'page' : undefined"
        @click="page = p"
      >
        {{ p }}
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="page === pages"
        @click="page++"
      >
        Next ›
      </button>
    </nav>
  </div>
</template>
