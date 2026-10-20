<script setup lang="ts">
import type { Row } from '~/types/api'

const props = defineProps<{ user: Row, kind: 'reset' | 'disable' | 'enable' }>()
const emit = defineEmits<{ done: [result: Row] }>()
const open = defineModel<boolean>('open', { required: true })
const api = useApi()
const { fail } = useNotify()
const credential = ref('')
const busy = ref(false)

watch(open, (v) => {
  if (v) {
    credential.value = ''
  }
})

const cw = computed(() => props.user.role === 'crew' ? 'PIN' : 'password')
const crew = computed(() => props.user.role === 'crew')
const copy = computed(() => ({
  reset: { tone: 'dark' as const, title: `Reset ${cw.value} for ${props.user.name}?`, body: `Their current ${cw.value} stops working right away.`, points: ['They are signed out on all devices.', `Status shows "Temporary ${cw.value}" until they set their own.`], button: `Set temporary ${cw.value}`, cls: 'btn-primary', cred: true },
  disable: { tone: 'red' as const, title: `Disable ${props.user.name}'s login?`, body: 'They are signed out on their next request and can\'t sign in until re-enabled.', points: [crew.value ? 'Their personnel record, events and pay are not affected.' : 'They lose access to every office page.', 'Their past scans and changes keep their name in history.'], button: 'Disable login', cls: 'btn-danger', cred: false },
  enable: { tone: 'dark' as const, title: `Re-enable ${props.user.name}?`, body: `They get a new temporary ${cw.value} to sign in with.`, points: [`Their old ${cw.value} stays invalid.`, crew.value ? 'If their personnel record is Inactive, reactivate it in Crew too.' : 'They get back what the permission grid allows their role.'], button: `Re-enable with temporary ${cw.value}`, cls: 'btn-primary', cred: true }
}[props.kind]))

async function confirm() {
  busy.value = true
  try {
    const url = `/users/${props.user.id}`
    const res = props.kind === 'reset'
      ? await api.post<{ data: Row }>(`${url}/credential`, { credential: credential.value || null })
      : props.kind === 'disable'
        ? await api.post<{ data: Row }>(`${url}/disablement`)
        : await api.del<{ data: Row }>(`${url}/disablement`, { credential: credential.value || null })
    open.value = false
    emit('done', res.data)
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :tone="copy.tone"
    :title="copy.title"
    :subtitle="copy.body"
  >
    <ul class="m-0 flex flex-col gap-1.5 pl-[18px] text-[15px]">
      <li
        v-for="p in copy.points"
        :key="p"
      >
        {{ p }}
      </li>
    </ul>
    <UiCredentialBox
      v-if="copy.cred && open"
      v-model="credential"
      :type="crew ? 'pin' : 'password'"
    />
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="open = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn"
        :class="copy.cls"
        :disabled="busy"
        @click="confirm"
      >
        {{ copy.button }}
      </button>
    </template>
  </UiDialog>
</template>
