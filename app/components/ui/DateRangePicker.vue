<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

type Range = { start: DateValue | undefined, end: DateValue | undefined }

const start = defineModel<string>('start', { default: '' })
const end = defineModel<string>('end', { default: '' })
const props = withDefaults(defineProps<{
  error?: boolean
  placeholder?: string
}>(), {
  error: false,
  placeholder: 'Pick start and end dates'
})

const open = ref(false)
const wide = ref(false)
const draft = shallowRef<Range>({ start: undefined, end: undefined })

function toDate(iso: string) {
  try {
    return iso ? parseDate(iso) : undefined
  } catch {
    return undefined
  }
}

function syncDraft() {
  draft.value = { start: toDate(start.value), end: toDate(end.value) }
}

watch(open, (v) => {
  if (v) {
    syncDraft()
  }
})

onMounted(() => {
  const mq = window.matchMedia('(min-width: 640px)')
  wide.value = mq.matches
  mq.addEventListener('change', e => (wide.value = e.matches))
})

function pick(value: unknown) {
  const r = (value ?? {}) as Partial<Range>
  draft.value = { start: r.start, end: r.end }
  if (r.start && r.end) {
    start.value = r.start.toString()
    end.value = r.end.toString()
    open.value = false
  }
}

function clear() {
  draft.value = { start: undefined, end: undefined }
  start.value = ''
  end.value = ''
}

const short = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const full = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: DateValue, withYear: boolean) => (withYear ? full : short).format(d.toDate('UTC'))

const s = computed(() => toDate(start.value))
const e = computed(() => toDate(end.value))
const days = computed(() => (s.value && e.value ? e.value.compare(s.value) + 1 : 0))
const label = computed(() => {
  if (!s.value || !e.value) {
    return ''
  }
  if (days.value === 1) {
    return fmt(s.value, true)
  }
  return `${fmt(s.value, s.value.year !== e.value.year)} → ${fmt(e.value, true)}`
})
const hint = computed(() => {
  if (draft.value.start && !draft.value.end) {
    return 'Now pick the last day (click the same day for a one-day event)'
  }
  return 'Pick the first day of the event'
})
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start', sideOffset: 6 }"
  >
    <button
      type="button"
      class="ctl flex items-center gap-2.5 text-left"
      :class="{ 'ctl-error': props.error }"
    >
      <UIcon
        name="i-lucide-calendar-range"
        class="size-5 shrink-0 text-ink-500"
      />
      <span
        class="min-w-0 flex-1 truncate"
        :class="{ 'text-ink-500': !label }"
      >{{ label || props.placeholder }}</span>
      <span
        v-if="days"
        class="shrink-0 rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[13px] font-semibold text-ink-600"
      >{{ days }} {{ days === 1 ? 'day' : 'days' }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 shrink-0 text-ink-500"
      />
    </button>

    <template #content>
      <div class="p-3">
        <p class="m-0 mb-2 px-1 text-[13px] font-semibold text-ink-600">
          {{ hint }}
        </p>
        <UCalendar
          :model-value="draft"
          range
          fixed-weeks
          color="primary"
          :number-of-months="wide ? 2 : 1"
          @update:model-value="pick"
        />
        <div class="mt-2 flex items-center justify-end gap-2 border-t border-ink-200 pt-2">
          <UButton
            label="Clear"
            color="neutral"
            variant="ghost"
            @click="clear"
          />
          <UButton
            label="Done"
            @click="open = false"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
