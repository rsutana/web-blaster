<script setup lang="ts">
import type { Row } from '~/types/api'

/** The client's delivery and end-of-event sign-offs, as collected on the crew's phones. Read-only. */
defineProps<{ signOffs: Row[] }>()
</script>

<template>
  <section
    aria-labelledby="sign-h"
    class="card flex flex-col"
  >
    <div class="card-head">
      <div>
        <h2
          id="sign-h"
          class="h-section m-0"
        >
          Client sign-off <span class="text-[#565B66]">({{ signOffs.filter(s => s.state === 'signed').length }}/{{ signOffs.length }})</span>
        </h2>
        <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
          The client signs on the crew's phone from Scan equipment.
        </p>
      </div>
    </div>

    <div
      v-for="s in signOffs"
      :key="s.kind"
      class="flex flex-col gap-3 border-b border-[#EEF0F2] px-5 py-4 last:border-0"
    >
      <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span class="flex items-center gap-2.5">
          <span
            class="flex size-9 flex-none items-center justify-center rounded-md"
            :class="s.state === 'signed' ? 'bg-[#E2F2E8] text-[#1D6B3C]' : s.state === 'ready' ? 'bg-[#FFF1D6] text-[#6B4100]' : 'bg-[#ECEEF1] text-[#565B66]'"
          >
            <UIcon
              :name="s.state === 'signed' ? 'i-lucide-badge-check' : s.state === 'ready' ? 'i-lucide-pen-line' : 'i-lucide-lock'"
              class="size-5"
            />
          </span>
          <b class="text-[15px]">{{ s.label }}</b>
        </span>
        <UiBadge
          :tone="s.state === 'signed' ? TONES.green : s.state === 'ready' ? TONES.amber : TONES.grey"
          :label="s.state === 'signed' ? `Signed · ${s.sign_off.signed_at}` : s.state === 'ready' ? 'Waiting for the client' : 'Not signed yet'"
        />
      </div>

      <template v-if="s.state === 'signed'">
        <div class="flex flex-wrap items-end gap-x-5 gap-y-3 sm:pl-[46px]">
          <figure class="m-0 flex flex-col gap-1">
            <img
              :src="s.sign_off.signature_url"
              :alt="`Signature of ${s.sign_off.signer_name}`"
              class="h-20 w-60 max-w-full rounded-md border border-[#DADDE3] bg-white object-contain"
            >
            <figcaption class="text-sm font-semibold">
              {{ s.sign_off.signer_name }}
            </figcaption>
          </figure>
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-[#565B66]">
              Collected by
            </dt>
            <dd class="m-0">
              {{ s.sign_off.collected_by ?? 'Crew' }}
            </dd>
            <dt class="text-[#565B66]">
              Location
            </dt>
            <dd class="m-0 flex items-center gap-1">
              <UIcon
                :name="s.sign_off.has_gps ? 'i-lucide-map-pin-check' : 'i-lucide-map-pin-off'"
                class="size-4"
                :class="s.sign_off.has_gps ? 'text-[#1D6B3C]' : 'text-[#8A8F99]'"
              />{{ s.sign_off.has_gps ? 'GPS recorded' : 'No GPS' }}
            </dd>
          </dl>
        </div>
        <p
          v-if="s.sign_off.note"
          class="m-0 flex items-start gap-2 rounded-md bg-[#FFF1D6] px-3 py-2.5 text-sm text-[#6B4100] sm:ml-[46px]"
        >
          <UIcon
            name="i-lucide-message-square-warning"
            class="mt-0.5 size-4 flex-none"
          />
          <span><b>Client noted:</b> {{ s.sign_off.note }}</span>
        </p>
      </template>
      <p
        v-else
        class="m-0 text-sm text-[#565B66] sm:pl-[46px]"
      >
        {{ s.state === 'ready' ? `Ready to sign for ${plural(s.item_count, 'item')}. Ask the crew to collect it from Scan equipment.` : s.locked_reason }}
      </p>

      <details
        v-if="s.items.length"
        class="group sm:ml-[46px]"
      >
        <summary class="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-[#2F5596] [&::-webkit-details-marker]:hidden">
          {{ s.state === 'signed' ? `${plural(s.item_count, 'item')} signed for` : `${plural(s.item_count, 'item')} to cover` }}
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <ul class="m-0 mt-1 ml-2 flex max-h-[260px] list-none flex-col overflow-y-auto border-l-2 border-dashed border-[#DADDE3] p-0 pl-5">
          <li
            v-for="i in s.items"
            :key="i.code"
            class="flex flex-wrap items-center gap-x-2 py-1 text-sm"
          >
            <NuxtLink
              :to="`/equipment/${i.code}`"
              class="font-mono"
            >{{ i.code }}</NuxtLink>
            <span>{{ i.name }}</span>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>
