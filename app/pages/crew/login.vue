<script setup lang="ts">
import type { AuthUser } from '~/types/api'

definePageMeta({ layout: 'crew', public: true })
useHead({ title: 'Crew sign-in · Blaster Pro Audio' })

const api = useApi()
const { login, refreshIdentity } = useSanctumAuth()
const user = useSanctumUser<AuthUser>()
const route = useRoute()

type Step = 'mobile' | 'pin' | 'newpin' | 'confirm' | 'done'
const step = ref<Step>(user.value?.is_must_change_credential ? 'newpin' : 'mobile')
const mobile = ref('')
const pin = ref('')
const newPin = ref('')
const firstSignIn = ref(false)
const remember = ref(true)
const error = ref('')
const busy = ref(false)

const digits = computed(() => mobile.value.replace(/\D/g, ''))

onMounted(() => {
  if (user.value && !user.value.is_must_change_credential) {
    navigateTo(user.value.home, { replace: true })
  }
})

async function submitMobile() {
  error.value = ''
  if (!/^09\d{9}$/.test(digits.value)) {
    error.value = 'Enter an 11-digit mobile number starting with 09.'
    return
  }
  busy.value = true
  try {
    const res = await api.post<{ is_first_sign_in: boolean }>('/auth/identify', { identifier: digits.value, channel: 'crew' })
    firstSignIn.value = res.is_first_sign_in
    pin.value = ''
    step.value = 'pin'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

async function submitPin(value: string) {
  error.value = ''
  busy.value = true
  try {
    await login({ identifier: digits.value, secret: value, channel: 'crew', remember: remember.value })
    if (user.value?.is_must_change_credential) {
      newPin.value = ''
      pin.value = ''
      step.value = 'newpin'
    } else {
      step.value = 'done'
    }
  } catch (e) {
    error.value = errorMessage(e)
    pin.value = ''
  } finally {
    busy.value = false
  }
}

function isWeak(value: string): boolean {
  return /^(\d)\1{5}$/.test(value) || '0123456789'.includes(value) || '9876543210'.includes(value)
}

function submitNewPin(value: string) {
  error.value = ''
  if (isWeak(value)) {
    error.value = 'Too easy to guess. Pick another PIN.'
    pin.value = ''
    return
  }
  newPin.value = value
  pin.value = ''
  step.value = 'confirm'
}

async function submitConfirm(value: string) {
  error.value = ''
  if (value !== newPin.value) {
    error.value = 'PINs didn\'t match. Start again.'
    pin.value = ''
    newPin.value = ''
    step.value = 'newpin'
    return
  }
  busy.value = true
  try {
    await api.put('/auth/credential', { new: newPin.value, new_confirmation: value })
    await refreshIdentity()
    firstSignIn.value = true
    step.value = 'done'
  } catch (e) {
    error.value = errorMessage(e)
    pin.value = ''
    step.value = 'newpin'
  } finally {
    busy.value = false
  }
}

function goHome() {
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
  navigateTo(redirect ?? user.value?.home ?? '/crew')
}

const title = computed(() => ({
  mobile: 'Sign in',
  pin: firstSignIn.value ? 'Enter the temporary PIN' : 'Enter your PIN',
  newpin: 'Create your own PIN',
  confirm: 'Enter the new PIN again',
  done: ''
}[step.value]))
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <header class="bg-[#0B0B0C] px-5 pt-5 pb-[18px] text-white">
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
        class="h-auto w-[200px]"
      >
      <div class="mt-3 flex gap-1.5">
        <span class="h-1.5 w-10 bg-[#2F5596]" /><span class="h-1.5 w-5 bg-[#ED1B24]" />
      </div>
      <div class="font-display mt-2.5 text-[22px] font-extrabold uppercase">
        Crew sign-in
      </div>
    </header>

    <main class="flex flex-1 flex-col gap-5 px-5 py-6">
      <template v-if="step === 'done'">
        <div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span class="inline-flex size-[72px] items-center justify-center rounded-lg bg-[#1D6B3C] text-white">
            <UIcon
              name="i-lucide-check"
              class="size-10"
            />
          </span>
          <h1 class="font-display m-0 text-[30px] font-extrabold uppercase">
            {{ firstSignIn ? 'PIN saved. You\'re signed in.' : 'Signed in' }}
          </h1>
          <button
            type="button"
            class="btn btn-primary btn-block"
            style="min-height: 56px; font-size: 17px"
            @click="goHome"
          >
            Open Crew home
          </button>
        </div>
      </template>

      <template v-else>
        <div>
          <h1 class="font-display m-0 text-[34px] leading-none font-extrabold uppercase">
            {{ title }}
          </h1>
          <p class="mt-1.5 mb-0 text-[15px] text-[#565B66]">
            <template v-if="step === 'mobile'">
              Use the mobile number your admin registered.
            </template>
            <template v-else-if="step === 'pin'">
              {{ phone(digits) }} · <button
                type="button"
                class="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#2F5596] underline"
                @click="step = 'mobile'; error = ''"
              >
                Not you?
              </button>
            </template>
            <template v-else-if="step === 'newpin'">
              Step 1 of 2 · {{ phone(user?.mobile ?? digits) }}
            </template>
            <template v-else>
              Step 2 of 2 · {{ phone(user?.mobile ?? digits) }}
            </template>
          </p>
        </div>

        <form
          v-if="step === 'mobile'"
          class="flex flex-col gap-4"
          novalidate
          @submit.prevent="submitMobile"
        >
          <UiField
            label="Mobile number"
            :error="error"
          >
            <input
              v-model="mobile"
              type="tel"
              inputmode="numeric"
              maxlength="13"
              autocomplete="tel-national"
              placeholder="09XX XXX XXXX"
              class="ctl"
              :class="{ 'ctl-error': error }"
              style="min-height: 56px; font-size: 20px; font-weight: 500"
              autofocus
            >
          </UiField>
          <button
            type="submit"
            class="btn btn-primary btn-block"
            style="min-height: 56px; font-size: 17px"
            :disabled="busy"
          >
            Continue
          </button>
          <p class="m-0 text-sm text-[#565B66]">
            New crew? Your admin gives you a temporary PIN in person. No SMS is sent.
          </p>
        </form>

        <template v-else>
          <p
            v-if="step === 'newpin'"
            class="m-0 text-sm text-[#565B66]"
          >
            Avoid easy ones like 123456, 000000 or your birthday.
          </p>
          <p
            v-if="error"
            role="alert"
            class="m-0 text-sm font-semibold text-[#B4121A]"
          >
            {{ error }}
          </p>
          <CrewPinPad
            v-model="pin"
            :disabled="busy"
            @complete="(v: string) => step === 'pin' ? submitPin(v) : step === 'newpin' ? submitNewPin(v) : submitConfirm(v)"
          />
          <label
            v-if="step === 'pin' && !firstSignIn"
            class="flex items-center gap-2.5 text-[15px]"
          >
            <input
              v-model="remember"
              type="checkbox"
              class="size-5 accent-[#2F5596]"
            > Keep me signed in on this phone
          </label>
          <p class="m-0 text-sm text-[#565B66]">
            <template v-if="step === 'pin'">
              {{ firstSignIn ? 'Use the 6 digits your admin handed you.' : 'Forgot your PIN? Ask your admin to reset it. 5 wrong tries locks the account.' }}
            </template>
            <template v-else>
              Only you should know this PIN.
            </template>
          </p>
        </template>
      </template>
    </main>
  </div>
</template>
