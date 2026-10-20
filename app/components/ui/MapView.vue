<script setup lang="ts">
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPin } from '~/types/api'

const props = withDefaults(defineProps<{
  pins?: MapPin[]
  path?: [number, number][]
  height?: number
  label: string
  /** Click to pick a point (place editor). */
  pickable?: boolean
  zoom?: number
}>(), { pins: () => [], path: () => [], height: 280, pickable: false, zoom: 14 })

const emit = defineEmits<{ pick: [lat: number, lng: number] }>()

const el = ref<HTMLDivElement | null>(null)
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let layer: Leaflet.LayerGroup | null = null
const router = useRouter()

/** Philippines, roughly, when there's nothing to show yet. */
const FALLBACK: [number, number] = [12.8797, 121.774]

function draw() {
  if (!L || !map || !layer) {
    return
  }
  layer.clearLayers()
  const bounds: [number, number][] = []

  if (props.path.length > 1) {
    L.polyline(props.path, { color: '#2F5596', weight: 4, opacity: 0.85 }).addTo(layer)
    bounds.push(...props.path)
  }
  for (const p of props.pins) {
    const color = p.color ?? '#2F5596'
    if (p.radius) {
      L.circle([p.lat, p.lng], { radius: p.radius, color, weight: 1, fillOpacity: 0.08 }).addTo(layer)
    }
    const marker = L.circleMarker([p.lat, p.lng], p.kind === 'truck'
      ? { radius: 9, color: '#FFFFFF', weight: 3, fillColor: color, fillOpacity: 1 }
      : p.kind === 'point'
        ? { radius: 5, color, weight: 2, fillColor: color, fillOpacity: 0.9 }
        : { radius: 8, color, weight: 3, fillColor: '#FFFFFF', fillOpacity: 1 })
    if (p.label) {
      marker.bindTooltip(p.label, { direction: 'top', offset: [0, -8] })
    }
    if (p.to) {
      marker.on('click', () => router.push(p.to!))
    }
    marker.addTo(layer)
    bounds.push([p.lat, p.lng])
  }

  if (bounds.length === 1) {
    map.setView(bounds[0]!, props.zoom)
  } else if (bounds.length > 1) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 16 })
  } else {
    map.setView(FALLBACK, 5)
  }
}

onMounted(async () => {
  L = await import('leaflet')
  if (!el.value) {
    return
  }
  map = L.map(el.value, { scrollWheelZoom: false, attributionControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  if (props.pickable) {
    map.on('click', (e: Leaflet.LeafletMouseEvent) => emit('pick', Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7))))
  }
  draw()
})

watch(() => [props.pins, props.path], draw, { deep: true })

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div
    ref="el"
    role="img"
    :aria-label="label"
    class="bpa-map w-full overflow-hidden rounded-md border border-[#DADDE3] bg-[#ECEEF1]"
    :class="{ 'cursor-crosshair': pickable }"
    :style="{ height: `${height}px` }"
  />
</template>

<style scoped>
.bpa-map { z-index: 0; isolation: isolate; }
</style>
