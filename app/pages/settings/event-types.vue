<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'events', level: 'edit', title: 'Event types' })
useHead({ title: 'Event types · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()

const types = ref<Row[]>([])
const loading = ref(true)
const busy = ref(false)
const addOpen = ref(false)

async function load() {
  types.value = (await api.get<{ data: Row[] }>('/event-types')).data
  loading.value = false
}
onMounted(() => load().catch(fail))

async function patch(t: Row, body: Row) {
  try {
    Object.assign(t, (await api.patch<{ data: Row }>(`/event-types/${t.id}`, body)).data)
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

function onAdded(t: Row) {
  types.value.push(t)
  notify(`${t.label} added`)
}

async function remove(t: Row) {
  busy.value = true
  try {
    await api.del(`/event-types/${t.id}`)
    types.value = types.value.filter(x => x.id !== t.id)
    notify(`${t.label} deleted`)
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-6">
    <SettingsNav class="flex-[1_1_220px] min-[901px]:sticky min-[901px]:top-8 min-[901px]:max-w-[260px]" />
    <div class="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
      <UiPageHeader
        title="Event types"
        subtitle="The choices in the event form, in this order. Turn one off to hide it from new events; events that use it keep it."
      >
        <template #actions>
          <button
            type="button"
            class="btn btn-primary"
            aria-haspopup="dialog"
            @click="addOpen = true"
          >
            <UIcon
              name="i-lucide-plus"
              class="size-[18px]"
            />Add event type
          </button>
        </template>
      </UiPageHeader>

      <section
        aria-label="Event types"
        class="card flex flex-col"
      >
        <UiSkeletonTable
          v-if="loading"
          :cols="5"
          :rows="4"
        />
        <UiEmpty
          v-else-if="!types.length"
          text="No event types yet."
          action="Add event type"
          @action="addOpen = true"
        />
        <div
          v-else
          class="tbl-wrap"
        >
          <table
            class="tbl"
            style="min-width: 640px"
          >
            <thead>
              <tr>
                <th class="w-12">
                  #
                </th>
                <th>Name</th>
                <th>Shown in form</th>
                <th>Used by</th>
                <th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(t, i) in types"
                :key="t.id"
                :class="{ 'opacity-60': !t.is_active }"
              >
                <td
                  data-label="Order"
                  class="font-mono text-[13px] text-[#565B66]"
                >
                  {{ i + 1 }}
                </td>
                <td data-cell="title">
                  <input
                    :value="t.label"
                    type="text"
                    maxlength="60"
                    class="ctl w-full min-w-0"
                    :aria-label="`Name of ${t.label}`"
                    @change="rename(t, $event)"
                  >
                </td>
                <td data-label="Shown in form">
                  <label
                    class="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-sm"
                    :title="t.is_active ? 'Shown in the event form' : 'Hidden from new events'"
                  >
                    <input
                      type="checkbox"
                      :checked="t.is_active"
                      :aria-label="`Show ${t.label} in the event form`"
                      @change="patch(t, { is_active: ($event.target as HTMLInputElement).checked })"
                    >{{ t.is_active ? 'On' : 'Off' }}
                  </label>
                </td>
                <td data-label="Used by">
                  {{ t.events_count ?? 0 }} {{ t.events_count === 1 ? 'event' : 'events' }}
                </td>
                <td
                  data-cell="actions"
                  class="text-right"
                >
                  <div class="inline-flex gap-1.5">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm px-2"
                      :disabled="busy || i === 0"
                      :aria-label="`Move ${t.label} up`"
                      title="Move up"
                      @click="move(i, -1)"
                    >
                      <UIcon
                        name="i-lucide-arrow-up"
                        class="size-4"
                      />
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm px-2"
                      :disabled="busy || i === types.length - 1"
                      :aria-label="`Move ${t.label} down`"
                      title="Move down"
                      @click="move(i, 1)"
                    >
                      <UIcon
                        name="i-lucide-arrow-down"
                        class="size-4"
                      />
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm px-2"
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
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <SettingsEventTypePanel
      v-model:open="addOpen"
      @saved="onAdded"
    />
  </div>
</template>
