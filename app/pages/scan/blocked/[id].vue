<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ layout: 'crew', module: 'track', level: 'own', title: 'Scan blocked' })
useHead({ title: 'Scan blocked · Blaster Pro Audio' })

const route = useRoute()
const api = useApi()
const { fail } = useNotify()
const { isAdminish } = useAuthUser()
const block = ref<Row | null>(null)
const moved = ref(false)

async function load() {
  block.value = (await api.get<{ data: Row }>(`/scan-blocks/${route.params.id}`)).data
}
onMounted(load)

async function act(action: 'notify' | 'transfer') {
  try {
    block.value = (await api.patch<{ data: Row }>(`/scan-blocks/${block.value!.id}`, { action })).data
    if (action === 'transfer') {
      moved.value = true
    }
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <div class="contents">
    <header class="flex items-center gap-3 bg-[#0B0B0C] px-5 py-4 text-white">
      <NuxtLink
        :to="block ? `/scan?event=${block.event.id}` : '/scan'"
        aria-label="Back to the scanner"
        class="inline-flex size-11 items-center justify-center rounded-md border border-[#3B3F47] text-white hover:text-white"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-5"
        />
      </NuxtLink>
      <div>
        <h1 class="font-display m-0 text-2xl leading-none font-extrabold uppercase">
          Scan equipment
        </h1>
        <div class="text-sm text-[#C9CCD2]">
          Adding to {{ block?.event.name }}
        </div>
      </div>
    </header>
    <UiSkeletonPage
      v-if="!block"
      variant="mobile"
    />
    <main
      v-else
      class="flex flex-col gap-3 p-4"
    >
      <div class="flex h-[110px] items-center justify-center rounded-lg bg-[#16171A] text-sm text-[#9EA3AD]">
        Scanner paused
      </div>
      <section class="overflow-hidden rounded-lg border-2 border-[#C4141C] bg-white">
        <div class="bg-[#C4141C] px-4 py-3 text-white">
          <div class="font-display text-xl font-extrabold uppercase">
            Can't add this item
          </div>
          <div class="text-sm text-[#FFE3E4]">
            It's still active on another event.
          </div>
        </div>
        <dl class="m-0 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 p-4 text-[15px]">
          <dt class="text-[#565B66]">
            Item
          </dt><dd class="m-0">
            <span class="font-mono">{{ block.code }}</span> · {{ block.item_name }}
          </dd>
          <dt class="text-[#565B66]">
            Status
          </dt><dd class="m-0">
            <UiBadge
              :tone="EQUIPMENT_STATUS[block.item_status]!.tone"
              :label="block.item_status_label"
            />
          </dd>
          <template v-if="block.blocking_event">
            <dt class="text-[#565B66]">
              On event
            </dt><dd class="m-0 font-semibold">
              {{ block.blocking_event.label }}
            </dd>
            <dt class="text-[#565B66]">
              Event dates
            </dt><dd class="m-0">
              {{ block.blocking_event.dates }} <b
                v-if="block.blocking_event.is_ended"
                class="text-[#B4121A]"
              >(ended)</b>
            </dd>
          </template>
          <template v-else>
            <dt class="text-[#565B66]">
              Reason
            </dt><dd class="m-0">
              {{ block.reason }}
            </dd>
          </template>
          <template v-if="block.added_by">
            <dt class="text-[#565B66]">
              Added by
            </dt><dd class="m-0">
              {{ block.added_by }}
            </dd>
          </template>
        </dl>
        <p class="m-0 px-4 pb-4 text-[15px]">
          {{ block.blocking_event ? `It was never scanned back. Remove it from ${block.blocking_event.label.split(' · ')[0]} first (reason: Not needed), or ask an admin to transfer it.` : 'It can\'t go on an event until its status is cleared.' }}
        </p>
        <div class="grid grid-cols-2 gap-2 px-4 pb-4">
          <button
            type="button"
            class="btn btn-phone"
            :class="block.is_admin_notified ? 'btn-dark' : 'btn-secondary'"
            :disabled="block.is_admin_notified"
            @click="act('notify')"
          >
            {{ block.is_admin_notified ? 'Admin notified' : 'Notify admin' }}
          </button>
          <NuxtLink
            :to="`/scan?event=${block.event.id}`"
            class="btn btn-primary btn-phone"
          >Scan next item</NuxtLink>
        </div>
      </section>
      <section
        v-if="isAdminish && block.blocking_event"
        class="flex flex-col gap-2.5 rounded-lg bg-[#0B0B0C] p-4 text-white"
      >
        <div class="eyebrow font-bold text-[#C9CCD2]">
          Admins see one more option
        </div>
        <button
          type="button"
          class="btn btn-phone bg-white font-bold text-[#0B0B0C]"
          :disabled="moved || block.is_resolved"
          @click="act('transfer')"
        >
          {{ moved || block.is_resolved ? `Moved to ${block.event.name}` : `Remove from ${block.blocking_event.label.split(' · ')[0]} & add here` }}
        </button>
        <span class="text-[13px] text-[#C9CCD2]">Both moves are logged in the item's history.</span>
      </section>
      <p class="m-0 text-[13px] text-[#565B66]">
        Other blocked cases: item is Under repair, Retired or Lost.
      </p>
    </main>
  </div>
</template>
