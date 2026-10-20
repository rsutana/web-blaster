// Fades out the SPA loading template (app/spa-loading-template.html) instead of
// letting Nuxt remove it abruptly on `app:suspense:resolve`.
export default defineNuxtPlugin((nuxtApp) => {
  const el = document.getElementById('__nuxt-loader')
  if (!el) return

  // Nuxt removes the loader by this id; renaming it hands removal over to us.
  el.id = 'app-splash'

  const hide = () => {
    el.classList.add('is-hidden')
    setTimeout(() => el.remove(), 400)
  }

  nuxtApp.hooks.hookOnce('app:suspense:resolve', hide)
  nuxtApp.hooks.hookOnce('app:error', hide)
})
