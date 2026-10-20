<script setup lang="ts">
const { user, can } = useAuthUser()
const { logout } = useSanctumAuth()
const route = useRoute()
const open = ref(false)

const items = computed(() => [
  { label: 'Dashboard', to: '/dashboard', icon: 'i-lucide-layout-dashboard', module: 'dash' },
  { label: 'Calendar', to: '/calendar', icon: 'i-lucide-calendar-days', module: 'cal' },
  { label: 'Events', to: '/events', icon: 'i-lucide-calendar', module: 'events', level: 'view' as const },
  { label: 'Bookings', to: '/bookings', icon: 'i-lucide-clipboard-list', module: 'book', match: ['/bookings', '/invoices'] },
  { label: 'Clients', to: '/clients', icon: 'i-lucide-users', module: 'clients' },
  { label: 'Equipment', to: '/equipment', icon: 'i-lucide-speaker', module: 'equip' },
  { label: 'Crew', to: '/personnel', icon: 'i-lucide-user', module: 'crew', level: 'view' as const },
  { label: 'Payroll', to: '/payroll', icon: 'i-lucide-wallet', module: 'payroll', level: 'view' as const },
  { label: 'Users & roles', to: '/users', icon: 'i-lucide-shield', module: 'users' }
].filter(i => can(i.module, i.level ?? 'view')))

function isActive(item: { to: string, match?: string[] }): boolean {
  return (item.match ?? [item.to]).some(p => route.path === p || route.path.startsWith(p + '/'))
}

watch(() => route.fullPath, () => {
  open.value = false
})

async function signOut() {
  await logout()
}
</script>

<template>
  <aside
    class="bpa-side"
    :class="{ 'is-open': open }"
  >
    <NuxtLink
      to="/"
      class="bpa-logo"
      aria-label="Blaster Pro Audio home"
    >
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
      >
    </NuxtLink>
    <button
      type="button"
      class="bpa-burger"
      aria-label="Open menu"
      aria-haspopup="dialog"
      @click="open = true"
    >
      <UIcon
        name="i-lucide-menu"
        class="size-[22px]"
      />
    </button>
    <button
      v-if="open"
      type="button"
      class="bpa-scrim"
      aria-label="Close menu"
      @click="open = false"
    />
    <div
      class="bpa-menu"
      :role="open ? 'dialog' : undefined"
      aria-label="Menu"
    >
      <div class="bpa-drawer-head">
        <button
          type="button"
          class="bpa-close"
          aria-label="Close menu"
          @click="open = false"
        >
          <UIcon
            name="i-lucide-x"
            class="size-5"
          />
        </button>
        <img
          src="/logo.png"
          alt=""
          style="width: 150px"
        >
      </div>
      <nav
        aria-label="Main"
        class="flex flex-col gap-1"
      >
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          :aria-current="isActive(item) ? 'page' : undefined"
          class="bpa-nav"
          :class="{ 'is-active': isActive(item) }"
        >
          <UIcon
            :name="item.icon"
            class="size-[18px] shrink-0"
          />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="mt-auto flex flex-col gap-2.5 border-t border-[#2A2C31] pt-4">
        <div class="text-[13px] text-[#9EA3AD]">
          Signed in as
        </div>
        <div class="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            class="font-display inline-flex size-9 items-center justify-center rounded-md bg-[#ED1B24] text-lg font-extrabold text-white"
          >{{ user?.initial }}</span>
          <div class="flex flex-col">
            <span class="text-[15px] font-semibold text-white">{{ user?.name }}</span>
            <span class="text-[13px] text-[#9EA3AD]">{{ user?.role_label }}</span>
          </div>
        </div>
        <button
          type="button"
          class="flex min-h-10 items-center text-left text-sm text-[#C9CCD2] underline hover:text-white"
          @click="signOut"
        >
          Sign out
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.bpa-side { flex: 1 1 232px; max-width: 232px; background: #0B0B0C; color: #FFFFFF; padding: 20px 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px; }
.bpa-logo img { width: 196px; height: auto; display: block; }
.bpa-burger, .bpa-scrim, .bpa-drawer-head { display: none; }
.bpa-menu { flex: 1; display: flex; flex-direction: column; gap: 24px; }
.bpa-nav { min-height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-radius: 6px; color: #C9CCD2; text-decoration: none; font-weight: 500; font-size: 15px; }
.bpa-nav:hover { background: #1A1B1E; color: #FFFFFF; }
.bpa-nav.is-active { background: #2F5596; color: #FFFFFF; font-weight: 600; }
@keyframes bpa-drawer-in { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes bpa-fade-in { from { opacity: 0 } to { opacity: 1 } }
@media (max-width: 900px) {
  .bpa-side { flex: 1 1 100%; max-width: none; height: auto; position: sticky; top: 0; z-index: 44; flex-direction: row; align-items: center; justify-content: flex-start; padding: 8px 16px 8px 8px; gap: 8px; min-height: 60px; overflow: visible; }
  .bpa-logo img { width: 132px; }
  .bpa-burger { display: inline-flex; order: -1; align-items: center; justify-content: center; width: 44px; height: 44px; border: 0; border-radius: 6px; background: transparent; color: #FFFFFF; cursor: pointer; }
  .bpa-menu { display: none; }
  .bpa-side.is-open .bpa-menu { display: flex; position: fixed; top: 0; left: 0; bottom: 0; width: 280px; max-width: 85%; z-index: 61; background: #0B0B0C; padding: 10px 14px 20px; overflow-y: auto; box-shadow: 8px 0 24px rgba(0, 0, 0, .35); animation: bpa-drawer-in .24s ease-out; }
  .bpa-side.is-open .bpa-scrim { display: block; position: fixed; inset: 0; z-index: 60; border: 0; padding: 0; background: rgba(11, 11, 12, .6); animation: bpa-fade-in .2s ease-out; }
  .bpa-drawer-head { display: flex; align-items: center; gap: 8px; }
  .bpa-close { width: 44px; height: 44px; flex: none; border: 0; border-radius: 6px; background: transparent; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
}
</style>
