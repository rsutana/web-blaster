<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ event: Row }>()
const emit = defineEmits<{ added: [count: number] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const items = ref<Row[]>([])
const picked = ref<Record<number, boolean>>({})
const cat = ref('all')
const query = ref('')
const cond = ref('good')
const note = ref('')
const busy = ref(false)

watch(open, async (v) => {
  if (!v) {
    return
  }
  picked.value = {}
  cat.value = 'all'
  query.value = ''
  note.value = ''
  cond.value = 'good'
  items.value = (await api.get<{ data: Row[] }>(`/events/${props.event.id}/available-equipment`)).data
})

const cats = computed(() => {
  const map = new Map<string, string>()
  for (const i of items.value) {
    map.set(i.category, i.category_label)
  }
  return [{ key: 'all', label: `All (${items.value.length})` }, ...[...map.entries()].map(([k, l]) => ({ key: k, label: `${l} (${items.value.filter(i => i.category === k).length})` }))]
})
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return items.value.filter(i => (cat.value === 'all' || i.category === cat.value) && (!q || `${i.code} ${i.name}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(a.is_blocked) - Number(b.is_blocked) || a.code.localeCompare(b.code))
})
const selected = computed(() => items.value.filter(i => !i.is_blocked && picked.value[i.id]))
const hiddenPicked = computed(() => selected.value.length - visible.value.filter(i => !i.is_blocked && picked.value[i.id]).length)

async function add() {
  busy.value = true
  try {
    await api.post(`/events/${props.event.id}/usages`, { item_ids: selected.value.map(i => i.id), condition: cond.value, note: note.value || null })
    open.value = false
    emit('added', selected.value.length)
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    title="Add equipment"
    :subtitle="`${event.label} · ${event.short_dates}`"
  >
    <UiField label="Search inventory">
      <input
        v-model="query"
        type="search"
        class="ctl"
        placeholder="Item ID or name, e.g. SPK or mixer"
      >
    </UiField>
    <div
      role="group"
      aria-label="Category"
      class="flex flex-wrap gap-1.5"
    >
      <button
        v-for="c in cats"
        :key="c.key"
        type="button"
        :aria-pressed="cat === c.key"
        class="min-h-[38px] cursor-pointer rounded-md border px-3 text-sm font-semibold"
        :class="cat === c.key ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#B9BEC7] bg-white text-[#0B0B0C]'"
        @click="cat = c.key"
      >
        {{ c.label }}
      </button>
    </div>
    <p
      aria-live="polite"
      class="-mt-1 mb-0 text-[13px] text-[#565B66]"
    >
      Showing {{ visible.length }} of {{ items.length }} items<span v-if="hiddenPicked > 0"> · {{ plural(hiddenPicked, 'selected item') }} hidden by this filter</span>
    </p>
    <fieldset class="m-0 flex max-h-[420px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-[#DADDE3] p-1">
      <legend class="sr-only">
        Pick items
      </legend>
      <div
        v-if="!visible.length"
        class="px-3 py-5 text-center text-sm text-[#565B66]"
      >
        No items match. Try another category or clear the search.
      </div>
      <label
        v-for="i in visible"
        :key="i.id"
        class="flex min-h-14 cursor-pointer items-center gap-2.5 rounded px-2.5 py-2"
        :class="[!i.is_blocked && picked[i.id] ? 'bg-[#E6ECF6]' : '', i.is_blocked ? 'cursor-not-allowed text-[#565B66]' : '']"
      >
        <input
          v-model="picked[i.id]"
          type="checkbox"
          :disabled="i.is_blocked"
          class="size-5 flex-none accent-[#2F5596]"
        >
        <span class="min-w-0 flex-1">
          <span class="font-mono text-sm font-medium">{{ i.code }}</span> · <span class="text-[15px] font-semibold">{{ i.name }}</span>
          <span class="block text-[13px] text-[#565B66]">{{ i.where }}</span>
        </span>
        <span
          class="max-w-[140px] flex-none text-right text-xs font-bold tracking-[.03em] uppercase"
          :class="i.is_warning ? 'text-[#B4121A]' : i.is_blocked ? 'text-[#565B66]' : 'text-[#1D6B3C]'"
        >{{ i.status_label }}</span>
      </label>
    </fieldset>
    <p class="m-0 text-[13px] text-[#565B66]">
      Items active on another event, under repair or retired can't be picked. Admins can transfer an unreturned item from its event page. Prefer scanning? <NuxtLink
        :to="`/scan?event=${event.id}`"
        class="font-semibold"
      >Scan QR codes instead</NuxtLink>.
    </p>
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 p-0 text-sm font-semibold">
        Condition when added
      </legend>
      <UiSegmented
        v-model="cond"
        name="cond"
        :options="[{ value: 'good', label: 'Good' }, { value: 'minor_wear', label: 'Minor wear' }, { value: 'damaged', label: 'Damaged' }]"
      />
      <span class="help mt-1.5 block">Applies to all selected items; change one later from the Equipment table.</span>
    </fieldset>
    <UiField
      label="Note"
      optional
    >
      <input
        v-model="note"
        type="text"
        class="ctl"
        placeholder="e.g. spare cables for stage left"
      >
    </UiField>
    <p class="m-0 text-[13px] text-[#565B66]">
      Logged as added by <b class="text-[#0B0B0C]">you</b> · now
    </p>
    <template #footer>
      <span class="mr-auto text-[15px] font-bold">{{ plural(selected.length, 'item') }} selected</span>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!selected.length || busy"
        @click="add"
      >
        Add {{ plural(selected.length, 'item') }}
      </button>
    </template>
  </UiSlidePanel>
</template>
