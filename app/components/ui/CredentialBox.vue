<script setup lang="ts">
const props = defineProps<{ type: 'pin' | 'password', label?: string, help?: string }>()
const model = defineModel<string>({ required: true })
const api = useApi()

async function regenerate() {
  const res = await api.get<{ data: { credential: string } }>('/credential-suggestion', { type: props.type })
  model.value = res.data.credential
}

onMounted(() => {
  if (!model.value) {
    regenerate()
  }
})

const display = computed(() => props.type === 'pin' && model.value.length === 6 ? `${model.value.slice(0, 3)} ${model.value.slice(3)}` : model.value)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-sm font-semibold">{{ label ?? (type === 'pin' ? 'Temporary 6-digit PIN' : 'Temporary password') }}</span>
    <div class="flex gap-2">
      <output
        class="flex min-h-[52px] flex-1 items-center rounded-md bg-[#0B0B0C] px-4 font-mono text-white"
        :class="type === 'pin' ? 'text-2xl tracking-[.15em]' : 'text-lg'"
        aria-live="polite"
      >{{ display || '…' }}</output>
      <button
        type="button"
        class="btn btn-secondary"
        style="min-height: 52px"
        @click="regenerate"
      >
        {{ type === 'pin' ? 'New PIN' : 'New' }}
      </button>
    </div>
    <span class="help">{{ help ?? 'Hand it over in person. Nothing is sent by SMS or email. They must change it at their next sign-in.' }}</span>
  </div>
</template>
