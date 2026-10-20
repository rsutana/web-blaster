<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ person?: Row | null }>()
const emit = defineEmits<{ saved: [person: Row, isNew: boolean, pin?: string | null], deleted: [person: Row, reason: string], reactivated: [person: Row], changed: [] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { notify, fail } = useNotify()

const ROLES = [['sound_tech', 'Sound tech'], ['lights', 'Lights'], ['stagehand', 'Stagehand'], ['rigger', 'Rigger'], ['event_lead', 'Event lead'], ['driver', 'Driver'], ['utility', 'Utility'], ['video_tech', 'Video tech'], ['audio_engineer', 'Audio engineer']]
const blank = () => ({ full_name: '', mobile: '', email: '', usual_role: 'sound_tech', pay_schedule: 'semi_monthly', payout_method: 'gcash', wallet_number: '', emergency_name: '', emergency_mobile: '', notes: '', has_login: true, pin: '' })
const form = reactive(blank())
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const deleteOpen = ref(false)
const local = ref<Row | null>(null)
const isEdit = computed(() => !!props.person)

watch(open, (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  Object.assign(form, blank())
  local.value = props.person ? { ...props.person } : null
  if (props.person) {
    const p = props.person
    Object.assign(form, { full_name: p.full_name, mobile: p.mobile ?? '', email: p.email ?? '', usual_role: p.usual_role, pay_schedule: p.pay_schedule, payout_method: p.payout_method, wallet_number: p.wallet_number ?? '', emergency_name: p.emergency_name ?? '', emergency_mobile: p.emergency_mobile ?? '', notes: p.notes ?? '' })
  }
}, { immediate: true })

const roles = computed(() => isEdit.value ? [...ROLES].sort((a, b) => a[1]!.localeCompare(b[1]!)) : ROLES)

async function save() {
  busy.value = true
  errors.value = {}
  const body: Row = { ...form }
  for (const k of ['email', 'wallet_number', 'emergency_name', 'emergency_mobile', 'notes']) {
    if (!body[k]) {
      body[k] = null
    }
  }
  if (body.payout_method === 'cash') {
    body.wallet_number = null
  }
  try {
    if (isEdit.value) {
      delete body.has_login
      delete body.pin
      const res = await api.patch<{ data: Row }>(`/personnel/${props.person!.id}`, body)
      open.value = false
      emit('saved', res.data, false)
    } else {
      if (!body.has_login) {
        delete body.pin
      }
      const res = await api.post<{ data: Row, meta: { temporary_pin: string | null } }>('/personnel', body)
      open.value = false
      emit('saved', res.data, true, res.meta.temporary_pin)
    }
  } catch (e) {
    errors.value = fieldErrors(e)
    if (!Object.keys(errors.value).length) {
      fail(e)
    }
  } finally {
    busy.value = false
  }
}

async function loginAction(action: 'give' | 'reset' | 'off' | 'on') {
  try {
    if (action === 'off') {
      const res = await api.del<{ data: Row }>(`/personnel/${props.person!.id}/login`)
      local.value = { ...local.value, login: res.data.login }
      notify(`${props.person!.full_name}'s Crew login is turned off.`)
    } else {
      const res = await api.post<{ data: Row }>(`/personnel/${props.person!.id}/login`, {})
      local.value = { ...local.value, login: { state: 'crew', note: 'not signed in yet' } }
      notify(`Temporary PIN ${res.data.display} set for ${props.person!.full_name}. Hand it over in person.`)
    }
    emit('changed')
  } catch (e) {
    fail(e)
  }
}

async function reactivate() {
  try {
    const res = await api.del<{ data: Row }>(`/personnel/${props.person!.id}/deactivation`)
    local.value = res.data
    emit('reactivated', res.data)
  } catch (e) {
    fail(e)
  }
}

function onDeleted(p: Row, reason: string) {
  local.value = p
  emit('deleted', p, reason)
}
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isEdit ? 'Edit person' : 'Add person'"
    :subtitle="isEdit ? `${person!.full_name} · ${person!.usual_role_label} · rates are set per event, not here.` : 'Rates aren\'t set here — they\'re set per event.'"
  >
    <div
      v-if="isEdit && local"
      class="flex flex-col gap-2 rounded-lg p-3.5"
      :class="local.status === 'active' ? 'bg-[#F2F3F5]' : 'bg-[#ECEEF1]'"
    >
      <div class="flex items-center gap-2.5">
        <span class="text-sm font-semibold">Status</span>
        <UiBadge
          :tone="local.status === 'active' ? TONES.green : TONES.black"
          :label="local.status === 'active' ? 'Active' : 'Inactive'"
        />
      </div>
      <p class="m-0 text-sm text-[#565B66]">
        {{ local.status === 'active' ? 'Can be added to events.' : `Not available for events · ${local.inactive_reason_label}. Reactivate when they're back.` }}
      </p>
      <button
        v-if="local.status !== 'active'"
        type="button"
        class="btn btn-primary btn-sm self-start"
        @click="reactivate"
      >
        Reactivate
      </button>
    </div>
    <UiField
      label="Full name *"
      :error="errors.full_name"
    >
      <input
        v-model="form.full_name"
        type="text"
        class="ctl"
        :class="{ 'ctl-error': errors.full_name }"
        placeholder="[First and last name]"
      >
    </UiField>
    <UiField
      label="Mobile no. *"
      :error="errors.mobile"
      help="11 digits starting with 09. A +63 number is saved as 09…"
    >
      <input
        v-model="form.mobile"
        type="tel"
        inputmode="numeric"
        maxlength="13"
        autocomplete="tel-national"
        placeholder="09XX XXX XXXX"
        class="ctl"
        :class="{ 'ctl-error': errors.mobile }"
      >
    </UiField>
    <UiField
      v-if="isEdit"
      label="Email"
      optional
      :error="errors.email"
    >
      <input
        v-model="form.email"
        type="email"
        class="ctl"
        placeholder="name@gmail.com"
      >
    </UiField>
    <UiField label="Usual role">
      <select
        v-model="form.usual_role"
        class="ctl"
      >
        <option
          v-for="[v, l] in roles"
          :key="v"
          :value="v"
        >
          {{ l }}
        </option>
      </select>
    </UiField>
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Pay schedule *
      </legend>
      <UiSegmented
        v-model="form.pay_schedule"
        name="schedule"
        :options="[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'semi_monthly', label: '15 days' }, { value: 'monthly', label: 'Monthly' }]"
      />
      <span
        v-if="isEdit"
        class="help mt-1.5 block"
      >A change applies from the next cutoff. The current run isn't moved.</span>
    </fieldset>
    <div class="grid grid-cols-2 gap-3">
      <UiField label="Payout method">
        <select
          v-model="form.payout_method"
          class="ctl"
        >
          <option value="gcash">
            GCash
          </option><option value="maya">
            Maya
          </option><option value="cash">
            Cash
          </option><option value="bank_transfer">
            Bank transfer
          </option>
        </select>
      </UiField>
      <UiField
        label="GCash / Maya no."
        :error="errors.wallet_number"
      >
        <input
          v-model="form.wallet_number"
          type="tel"
          maxlength="13"
          class="ctl"
          placeholder="09XX XXX XXXX"
          :disabled="form.payout_method === 'cash'"
        >
      </UiField>
    </div>
    <fieldset class="m-0 grid grid-cols-2 gap-3 rounded-lg bg-[#F2F3F5] p-3.5">
      <legend class="sr-only">
        Emergency contact
      </legend>
      <UiField label="Emergency contact">
        <input
          v-model="form.emergency_name"
          type="text"
          class="ctl"
          placeholder="e.g. Maria · mother"
        >
      </UiField>
      <UiField
        label="Mobile no."
        :error="errors.emergency_mobile"
      >
        <input
          v-model="form.emergency_mobile"
          type="tel"
          maxlength="13"
          class="ctl"
          placeholder="09XX XXX XXXX"
        >
      </UiField>
    </fieldset>

    <div
      v-if="!isEdit"
      class="flex flex-col gap-3 rounded-lg border-2 p-3.5"
      :class="form.has_login ? 'border-[#2F5596]' : 'border-[#DADDE3]'"
    >
      <div class="flex items-center justify-between gap-3">
        <span><b class="text-[15px]">Give a Crew login</b><span class="help block">Lets them scan equipment and see their own pay</span></span>
        <USwitch
          v-model="form.has_login"
          size="xl"
          aria-label="Give a Crew login"
        />
      </div>
      <UiCredentialBox
        v-if="form.has_login"
        v-model="form.pin"
        type="pin"
        help="Signs in with their mobile no. above. Hand them this PIN in person; they'll choose their own at first sign-in. No SMS is sent."
      />
    </div>
    <div
      v-else-if="local"
      class="flex flex-col gap-2.5"
    >
      <h3 class="h-section m-0 text-lg">
        App login
      </h3>
      <template v-if="local.login?.state === 'crew'">
        <p class="m-0 text-[15px]">
          Crew · signs in with <b>{{ phone(local.mobile) }}</b> + 6-digit PIN{{ local.login.note ? ' · ' + local.login.note : '' }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="loginAction('reset')"
          >
            Reset PIN
          </button>
          <button
            type="button"
            class="btn btn-red-text btn-sm"
            @click="loginAction('off')"
          >
            Turn off login
          </button>
        </div>
        <span class="help">Changing the mobile no. above changes the number they sign in with.</span>
      </template>
      <template v-else-if="local.login?.state === 'disabled'">
        <p class="m-0 text-[15px]">
          Login turned off{{ local.status !== 'active' ? ' while Inactive' : '' }}.
        </p>
        <button
          v-if="local.status === 'active'"
          type="button"
          class="btn btn-primary btn-sm self-start"
          @click="loginAction('on')"
        >
          Turn on with new PIN
        </button>
      </template>
      <template v-else>
        <p class="m-0 text-[15px]">
          No login. An admin records their attendance.
        </p>
        <button
          v-if="local.status === 'active'"
          type="button"
          class="btn btn-primary btn-sm self-start"
          @click="loginAction('give')"
        >
          Give a Crew login
        </button>
      </template>
    </div>

    <UiField label="Notes">
      <textarea
        v-model="form.notes"
        rows="2"
        class="ctl"
        placeholder="e.g. has own toolkit, can drive the truck"
      />
    </UiField>

    <template #footer>
      <button
        v-if="isEdit && local?.status === 'active'"
        type="button"
        class="btn btn-red-text mr-auto border-2 border-[#C4141C] font-bold"
        @click="deleteOpen = true"
      >
        Delete
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        {{ isEdit ? 'Discard' : 'Cancel' }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save"
      >
        {{ isEdit ? 'Save changes' : 'Save person' }}
      </button>
    </template>
  </UiSlidePanel>
  <PersonnelDeletePersonModal
    v-if="isEdit"
    v-model:open="deleteOpen"
    :person="person!"
    @deleted="onDeleted"
  />
</template>
