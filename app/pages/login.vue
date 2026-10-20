<script setup lang="ts">
import type { AuthUser } from '~/types/api'

definePageMeta({ layout: 'blank', public: true, guestOnly: true })
useHead({ title: 'Sign in · Blaster Pro Audio' })

const api = useApi()
const { login } = useSanctumAuth()
const user = useSanctumUser<AuthUser>()
const route = useRoute()

const step = ref<'id' | 'secret'>('id')
const identifier = ref('')
const secret = ref('')
const remember = ref(true)
const secretType = ref<'password' | 'pin'>('password')
const error = ref('')
const busy = ref(false)

async function next() {
  error.value = ''
  const value = identifier.value.trim()
  if (!value.includes('@') && !/^[0-9 +]{10,16}$/.test(value)) {
    error.value = 'Enter an email address or an 11-digit mobile number.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ secret_type: 'password' | 'pin' }>('/auth/identify', { identifier: value, channel: 'office' })
    secretType.value = res.secret_type
    step.value = 'secret'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function signIn() {
  error.value = ''
  if (!secret.value) {
    error.value = secretType.value === 'pin' ? 'Enter your 6-digit PIN.' : 'Enter your password.'
    return
  }
  busy.value = true
  try {
    await login({ identifier: identifier.value.trim(), secret: secret.value, channel: 'office', remember: remember.value })
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    await navigateTo(user.value?.is_must_change_credential ? '/account/credential' : (redirect ?? user.value?.home ?? '/'))
  } catch (e) {
    error.value = errorMessage(e)
    secret.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-wrap bg-[#F2F3F5]">
    <aside class="flex flex-[1_1_400px] flex-col justify-between gap-10 bg-[#0B0B0C] p-12 text-white max-sm:p-6">
      <div class="flex flex-col gap-7">
        <img
          src="/logo.png"
          alt="Blaster Pro Audio Touring Group"
          class="h-auto w-[340px] max-w-full"
        >
        <div class="flex gap-2">
          <span class="h-2 w-12 bg-[#2F5596]" /><span class="h-2 w-6 bg-[#ED1B24]" />
        </div>
        <h1 class="font-display m-0 text-[56px] leading-[.98] font-extrabold uppercase max-sm:text-[40px]">
          Every item.<br>Every crew member.<br>Every event.
        </h1>
        <p class="m-0 max-w-[460px] text-base text-[#C9CCD2]">
          Office sign-in for Owner, Admin and Manager. Crew members use their own phone link: <NuxtLink
            to="/crew/login"
            class="font-semibold text-white"
          >crew.blasterproaudio.ph</NuxtLink>
        </p>
      </div>
      <p class="m-0 text-sm text-[#9EA3AD]">
        Blaster Pro Audio · +63 917 676 5718
      </p>
    </aside>

    <main class="flex flex-[1_1_480px] items-center justify-center p-12 max-sm:p-6">
      <div class="flex w-full max-w-[420px] flex-col gap-6">
        <form
          v-if="step === 'id'"
          class="flex flex-col gap-5"
          novalidate
          @submit.prevent="next"
        >
          <div>
            <h2 class="font-display m-0 text-4xl font-extrabold uppercase">
              Sign in
            </h2>
            <p class="mt-1 mb-0 text-[15px] text-[#565B66]">
              Use your email or mobile number.
            </p>
          </div>
          <UiField
            label="Email or mobile number"
            :error="error"
          >
            <input
              v-model="identifier"
              type="text"
              autocomplete="username"
              class="ctl"
              :class="{ 'ctl-error': error }"
              style="min-height: 52px; font-size: 17px"
              autofocus
            >
          </UiField>
          <button
            type="submit"
            class="btn btn-primary btn-block"
            style="min-height: 52px; font-size: 16px"
            :disabled="busy"
          >
            Continue
          </button>
        </form>

        <form
          v-else
          class="flex flex-col gap-5"
          novalidate
          @submit.prevent="signIn"
        >
          <div>
            <h2 class="font-display m-0 text-4xl font-extrabold uppercase">
              {{ secretType === 'pin' ? 'Enter your PIN' : 'Enter your password' }}
            </h2>
            <p class="mt-1 mb-0 text-[15px] text-[#565B66]">
              {{ identifier }} · <button
                type="button"
                class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#2F5596] underline"
                @click="step = 'id'; secret = ''; error = ''"
              >
                Change
              </button>
            </p>
          </div>
          <UiField
            :label="secretType === 'pin' ? '6-digit PIN' : 'Password'"
            :error="error"
          >
            <input
              v-model="secret"
              :type="'password'"
              :inputmode="secretType === 'pin' ? 'numeric' : undefined"
              :maxlength="secretType === 'pin' ? 6 : undefined"
              autocomplete="current-password"
              class="ctl"
              :class="{ 'ctl-error': error }"
              :style="secretType === 'pin' ? 'min-height:52px;font-size:20px;letter-spacing:.4em' : 'min-height:52px;font-size:17px'"
              autofocus
            >
          </UiField>
          <label class="flex items-center gap-2.5 text-[15px]">
            <input
              v-model="remember"
              type="checkbox"
              class="size-5 accent-[#2F5596]"
            > Keep me signed in
          </label>
          <button
            type="submit"
            class="btn btn-primary btn-block"
            style="min-height: 52px; font-size: 16px"
            :disabled="busy"
          >
            Sign in
          </button>
          <p class="m-0 text-sm text-[#565B66]">
            {{ secretType === 'pin' ? 'Forgot PIN? Ask your admin.' : 'Forgot password? Ask the owner.' }}
          </p>
        </form>

        <div class="flex flex-col gap-3 border-t border-[#DADDE3] pt-5 text-sm text-[#565B66]">
          <NuxtLink
            to="/crew/login"
            class="font-semibold"
          >Crew member? Use the crew sign-in on your phone</NuxtLink>
          <p class="m-0">
            No SMS codes are sent. Accounts lock for 15 minutes after 5 wrong tries, or until an admin unlocks them.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
