<script setup lang="ts">
const route = useRoute()
const GROUPS = [
  {
    heading: 'Events',
    items: [
      { to: '/settings/event-types', label: 'Event types', icon: 'i-lucide-tags' }
    ]
  }
]
const active = (to: string) => route.path === to || route.path.startsWith(to + '/')
</script>

<template>
  <nav
    aria-label="Settings"
    class="flex flex-col gap-5 rounded-xl bg-white p-3.5 ring-1 ring-[#DADDE3]"
  >
    <div
      v-for="g in GROUPS"
      :key="g.heading"
      class="flex flex-col gap-1"
    >
      <div class="px-3.5 pb-1 text-xs font-semibold tracking-[.08em] text-[#565B66] uppercase">
        {{ g.heading }}
      </div>
      <NuxtLink
        v-for="t in g.items"
        :key="t.to"
        :to="t.to"
        :aria-current="active(t.to) ? 'page' : undefined"
        class="flex min-h-10 items-center gap-2.5 rounded-lg px-3.5 text-[15px] no-underline"
        :class="active(t.to) ? 'bg-[#E8EEF7] font-semibold text-[#2F5596] hover:text-[#2F5596]' : 'font-medium text-[#3A3E46] hover:bg-[#F2F3F5] hover:text-[#0B0B0C]'"
      >
        <UIcon
          :name="t.icon"
          class="size-[18px] shrink-0"
        />{{ t.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
