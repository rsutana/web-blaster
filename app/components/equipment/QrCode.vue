<script setup lang="ts">
import QRCode from 'qrcode'

const props = withDefaults(defineProps<{ value: string, size?: number, dark?: string, light?: string }>(), { size: 88, dark: '#0B0B0C', light: '#FFFFFF' })
const src = ref('')

watchEffect(async () => {
  src.value = await QRCode.toDataURL(props.value, { margin: 1, width: props.size * 2, color: { dark: props.dark, light: props.light } })
})
</script>

<template>
  <img
    :src="src"
    :alt="`QR code ${value}`"
    :width="size"
    :height="size"
    class="block"
  >
</template>
