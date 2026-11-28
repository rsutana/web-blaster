<script setup lang="ts">
import type { Row } from '~/types/api'

/** The client's delivery and end-of-event sign-offs for one event, collected on the crew's phone. */
const props = defineProps<{ eventId: number, eventLabel: string, refreshKey: number }>()
const emit = defineEmits<{ signing: [open: boolean] }>()
const api = useApi()
const { success } = useNotify()

const rows = ref<Row[]>([])
const loaded = ref(false)
const signing = ref<Row | null>(null)

async function load() {
  const id = props.eventId
  try {
    const data = (await api.get<{ data: Row[] }>(`/scan-events/${id}/sign-offs`)).data
    if (id === props.eventId) {
      rows.value = data
      loaded.value = true
    }
  } catch {
    // Not allowed to scan this event: there's nothing to collect, so the card stays hidden.
    rows.value = []
    loaded.value = false
  }
}
watch(() => [props.eventId, props.refreshKey], load, { immediate: true })
watch(() => signing.value !== null, open => emit('signing', open))
onBeforeUnmount(() => emit('signing', false))

function onSigned(data: Row[]) {
  const kind = signing.value?.kind
  rows.value = data
  signing.value = null
  const done = data.find(r => r.kind === kind)
  success({ title: 'Client signed', description: `${done?.label ?? 'Sign-off'} saved · ${done?.sign_off?.signer_name ?? ''}` })
}
</script>

<template>
  <section
    v-if="loaded && rows.length"
    class="card flex flex-col"
    aria-labelledby="sign-off-card-title"
  >
    <div class="border-b border-[#DADDE3] px-4 py-3">
      <h2
        id="sign-off-card-title"
        class="m-0 text-sm font-bold"
      >
        Client sign-off
      </h2>
      <p class="m-0 text-[13px] text-[#565B66]">
        {{ eventLabel }}
      </p>
    </div>
    <div
      v-for="r in rows"
      :key="r.kind"
      class="flex flex-col gap-2.5 border-b border-[#EEF0F2] px-4 py-3 last:border-0"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 flex-none items-center justify-center rounded-md"
          :class="r.state === 'signed' ? 'bg-[#E2F2E8] text-[#1D6B3C]' : r.state === 'ready' ? 'bg-[#FFF1D6] text-[#6B4100]' : 'bg-[#ECEEF1] text-[#565B66]'"
        >
          <UIcon
            :name="r.state === 'signed' ? 'i-lucide-badge-check' : r.state === 'ready' ? 'i-lucide-pen-line' : 'i-lucide-lock'"
            class="size-5"
          />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          <b class="font-semibold">{{ r.label }}</b>
          <span
            v-if="r.state === 'signed'"
            class="text-[13px] text-[#1D6B3C]"
          >Signed by {{ r.sign_off.signer_name }} · {{ r.sign_off.signed_at }}</span>
          <span
            v-else-if="r.state === 'ready'"
            class="text-[13px] text-[#6B4100]"
          >Ready · {{ plural(r.item_count, 'item') }} to confirm</span>
          <span
            v-else
            class="text-[13px] text-[#565B66]"
          >{{ r.locked_reason }}</span>
        </span>
      </div>

      <div
        v-if="r.state === 'signed'"
        class="ml-12 flex flex-col gap-1.5"
      >
        <img
          :src="r.sign_off.signature_url"
          :alt="`Signature of ${r.sign_off.signer_name}`"
          class="h-16 w-fit max-w-full rounded border border-[#DADDE3] bg-white object-contain"
        >
        <span class="text-[13px] text-[#565B66]">{{ plural(r.item_count, 'item') }} · collected by {{ r.sign_off.collected_by ?? 'crew' }}</span>
        <span
          v-if="r.sign_off.note"
          class="rounded-md bg-[#FFF1D6] px-2.5 py-1.5 text-[13px] text-[#6B4100]"
        >Client noted: {{ r.sign_off.note }}</span>
      </div>

      <button
        v-if="r.state === 'ready'"
        type="button"
        class="btn btn-primary btn-phone btn-block"
        aria-haspopup="dialog"
        @click="signing = r"
      >
        <UIcon
          name="i-lucide-signature"
          class="size-5"
        />Get client's signature
      </button>
    </div>

    <CrewSignOffSheet
      v-if="signing"
      :event-id="eventId"
      :event-label="eventLabel"
      :sign-off="signing"
      @close="signing = null"
      @done="onSigned"
    />
  </section>
</template>
