<script setup lang="ts">
definePageMeta({ module: 'equip', title: 'QR labels', layout: 'blank' })
useHead({ title: 'QR labels · Blaster Pro Audio' })

const route = useRoute()
function print() {
  window.print()
}
const codes = computed(() => String(route.query.codes ?? '').split(',').map(c => c.trim()).filter(Boolean))
</script>

<template>
  <div class="mx-auto flex max-w-[900px] flex-col gap-5 p-6">
    <div class="no-print flex flex-wrap items-center justify-between gap-3">
      <NuxtLink
        to="/equipment"
        class="text-sm font-semibold"
      >← Equipment</NuxtLink>
      <span class="text-sm text-[#565B66]">{{ plural(codes.length, 'label') }} · 4 per row on A4</span>
      <button
        type="button"
        class="btn btn-primary"
        @click="print"
      >
        Print
      </button>
    </div>
    <div class="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
      <div
        v-for="c in codes"
        :key="c"
        class="flex flex-col items-center gap-1.5 rounded-lg border border-[#DADDE3] bg-white p-3 break-inside-avoid"
      >
        <EquipmentQrCode
          :value="c"
          :size="120"
        />
        <span class="font-mono text-lg font-medium">{{ c }}</span>
        <span class="text-[11px] tracking-[.06em] text-[#565B66] uppercase">Blaster Pro Audio</span>
      </div>
    </div>
  </div>
</template>
