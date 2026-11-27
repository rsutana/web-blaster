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
const { notify, success, fail } = useNotify()

const busy = ref(false)
const query = ref('')
const catalog = ref<Row[]>([])

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

/** "PAR-001 · LED par slim" when the code is in the catalog, else just the code. */
function label(code: string): string {
  const name = catalog.value.find(r => r.code === code)?.name
  return name ? `${code} · ${name}` : code
}

async function add(code: string) {
  if (!props.target || busy.value) {
    return
  }
  busy.value = true
  try {
    if (props.target.kind === 'truck') {
      const { meta } = await api.post<{ data: Row, meta: Row }>(`/vehicles/${props.target.id}/loadout`, { codes: [code] })
      const moved = new Map((meta.moved as Row[]).map(m => [m.code, m.from]))
      meta.added.forEach((c: string) => success({ title: moved.has(c) ? 'Moved to this truck' : 'Added to truck', description: `${label(c)} rides on ${props.target!.name}.${moved.has(c) ? ` It came off ${moved.get(c)}.` : ''}` }))
      meta.already.forEach((c: string) => notify({ title: 'Already on truck', description: `${label(c)} is already on ${props.target!.name}.` }))
      meta.blocked.forEach((b: Row) => fail({ title: 'Can\'t add', description: `${label(b.code)}: ${b.reason}.` }))
    } else {
      const { meta } = await api.post<{ data: Row, meta: Row }>(`/containers/${props.target.id}/items`, { codes: [code], gps: await geo.fix() })
      meta.packed.forEach((c: string) => success({ title: meta.moved.includes(c) ? 'Moved into case' : 'Packed', description: `${label(c)} is now in ${props.target!.name}.${meta.moved.includes(c) ? ' It came out of another case.' : ''}` }))
      meta.already.forEach((c: string) => notify({ title: 'Already packed', description: `${label(c)} is already in ${props.target!.name}.` }))
    }
    query.value = ''
    emit('changed')
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
