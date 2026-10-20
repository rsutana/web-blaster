import type { AuthUser, Level } from '~/types/api'

/**
 * Route guard: sign-in first, then the forced credential change, then the role's permission for the page.
 * The API checks every request again; this only keeps people on pages they can use.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSanctumUser<AuthUser>()
  const isPublic = to.meta.public === true

  if (!user.value) {
    if (isPublic) {
      return
    }
    const login = to.path.startsWith('/crew') ? '/crew/login' : '/login'
    return navigateTo({ path: login, query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }, { replace: true })
  }

  const u = user.value
  if (u.is_must_change_credential) {
    const target = u.role === 'crew' ? '/crew/login' : '/account/credential'
    if (to.path !== target && !to.path.startsWith('/sign/')) {
      return navigateTo(target, { replace: true })
    }
    return
  }

  if (to.path === '/' || to.meta.guestOnly === true) {
    return navigateTo(u.home, { replace: true })
  }

  const module = to.meta.module as string | undefined
  const level = (to.meta.level as Level | undefined) ?? 'view'
  if (module) {
    const { can } = useAuthUser()
    if (!can(module, level)) {
      return navigateTo({ path: '/no-access', query: { page: (to.meta.title as string | undefined) ?? to.path } }, { replace: true })
    }
  }

  if (to.meta.crewHome === true && !u.personnel_id) {
    return navigateTo({ path: '/no-access', query: { page: 'Crew home' } }, { replace: true })
  }
})
