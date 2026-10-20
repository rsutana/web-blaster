<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ complete: [pin: string] }>()
const pin = defineModel<string>({ required: true })

function press(d: string) {
  if (props.disabled || pin.value.length >= 6) {
    return
  }
  const next = pin.value + d
  pin.value = next
  if (next.length === 6) {
    emit('complete', next)
  }
}

function back() {
  pin.value = pin.value.slice(0, -1)
}

function onKey(e: KeyboardEvent) {
  if (/^\d$/.test(e.key)) {
    press(e.key)
  } else if (e.key === 'Backspace') {
    back()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      class="flex justify-center gap-3.5"
      role="img"
      :aria-label="`PIN entered: ${pin.length} of 6 digits`"
    >
      <span
        v-for="i in 6"
        :key="i"
        class="size-[18px] rounded-full"
        :class="i <= pin.length ? 'bg-[#0B0B0C]' : 'border-2 border-[#9AA0AB]'"
      />
    </div>
    <div class="grid grid-cols-3 gap-2.5">
      <button
        v-for="d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
        :key="d"
        type="button"
        class="font-display h-[60px] cursor-pointer rounded-md border-0 bg-[#F2F3F5] text-[28px] font-bold text-[#0B0B0C] active:bg-[#DADDE3]"
        :disabled="disabled"
        @click="press(d)"
      >
        {{ d }}
      </button>
      <span />
      <button
        type="button"
        class="font-display h-[60px] cursor-pointer rounded-md border-0 bg-[#F2F3F5] text-[28px] font-bold text-[#0B0B0C] active:bg-[#DADDE3]"
        :disabled="disabled"
        @click="press('0')"
      >
        0
      </button>
      <button
        type="button"
        class="h-[60px] cursor-pointer rounded-md border border-[#B9BEC7] bg-white text-[17px] font-semibold"
        :disabled="disabled"
        @click="back"
      >
        Delete
      </button>
    </div>
  </div>
</template>
