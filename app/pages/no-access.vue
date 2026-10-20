<script setup lang="ts">
definePageMeta({ layout: 'crew' })
useHead({ title: 'Not allowed · Blaster Pro Audio' })

const { user } = useAuthUser()
const route = useRoute()
const page = computed(() => (typeof route.query.page === 'string' ? route.query.page : 'this page'))
const seconds = ref(5)
let timer: ReturnType<typeof setInterval> | undefined

function goHome() {
  navigateTo(user.value?.home ?? '/', { replace: true })
}

onMounted(() => {
  timer = setInterval(() => {
    seconds.value--
    if (seconds.value <= 0) {
      clearInterval(timer)
      goHome()
    }
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <header class="flex items-center justify-between gap-3 bg-[#0B0B0C] px-5 py-4 text-white">
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
        class="h-auto w-[140px]"
      >
      <span class="text-sm text-[#C9CCD2]">{{ user?.name }} · {{ user?.role_label }}</span>
    </header>
    <main class="flex flex-1 flex-col gap-5 px-5 py-8">
      <span class="inline-flex size-[72px] items-center justify-center rounded-lg bg-[#C4141C] text-white">
        <UIcon
          name="i-lucide-lock"
          class="size-9"
        />
      </span>
      <h1 class="font-display m-0 text-4xl leading-none font-extrabold uppercase">
        This page isn't for your role
      </h1>
      <p class="m-0 text-base">
        You opened <b>{{ page }}</b>, which {{ user?.role === 'crew' ? 'crew accounts' : 'your role' }} can't view. Nothing was changed.
      </p>
      <button
        type="button"
        class="btn btn-primary btn-block"
        style="min-height: 56px; font-size: 17px"
        @click="goHome"
      >
        Go to my home
      </button>
      <p class="m-0 text-sm text-[#565B66]">
        Taking you there in {{ seconds }} seconds.
      </p>
      <div class="flex flex-col gap-2 rounded-lg bg-[#F2F3F5] p-4 text-sm text-[#3B3F47]">
        <div class="eyebrow text-[#565B66]">
          When this shows
        </div>
        <p class="m-0">
          Menu items you can't open are never shown. This only appears if you open a link someone shared or you saved.
        </p>
        <p class="m-0">
          Not signed in at all → any page goes to Sign in, then back to the page you asked for, if your role allows it.
        </p>
      </div>
    </main>
  </div>
</template>
