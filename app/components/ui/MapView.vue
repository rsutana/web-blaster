<script setup lang="ts">
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapPath, MapPin } from '~/types/api'

const props = withDefaults(defineProps<{
  pins?: MapPin[]
  path?: [number, number][]
  /** Several routes at once (overview maps), each in its own colour. */
  paths?: MapPath[]
  height?: number
  label: string
  /** Click to pick a point (place editor). */
  pickable?: boolean
  zoom?: number
}>(), { pins: () => [], path: () => [], paths: () => [], height: 280, pickable: false, zoom: 14 })

const emit = defineEmits<{ pick: [lat: number, lng: number] }>()

const el = ref<HTMLDivElement | null>(null)
let L: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let layer: Leaflet.LayerGroup | null = null
let disposed = false
const router = useRouter()

/** Philippines, roughly, when there's nothing to show yet. */
const FALLBACK: [number, number] = [12.8797, 121.774]

function draw() {
  if (!L || !map || !layer) {
    return
  }
  layer.clearLayers()
  const bounds: [number, number][] = []

  for (const line of [{ points: props.path }, ...props.paths] as MapPath[]) {
    if (line.points.length < 2) {
      continue
    }
    const drawn = L.polyline(line.points, { color: line.color ?? '#2F5596', weight: 4, opacity: 0.85 }).addTo(layer)
    if (line.label) {
      drawn.bindTooltip(line.label, { sticky: true })
    }
    bounds.push(...line.points)
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
      marker.on('click', () => {
        map?.stop()
        router.push(p.to!)
      })
    }
    marker.addTo(layer)
    bounds.push([p.lat, p.lng])
  }

  // No animation on refits: a zoom still animating when the map unmounts crashes Leaflet.
  if (bounds.length === 1) {
    map.setView(bounds[0]!, props.zoom, { animate: false })
  } else if (bounds.length > 1) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 16, animate: false })
  } else {
    map.setView(FALLBACK, 5, { animate: false })
  }
}

onMounted(async () => {
  L = await import('leaflet')
  if (disposed || !el.value) {
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

watch(() => [props.pins, props.path, props.paths], draw, { deep: true })

onBeforeUnmount(() => {
  disposed = true
  if (!map) {
    return
  }
  map.stop()
  map.off()
  layer?.clearLayers()
  // Leaflet finishes a zoom on a 250 ms timer that reads the removed map pane (`_leaflet_pos` error); this flag makes it bail.
  ;(map as unknown as { _animatingZoom?: boolean })._animatingZoom = false
  map.remove()
  map = null
  layer = null
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
