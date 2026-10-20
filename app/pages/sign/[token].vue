<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', public: true })
useHead({ title: 'Sign contract · Blaster Pro Audio' })

const route = useRoute()
const config = useRuntimeConfig()
const doc = ref<Row | null>(null)
const name = ref('')
const agree = ref(false)
const error = ref('')
const busy = ref(false)
const notFound = ref(false)

const url = computed(() => `${config.public.apiBase}/signatures/${route.params.token}`)

onMounted(async () => {
  try {
    doc.value = (await $fetch<{ data: Row }>(url.value, { headers: { Accept: 'application/json' } })).data
  } catch {
    notFound.value = true
  }
})

async function sign() {
  error.value = ''
  if (!name.value.trim() || !agree.value) {
    error.value = 'Type your full name and tick the box to sign.'
    return
  }
  busy.value = true
  try {
    doc.value = (await $fetch<{ data: Row }>(url.value, { method: 'PUT', body: { signer_name: name.value.trim() }, headers: { Accept: 'application/json' } })).data
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const LABELS: Record<string, string> = { event_name: 'Event', event_date_text: 'Date', venue_address: 'Venue', contact_name_role: 'Contact', contact_mobile: 'Mobile', contact_email: 'Email', load_in: 'Load-in', show_time: 'Show time', load_out: 'Load-out', power_requirements: 'Power', stage_size: 'Stage size', crew_note: 'Crew' }
</script>

<template>
  <div class="contents">
    <header class="bg-[#0B0B0C] px-5 pt-5 pb-[18px] text-white">
      <img
        src="/logo.png"
        alt="Blaster Pro Audio Touring Group"
        class="h-auto w-[200px]"
      >
      <div class="font-display mt-3 text-[22px] font-extrabold uppercase">
        Contract to sign
      </div>
    </header>
    <main class="flex flex-col gap-4 bg-white p-5">
      <p
        v-if="notFound"
        class="m-0"
      >
        This signing link isn't valid. Ask Blaster Pro Audio to send it again.
      </p>
      <UiSkeletonPage
        v-else-if="!doc"
        variant="mobile"
      />
      <template v-else>
        <div>
          <div class="font-mono text-sm text-[#565B66]">
            {{ doc.code }}
          </div>
          <h1 class="font-display m-0 text-[30px] leading-none font-extrabold uppercase">
            {{ doc.name }}
          </h1>
          <p class="mt-1 mb-0 text-[15px]">
            {{ doc.client }}
          </p>
        </div>
        <dl class="m-0 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-[15px]">
          <template
            v-for="(v, k) in doc.fields"
            :key="k"
          >
            <template v-if="v">
              <dt class="text-[#565B66]">
                {{ LABELS[k] }}
              </dt><dd class="m-0">
                {{ v }}
              </dd>
            </template>
          </template>
          <dt class="text-[#565B66]">
            Total
          </dt><dd class="m-0 font-bold">
            {{ doc.total }} incl. VAT
          </dd>
          <dt class="text-[#565B66]">
            Deposit
          </dt><dd class="m-0">
            {{ doc.deposit }} to lock the date
          </dd>
        </dl>
        <ul class="m-0 flex flex-col gap-1 pl-4 text-sm text-[#3B3F47]">
          <li>The deposit locks the date; the balance is due 7 days after the event.</li>
          <li>Cancellation within 14 days forfeits the deposit.</li>
          <li>Overtime is billed per hour after the agreed load-out.</li>
        </ul>
        <p
          v-if="doc.company_signed"
          class="m-0 text-sm text-[#1D6B3C]"
        >
          {{ doc.company_signed }}
        </p>
        <div
          v-if="doc.is_signed"
          class="rounded-lg bg-[#E2F2E8] p-4 font-semibold text-[#1D6B3C]"
        >
          {{ doc.signed_label }}. Thank you!
        </div>
        <form
          v-else
          class="flex flex-col gap-3"
          @submit.prevent="sign"
        >
          <UiField
            label="Your full name"
            :error="error"
          >
            <input
              v-model="name"
              type="text"
              autocomplete="name"
              class="ctl"
            >
          </UiField>
          <label class="flex items-start gap-2.5 text-[15px]">
            <input
              v-model="agree"
              type="checkbox"
              class="mt-0.5 size-5 accent-[#2F5596]"
            > I agree to this contract. My name, the time and my IP address are saved with my signature.
          </label>
          <button
            type="submit"
            class="btn btn-primary btn-phone"
            :disabled="busy"
          >
            Sign contract
          </button>
        </form>
      </template>
    </main>
  </div>
</template>
