<script setup lang="ts">
import type { Row } from '~/types/api'

/**
 * Put gear on a truck, or pack items into one of its cases, by scanning or typing IDs.
 * Each code is sent as soon as it's scanned so the tree behind the panel stays current.
 */
const props = defineProps<{ target: { kind: 'truck', id: number, name: string } | { kind: 'case', id: number, name: string } | null }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const geo = useGeo()
const { fail } = useNotify()

const busy = ref(false)
const query = ref('')
const catalog = ref<Row[]>([])
/** One line per scan, newest first, so the person scanning sees what happened to each code. */
const log = ref<{ code: string, text: string, ok: boolean }[]>([])

const isTruck = computed(() => props.target?.kind === 'truck')
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 2) {
    return []
  }
  return catalog.value.filter(r => `${r.code} ${r.name}`.toLowerCase().includes(q)).slice(0, 8)
})

watch(open, async (v) => {
  if (!v) {
    return
  }
  log.value = []
  query.value = ''
  const [items, cases] = await Promise.all([
    api.get<{ data: Row[] }>('/equipment').catch(() => ({ data: [] as Row[] })),
    isTruck.value ? api.get<{ data: Row[] }>('/containers').catch(() => ({ data: [] as Row[] })) : Promise.resolve({ data: [] as Row[] })
  ])
  catalog.value = [
    ...cases.data.filter(c => c.is_active).map(c => ({ code: c.code, name: `${c.name} · case`, kind: 'case' })),
    ...items.data.filter(i => !['retired', 'lost'].includes(i.status) && (isTruck.value ? !i.case : true)).map(i => ({ code: i.code, name: i.name, kind: 'item' }))
  ]
})

function note(code: string, text: string, ok: boolean) {
  log.value = [{ code, text, ok }, ...log.value].slice(0, 20)
}

async function add(code: string) {
  if (!props.target || busy.value) {
    return
  }
  busy.value = true
  try {
    if (props.target.kind === 'truck') {
      const { meta } = await api.post<{ data: Row, meta: Row }>(`/vehicles/${props.target.id}/loadout`, { codes: [code] })
      meta.added.forEach((c: string) => note(c, 'Added', true))
      meta.moved.forEach((m: Row) => note(m.code, `Moved over from ${m.from}`, true))
      meta.already.forEach((c: string) => note(c, 'Already on this truck', true))
      meta.blocked.forEach((b: Row) => note(b.code, b.reason, false))
    } else {
      const { meta } = await api.post<{ data: Row, meta: Row }>(`/containers/${props.target.id}/items`, { codes: [code], gps: await geo.fix() })
      meta.packed.forEach((c: string) => note(c, meta.moved.includes(c) ? 'Packed · moved from another case' : 'Packed', true))
      meta.already.forEach((c: string) => note(c, 'Already in this case', true))
    }
    query.value = ''
    emit('changed')
  } catch (e) {
    const msg = errorMessage(e)
    note(code.toUpperCase(), msg, false)
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isTruck ? `Add gear to ${target?.name}` : `Pack items into ${target?.name}`"
    :subtitle="isTruck ? 'Scan or type item or case IDs. Anything on another truck moves here.' : 'Scan or type item IDs. An item in another case moves here.'"
  >
    <LogisticsCodeScanner
      :busy="busy"
      :placeholder="isTruck ? 'Item or case ID, e.g. CASE-004' : 'Item ID, e.g. PAR-001'"
      @code="add"
    />

    <UiField
      label="Or search by name"
      optional
    >
      <input
        v-model="query"
        type="search"
        class="ctl"
        :placeholder="isTruck ? 'e.g. subwoofer, PAR LED case' : 'e.g. LED par'"
        autocomplete="off"
      >
    </UiField>
    <ul
      v-if="matches.length"
      class="m-0 flex list-none flex-col rounded-md border border-[#DADDE3] p-0"
    >
      <li
        v-for="m in matches"
        :key="m.code"
        class="border-b border-[#EEF0F2] last:border-b-0"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-[#F5F6F8]"
          :disabled="busy"
          @click="add(m.code)"
        >
          <UIcon
            :name="m.kind === 'case' ? 'i-lucide-package' : 'i-lucide-speaker'"
            class="size-4 flex-none text-[#565B66]"
          />
          <span class="font-mono">{{ m.code }}</span>
          <span class="truncate text-[#565B66]">{{ m.name }}</span>
          <UIcon
            name="i-lucide-plus"
            class="ml-auto size-4 flex-none"
          />
        </button>
      </li>
    </ul>

    <section
      v-if="log.length"
      aria-live="polite"
      aria-label="Scanned"
      class="flex flex-col gap-1"
    >
      <h3 class="field-label m-0">
        Scanned
      </h3>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li
          v-for="(l, i) in log"
          :key="i"
          class="flex items-center gap-2 text-sm"
        >
          <UIcon
            :name="l.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
            class="size-4 flex-none"
            :class="l.ok ? 'text-[#1D6B3C]' : 'text-[#C4141C]'"
          />
          <span class="font-mono font-semibold">{{ l.code }}</span>
          <span :class="l.ok ? 'text-[#3B3F47]' : 'text-[#8F0F15]'">{{ l.text }}</span>
        </li>
      </ul>
    </section>

    <template #footer>
      <button
        type="button"
        class="btn btn-primary"
        @click="open = false"
      >
        Done
      </button>
    </template>
  </UiSlidePanel>
</template>
