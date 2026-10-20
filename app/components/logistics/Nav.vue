<script setup lang="ts">
const route = useRoute()
const { can } = useAuthUser()
const TABS = [
  { to: '/trips', label: 'Trips', icon: 'i-lucide-route' },
  { to: '/logistics/cases', label: 'Cases', icon: 'i-lucide-package' },
  { to: '/logistics/vehicles', label: 'Trucks', icon: 'i-lucide-truck' },
  { to: '/logistics/drivers', label: 'Drivers', icon: 'i-lucide-id-card' },
  { to: '/logistics/places', label: 'Places', icon: 'i-lucide-map-pin' }
]
const tabs = computed(() => can('logistics', 'view') ? TABS : TABS.slice(0, 1))
const active = (to: string) => route.path === to || route.path.startsWith(to + '/')
</script>

<template>
  <nav
    aria-label="Logistics"
    class="flex flex-wrap gap-1 rounded-md bg-white p-1 ring-1 ring-[#DADDE3]"
  >
    <NuxtLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      :aria-current="active(t.to) ? 'page' : undefined"
      class="inline-flex min-h-10 items-center gap-2 rounded px-3.5 text-sm font-semibold no-underline"
      :class="active(t.to) ? 'bg-[#0B0B0C] text-white hover:text-white' : 'text-[#0B0B0C] hover:bg-[#F2F3F5] hover:text-[#0B0B0C]'"
    >
      <UIcon
        :name="t.icon"
        class="size-4"
      />{{ t.label }}
    </NuxtLink>
  </nav>
</template>
