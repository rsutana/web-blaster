import type { AuthUser, Level } from '~/types/api'

const RANK: Record<Level, number> = { none: 0, own: 1, view: 2, edit: 3, full: 4 }

export function useAuthUser() {
  const user = useSanctumUser<AuthUser>()

  function can(module: string, level: Level = 'view'): boolean {
    const u = user.value
    if (!u) {
      return false
    }
    if (u.role === 'owner') {
      return true
    }
    return RANK[u.permissions[module] ?? 'none'] >= RANK[level]
  }

  return {
    user,
    can,
    canSeeRates: computed(() => user.value?.can_see_rates ?? false),
    canSeeRevenue: computed(() => user.value?.can_see_revenue ?? false),
    isCrew: computed(() => user.value?.role === 'crew'),
    isOwner: computed(() => user.value?.role === 'owner'),
    isAdminish: computed(() => user.value?.role === 'owner' || user.value?.role === 'admin')
  }
}
