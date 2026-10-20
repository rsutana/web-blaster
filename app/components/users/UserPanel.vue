<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ user?: Row | null }>()
const emit = defineEmits<{ saved: [result: Row, isNew: boolean, previousRole?: string] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()

const ROLES = [
  { value: 'crew', title: 'Crew', desc: 'Mobile + PIN. Time in/out, scan gear out and back.' },
  { value: 'manager', title: 'Manager', desc: 'Email + password. Bookings, schedule, crew, tasks, dispatch.' },
  { value: 'admin', title: 'Admin', desc: 'Email + password. Everything the Owner allows.' }
]
const form = reactive({ role: 'crew', personnel_id: '' as number | string, name: '', email: '', mobile: '', credential: '', is_works_events: false })
const linkable = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const isEdit = computed(() => !!props.user)

watch(open, async (v) => {
  if (!v) {
    return
  }
  errors.value = {}
  if (props.user) {
    const u = props.user
    Object.assign(form, { role: u.role, personnel_id: u.personnel_id ?? '', name: u.name, email: u.email ?? '', mobile: u.mobile ?? '', credential: '', is_works_events: false })
  } else {
    Object.assign(form, { role: 'crew', personnel_id: '', name: '', email: '', mobile: '', credential: '', is_works_events: false })
  }
  linkable.value = (await api.get<{ data: Row[] }>('/linkable-personnel')).data
})

watch(() => form.personnel_id, (id) => {
  const p = linkable.value.find(x => x.id === Number(id))
  if (p && form.role === 'crew') {
    form.mobile = p.mobile ?? ''
  }
})
watch(() => form.role, () => {
  form.credential = ''
})

const isCrew = computed(() => form.role === 'crew')
const roleChangeNote = computed(() => {
  if (!isEdit.value || form.role === props.user!.role) {
    return ''
  }
  if (form.role === 'crew') {
    return 'Switching to Crew needs a linked personnel record and a new 6-digit PIN. Their password stops working.'
  }
  if (props.user!.role === 'crew') {
    return `Moving to ${form.role === 'admin' ? 'Admin' : 'Manager'} means email + password sign-in. They get a temporary password and their PIN stops working.`
  }
  return `Access changes right away to what the permission grid allows for ${form.role === 'admin' ? 'Admins' : 'Managers'}.`
})

async function save() {
  busy.value = true
  errors.value = {}
  const body: Row = { role: form.role }
  if (isCrew.value) {
    body.personnel_id = form.personnel_id || null
    body.mobile = form.mobile
  } else {
    body.name = form.name
    body.email = form.email || null
    body.mobile = form.mobile || null
  }
  try {
    if (isEdit.value) {
      const res = await api.patch<{ data: Row }>(`/users/${props.user!.id}`, body)
      open.value = false
      emit('saved', res.data, false, props.user!.role)
    } else {
      body.credential = form.credential || null
      body.is_works_events = form.is_works_events
      const res = await api.post<{ data: Row }>('/users', body)
      open.value = false
      emit('saved', res.data, true)
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
</script>

<template>
  <UiSlidePanel
    v-model:open="open"
    :title="isEdit ? 'Edit user' : 'Add user'"
    :subtitle="isEdit ? `${user!.name} · last active ${user!.last_active}` : 'Creates a sign-in. Nothing is sent by SMS or email.'"
  >
    <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
      <legend class="mb-1.5 text-sm font-semibold">
        Role *
      </legend>
      <div class="grid grid-cols-3 gap-2">
        <label
          v-for="r in ROLES"
          :key="r.value"
          class="flex min-h-[120px] cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-3"
          :class="form.role === r.value ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-[#DADDE3] bg-white'"
        >
          <input
            v-model="form.role"
            type="radio"
            name="role"
            :value="r.value"
            class="sr-only"
          >
          <span class="font-display text-[22px] font-extrabold uppercase">{{ r.title }}</span>
          <span
            class="text-[13px]"
            :class="form.role === r.value ? 'text-[#C9CCD2]' : 'text-[#565B66]'"
          >{{ r.desc }}</span>
        </label>
      </div>
      <span class="help">What each role can open is set in the permission grid on Users &amp; roles. Only the Owner can change it.</span>
    </fieldset>
    <div
      v-if="roleChangeNote"
      class="rounded-md bg-[#FFF1D6] p-3 text-sm text-[#6B4100]"
    >
      {{ roleChangeNote }}
    </div>

    <template v-if="isCrew">
      <UiField
        v-if="!isEdit || form.role !== user!.role || !user!.personnel_id"
        label="Link to personnel record *"
        :error="errors.personnel_id"
      >
        <select
          v-model="form.personnel_id"
          class="ctl"
        >
          <option value="">
            Choose a person…
          </option>
          <option
            v-for="p in linkable"
            :key="p.id"
            :value="p.id"
          >
            {{ p.full_name }} · {{ p.usual_role_label }} (no login yet)
          </option>
        </select>
        <span class="help">Only people without a login are listed. Not there? <NuxtLink to="/personnel">Add them in Personnel first.</NuxtLink></span>
      </UiField>
      <UiField
        v-else
        label="Linked personnel record"
        help="Name and details are edited in Personnel. A login stays tied to one person."
      >
        <output class="ctl flex items-center bg-[#F2F3F5]">{{ user!.personnel?.name }}</output>
      </UiField>
      <UiField
        label="Mobile no. (their sign-in) *"
        :help="isEdit ? 'Changing it changes the number they sign in with. Their PIN stays the same.' : 'Filled in from their personnel record.'"
        :error="errors.mobile"
      >
        <input
          v-model="form.mobile"
          type="tel"
          inputmode="numeric"
          maxlength="13"
          class="ctl"
          placeholder="09XX XXX XXXX"
        >
      </UiField>
      <UiCredentialBox
        v-if="!isEdit"
        v-model="form.credential"
        type="pin"
        help="Hand it over in person. They'll pick their own PIN at first sign-in."
      />
    </template>
    <template v-else>
      <UiField
        label="Full name *"
        :error="errors.name"
      >
        <input
          v-model="form.name"
          type="text"
          class="ctl"
        >
      </UiField>
      <div class="grid grid-cols-2 gap-3">
        <UiField
          label="Email"
          :error="errors.email"
        >
          <input
            v-model="form.email"
            type="email"
            class="ctl"
            placeholder="name@blasterproaudio.ph"
          >
        </UiField>
        <UiField
          label="Mobile no."
          :error="errors.mobile"
        >
          <input
            v-model="form.mobile"
            type="tel"
            maxlength="13"
            class="ctl"
            placeholder="09XX XXX XXXX"
          >
        </UiField>
      </div>
      <span class="help -mt-2">At least one of these; either can be used to sign in.</span>
      <template v-if="!isEdit">
        <UiCredentialBox
          v-model="form.credential"
          type="password"
          help="They must change it at first sign-in."
        />
        <label class="flex items-start gap-2.5 text-[15px] font-semibold">
          <input
            v-model="form.is_works_events"
            type="checkbox"
            class="mt-0.5 size-5 accent-[#2F5596]"
          >
          <span>Also works events<span class="help block">Links a personnel record so they can be assigned and paid.</span></span>
        </label>
      </template>
    </template>
    <div
      v-if="isEdit"
      class="flex flex-col gap-1.5 rounded-lg bg-[#F2F3F5] p-3.5 text-sm"
    >
      <span class="flex items-center gap-2 font-semibold">Status <UiBadge
        :tone="user!.status === 'active' ? TONES.green : user!.status === 'disabled' ? TONES.grey : user!.status === 'locked' ? TONES.live : TONES.amber"
        :label="user!.status_label"
      /></span>
      <span class="text-[#565B66]">Reset {{ user!.credential_word }}, Unlock and Disable are on the user's row in the list.</span>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        {{ isEdit ? 'Discard changes' : 'Cancel' }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy"
        @click="save"
      >
        {{ isEdit ? 'Save changes' : 'Create user' }}
      </button>
    </template>
  </UiSlidePanel>
</template>
