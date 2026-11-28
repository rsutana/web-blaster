<script setup lang="ts">
import type { Row } from '~/types/api'

/** One quote line. A package line expands to show what it includes, straight from the rate card. */
const props = withDefaults(defineProps<{
  line: Row
  card: Row | null
  editable?: boolean
}>(), { editable: true })
const emit = defineEmits<{ qty: [delta: number], remove: [] }>()

const l = computed(() => props.line)
const expanded = ref(true)
const items = computed<Row[]>(() => l.value.package_id ? (props.card?.packages.find((p: Row) => p.id === l.value.package_id)?.items ?? []) : [])
const itemCount = computed(() => items.value.filter(i => i.type !== 'crew').reduce((n, i) => n + Number(i.count), 0))
const crewCount = computed(() => items.value.filter(i => i.type === 'crew').reduce((n, i) => n + Number(i.count), 0))
</script>

<template>
  <li
    class="border-b border-[#EEF0F2] px-3 py-2 last:border-0"
    role="treeitem"
    :aria-expanded="items.length ? expanded : undefined"
  >
    <div class="flex items-center gap-2">
      <component
        :is="items.length ? 'button' : 'div'"
        :type="items.length ? 'button' : undefined"
        class="flex min-w-0 flex-1 items-start gap-2 border-0 bg-transparent p-0 text-left text-sm"
        :class="items.length ? 'cursor-pointer' : ''"
        @click="items.length && (expanded = !expanded)"
      >
        <UIcon
          :name="rateItemIcon(l, card)"
          class="mt-0.5 size-4 flex-none text-ink-500"
        />
        <span class="flex min-w-0 flex-col">
          <span class="flex flex-wrap items-center gap-x-2">
            <b>{{ l.description }}</b>
            <span
              v-if="items.length"
              class="text-[13px] text-ink-500"
            >{{ [itemCount ? plural(itemCount, 'item') : '', crewCount ? `${crewCount} crew` : ''].filter(Boolean).join(' · ') }}</span>
          </span>
          <span class="text-[13px] text-ink-500">
            {{ peso(l.unit_rate) }}<template v-if="!l.package_id && l.note"> · {{ l.note }}</template>
          </span>
          <span
            v-if="items.length"
            class="flex min-w-0 items-center gap-0.5 text-[12px] text-ink-500"
          >
            <UIcon
              :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-3.5 flex-none"
            />
            <span class="truncate">{{ expanded ? 'Hide contents' : `Includes ${items.map(i => `${i.count} ${i.name}`).join(', ')}` }}</span>
          </span>
        </span>
      </component>
      <div class="flex flex-none items-center gap-1">
        <button
          v-if="editable"
          type="button"
          :aria-label="`Fewer ${l.description}`"
          class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
          @click="emit('qty', -1)"
        >
          −
        </button>
        <span class="min-w-6 text-center font-semibold">{{ l.qty }}</span>
        <button
          v-if="editable"
          type="button"
          :aria-label="`More ${l.description}`"
          class="size-8 cursor-pointer rounded border border-[#B9BEC7] bg-white font-bold"
          @click="emit('qty', 1)"
        >
          +
        </button>
      </div>
      <span class="w-20 flex-none text-right text-sm font-bold">{{ peso(Number(l.unit_rate) * l.qty) }}</span>
      <button
        v-if="editable"
        type="button"
        :aria-label="`Remove ${l.description}`"
        class="inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
        @click="emit('remove')"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
        />
      </button>
    </div>
    <ul
      v-if="items.length && expanded"
      role="group"
      class="m-0 mt-1 ml-[7px] flex list-none flex-col border-l-2 border-dashed border-[#DADDE3] p-0 pl-4"
    >
      <template
        v-for="g in groupPackageItems(items)"
        :key="g.key"
      >
        <li
          role="none"
          class="pt-4 pb-1 text-[11px] font-bold tracking-wide text-ink-500 uppercase first:pt-1"
        >
          {{ g.label }}
        </li>
        <li
          v-for="i in g.items"
          :key="`${i.type}:${i.equipment_class_id ?? i.case_kind_id ?? i.vehicle_type ?? i.crew_role}`"
          role="treeitem"
          class="flex items-start justify-between gap-3 py-1 text-sm"
        >
          <span class="flex min-w-0 items-start gap-2">
            <UIcon
              :name="rateItemIcon(i, card)"
              class="mt-0.5 size-4 flex-none text-ink-500"
            />
            <span class="flex min-w-0 flex-col">
              <span>
                {{ i.name }}
                <span class="text-[13px] text-ink-500">×{{ i.count }}</span>
              </span>
              <span
                v-if="i.type === 'case'"
                class="text-[12px] text-ink-500"
              >{{ caseContents(i.contents) ? `Each holds ${caseContents(i.contents)}` : 'Nothing packed yet' }}</span>
            </span>
          </span>
          <span
            v-if="l.qty > 1"
            class="flex-none text-[13px] font-semibold text-ink-600"
          >{{ i.count * l.qty }} total</span>
        </li>
      </template>
    </ul>
  </li>
</template>
