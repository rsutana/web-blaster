<script setup lang="ts">
import type { Row } from '~/types/api'

const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { notify, fail } = useNotify()

const types = ref<Row[]>([])
const loading = ref(true)
const busy = ref(false)
const newLabel = ref('')
const addError = ref('')

async function load() {
  types.value = (await api.get<{ data: Row[] }>('/event-types')).data
  loading.value = false
}

watch(open, (v) => {
  if (v) {
    newLabel.value = ''
    addError.value = ''
    load().catch(fail)
  }
}, { immediate: true })

async function patch(t: Row, body: Row) {
  try {
    Object.assign(t, (await api.patch<{ data: Row }>(`/event-types/${t.id}`, body)).data)
    emit('changed')
  } catch (e) {
    fail(e)
    await load()
  }
}

function rename(t: Row, e: Event) {
  const input = e.target as HTMLInputElement
  const label = input.value.trim()
  if (!label || label === t.label) {
    input.value = t.label
    return
  }
  patch(t, { label })
}

async function move(i: number, dir: -1 | 1) {
  const list = [...types.value]
  ;[list[i], list[i + dir]] = [list[i + dir]!, list[i]!]
  types.value = list
  busy.value = true
  try {
    for (const [idx, t] of list.entries()) {
      if (t.sort !== idx + 1) {
        await patch(t, { sort: idx + 1 })
      }
    }
  } finally {
    busy.value = false
  }
}

async function add() {
  addError.value = ''
  if (!newLabel.value.trim()) {
    addError.value = 'Enter the event type name.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ data: Row }>('/event-types', { label: newLabel.value })
    types.value.push(res.data)
    notify(`${res.data.label} added`)
    newLabel.value = ''
    emit('changed')
  } catch (e) {
    addError.value = fieldErrors(e).label ?? ''
    if (!addError.value) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}

async function remove(t: Row) {
  busy.value = true
  try {
    await api.del(`/event-types/${t.id}`)
    types.value = types.value.filter(x => x.id !== t.id)
    notify(`${t.label} deleted`)
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Event types"
    subtitle="The choices in the event form. Turn one off to hide it from new events; events that use it keep it."
  >
    <UiSpinner v-if="loading" />
    <ul
      v-else
      class="m-0 flex list-none flex-col gap-2 p-0"
    >
      <li
        v-for="(t, i) in types"
        :key="t.id"
        class="flex items-center gap-2"
      >
        <input
          :value="t.label"
          type="text"
          maxlength="60"
          class="ctl min-w-0 flex-1"
          :class="{ 'text-[#8A8F99]': !t.is_active }"
          :aria-label="`Name of ${t.label}`"
          @change="rename(t, $event)"
        >
        <label
          class="flex flex-none cursor-pointer items-center gap-1.5 text-sm"
          :title="t.is_active ? 'Shown in the event form' : 'Hidden from new events'"
        >
          <input
            type="checkbox"
            :checked="t.is_active"
            @change="patch(t, { is_active: ($event.target as HTMLInputElement).checked })"
          >On
        </label>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :disabled="busy || i === 0"
          :aria-label="`Move ${t.label} up`"
          @click="move(i, -1)"
        >
          <UIcon
            name="i-lucide-arrow-up"
            class="size-4"
          />
        </button>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :disabled="busy || i === types.length - 1"
          :aria-label="`Move ${t.label} down`"
          @click="move(i, 1)"
        >
          <UIcon
            name="i-lucide-arrow-down"
            class="size-4"
          />
        </button>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :disabled="busy || t.events_count > 0"
          :title="t.events_count > 0 ? `Used by ${t.events_count} ${t.events_count === 1 ? 'event' : 'events'}. Turn it off instead.` : 'Delete'"
          :aria-label="`Delete ${t.label}`"
          @click="remove(t)"
        >
          <UIcon
            name="i-lucide-trash-2"
            class="size-4"
          />
        </button>
      </li>
    </ul>
    <UiField
      label="Add a type"
      :error="addError"
    >
      <div class="flex gap-2">
        <input
          v-model="newLabel"
          type="text"
          maxlength="60"
          class="ctl min-w-0 flex-1"
          :class="{ 'ctl-error': addError }"
          placeholder="e.g. Birthday / debut"
          @keydown.enter.prevent="add"
        >
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy"
          @click="add"
        >
          Add
        </button>
      </div>
    </UiField>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Done
      </button>
    </template>
  </UiDialog>
</template>
