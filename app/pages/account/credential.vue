<script setup lang="ts">
definePageMeta({ layout: 'blank' })
useHead({ title: 'Set your password · Blaster Pro Audio' })

const api = useApi()
const { user } = useAuthUser()
const { refreshIdentity, logout } = useSanctumAuth()
const form = reactive({ current: '', new: '', new_confirmation: '' })
const errors = ref<Record<string, string>>({})
const busy = ref(false)

onMounted(() => {
  if (user.value?.role === 'crew' && user.value.is_must_change_credential) {
    navigateTo('/crew/login', { replace: true })
  }
})

async function save() {
  busy.value = true
  errors.value = {}
  try {
    await api.put('/auth/credential', { ...form, current: user.value?.is_must_change_credential ? undefined : form.current })
    await refreshIdentity()
    await navigateTo(user.value?.home ?? '/')
  } catch (e) {
    errors.value = fieldErrors(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6">
    <form
      class="card flex w-full max-w-[440px] flex-col gap-5 overflow-hidden"
      novalidate
      @submit.prevent="save"
    >
      <div class="bg-[#0B0B0C] px-5 py-[18px] text-white">
        <h1 class="font-display m-0 text-[26px] font-extrabold uppercase">
          {{ user?.is_must_change_credential ? 'Set your own password' : 'Change password' }}
        </h1>
        <p class="mt-1.5 mb-0 text-sm text-[#C9CCD2]">
          {{ user?.email ?? user?.mobile }} · the temporary password stops working once you save.
        </p>
      </div>
      <div class="flex flex-col gap-4 px-5">
        <UiField
          v-if="!user?.is_must_change_credential"
          label="Current password"
          :error="errors.current"
        >
          <input
            v-model="form.current"
            type="password"
            autocomplete="current-password"
            class="ctl"
          >
        </UiField>
        <UiField
          label="New password"
          help="At least 8 characters."
          :error="errors.new"
        >
          <input
            v-model="form.new"
            type="password"
            autocomplete="new-password"
            class="ctl"
            :class="{ 'ctl-error': errors.new }"
          >
        </UiField>
        <UiField
          label="New password again"
          :error="errors.new_confirmation"
        >
          <input
            v-model="form.new_confirmation"
            type="password"
            autocomplete="new-password"
            class="ctl"
            :class="{ 'ctl-error': errors.new_confirmation }"
          >
        </UiField>
      </div>
      <div class="flex justify-between gap-2 border-t border-[#DADDE3] px-5 py-3.5">
        <button
          type="button"
          class="btn btn-secondary"
          @click="logout()"
        >
          Sign out
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="busy"
        >
          Save password
        </button>
      </div>
    </form>
  </div>
</template>
