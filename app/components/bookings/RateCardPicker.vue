<script setup lang="ts">
import type { Row } from '~/types/api'

/** Searchable rate-card picker. Emits the chosen option key (see `rateCardOptions`) and resets itself. */
const props = defineProps<{ card: Row | null }>()
const emit = defineEmits<{ pick: [value: string] }>()
const items = computed(() => rateCardMenuItems(props.card))

function select(value: string | null) {
  if (value) {
    emit('pick', value)
  }
}
</script>

<template>
  <USelectMenu
    :model-value="null"
    :items="items"
    value-key="value"
    :filter-fields="['label', 'description']"
    :search-input="{ placeholder: 'Search packages, equipment, services…', icon: 'i-lucide-search' }"
    icon="i-lucide-plus"
    placeholder="Add package, equipment or service"
    size="lg"
    class="w-full"
    :content="{ align: 'start' }"
    :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
    aria-label="Add from rate card"
    @update:model-value="select"
  >
    <template #empty>
      Nothing matches. Add packages and rates under Packages &amp; rates.
    </template>
  </USelectMenu>
</template>
