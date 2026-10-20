<script setup lang="ts">
// Page-shaped placeholders shown while a page's first request is in flight.
withDefaults(defineProps<{
  variant: 'dashboard' | 'detail' | 'booking' | 'document' | 'packages' | 'payroll' | 'form' | 'mobile'
  media?: 'avatar' | 'square'
  stats?: number
  label?: string
}>(), { media: undefined, stats: 4, label: 'Loading' })
</script>

<template>
  <div
    role="status"
    :aria-label="label"
    class="flex flex-col gap-6"
  >
    <span class="sr-only">{{ label }}…</span>

    <!-- Dashboard: greeting, KPIs, two columns of cards, wide table -->
    <template v-if="variant === 'dashboard'">
      <div
        aria-hidden="true"
        class="flex flex-wrap items-end justify-between gap-4"
      >
        <div class="flex flex-col gap-2.5">
          <span class="skel h-3.5 w-44" />
          <span class="skel h-10 w-72" />
        </div>
        <div class="flex gap-2.5">
          <span class="skel h-11 w-32 rounded-md" />
          <span class="skel h-11 w-32 rounded-md" />
        </div>
      </div>
      <UiSkeletonStats :tones="['dark', 'blue', 'white']" />
      <div class="grid items-start gap-4 lg:grid-cols-2">
        <UiSkeletonCard :lines="5" />
        <UiSkeletonCard :lines="5" />
      </div>
      <UiSkeletonCard
        :rows="4"
        :cols="5"
      />
    </template>

    <!-- Detail: breadcrumb, title block, KPIs, cards, table -->
    <template v-else-if="variant === 'detail'">
      <span
        aria-hidden="true"
        class="skel h-3.5 w-48"
      />
      <div
        aria-hidden="true"
        class="flex flex-wrap items-end justify-between gap-4"
      >
        <div class="flex items-center gap-4">
          <span
            v-if="media"
            class="skel rounded-lg"
            :class="media === 'avatar' ? 'size-[72px]' : 'size-[88px]'"
          />
          <div class="flex flex-col gap-2.5">
            <span class="skel h-10 w-64" />
            <div class="flex gap-2">
              <span class="skel h-6 w-20" />
              <span class="skel h-6 w-28" />
            </div>
            <span class="skel h-3.5 w-56" />
          </div>
        </div>
        <div class="flex gap-2.5">
          <span class="skel h-11 w-24 rounded-md" />
          <span class="skel h-11 w-32 rounded-md" />
        </div>
      </div>
      <UiSkeletonStats
        v-if="stats"
        :tones="Array(stats).fill('white')"
      />
      <div class="grid items-start gap-4 lg:grid-cols-2">
        <UiSkeletonCard :lines="5" />
        <UiSkeletonCard :lines="5" />
      </div>
      <UiSkeletonCard
        :rows="4"
        :cols="5"
      />
    </template>

    <!-- Booking: dark header with stage track, tabs, workspace -->
    <template v-else-if="variant === 'booking'">
      <span
        aria-hidden="true"
        class="skel h-3.5 w-28"
      />
      <div
        aria-hidden="true"
        class="flex flex-col gap-4 rounded-lg bg-[#0B0B0C] px-[22px] py-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-2.5">
            <span class="skel skel-dark h-3.5 w-28" />
            <span class="skel skel-dark h-9 w-72" />
            <span class="skel skel-dark h-3.5 w-56" />
          </div>
          <div class="flex flex-col items-end gap-2.5">
            <span class="skel skel-dark h-3 w-20" />
            <span class="skel skel-dark h-9 w-40" />
          </div>
        </div>
        <div class="grid grid-cols-6 gap-1.5 max-sm:grid-cols-3">
          <span
            v-for="i in 6"
            :key="i"
            class="skel skel-dark h-8 w-full rounded-md"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        class="flex gap-2"
      >
        <span
          v-for="i in 5"
          :key="i"
          class="skel h-10 w-24 rounded-md"
        />
      </div>
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex min-w-0 flex-[999_1_520px] flex-col">
          <UiSkeletonCard
            :rows="6"
            :cols="4"
          />
        </div>
        <div class="flex min-w-0 flex-[1_1_300px] flex-col">
          <UiSkeletonCard :lines="6" />
        </div>
      </div>
    </template>

    <!-- Document: printable sheet (invoice, contract) -->
    <template v-else-if="variant === 'document'">
      <div
        aria-hidden="true"
        class="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg border border-[#DADDE3] bg-white"
      >
        <div class="flex flex-wrap items-start justify-between gap-5 bg-[#0B0B0C] p-7">
          <div class="flex flex-col gap-2.5">
            <span class="skel skel-dark h-9 w-40" />
            <span class="skel skel-dark h-3.5 w-56" />
          </div>
          <div class="flex flex-col items-end gap-2.5">
            <span class="skel skel-dark h-7 w-32" />
            <span class="skel skel-dark h-3.5 w-24" />
          </div>
        </div>
        <div class="grid gap-5 p-7 md:grid-cols-3">
          <div
            v-for="i in 3"
            :key="i"
            class="flex flex-col gap-2"
          >
            <span class="skel h-3 w-20" />
            <span class="skel h-4 w-40" />
            <span class="skel h-3.5 w-32" />
          </div>
        </div>
        <div class="flex flex-col gap-3.5 border-t border-[#E6E8EC] px-7 py-5">
          <div
            v-for="i in 5"
            :key="i"
            class="flex justify-between gap-6"
          >
            <span
              class="skel h-3.5"
              :style="{ width: `${40 + (i * 13) % 35}%` }"
            />
            <span class="skel h-3.5 w-20" />
          </div>
        </div>
        <div class="flex justify-end p-7">
          <div class="flex w-64 flex-col gap-2.5">
            <span class="skel h-3.5 w-full" />
            <span class="skel h-3.5 w-full" />
            <span class="skel h-7 w-full" />
          </div>
        </div>
      </div>
    </template>

    <!-- Packages: package cards, then rate tables -->
    <template v-else-if="variant === 'packages'">
      <div
        aria-hidden="true"
        class="flex items-center justify-between"
      >
        <span class="skel h-7 w-36" />
        <span class="skel h-9 w-32 rounded-md" />
      </div>
      <div
        aria-hidden="true"
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr))"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="card flex flex-col gap-3 p-5"
        >
          <span class="skel h-6 w-40" />
          <span class="skel h-3.5 w-full" />
          <span class="skel h-3.5 w-4/5" />
          <span class="skel mt-2 h-9 w-28" />
        </div>
      </div>
      <UiSkeletonCard
        :rows="6"
        :cols="4"
      />
      <UiSkeletonCard
        :rows="4"
        :cols="3"
      />
    </template>

    <!-- Payroll: schedule picker, KPIs, run table -->
    <template v-else-if="variant === 'payroll'">
      <div
        aria-hidden="true"
        class="card flex flex-wrap items-end gap-4 p-5"
      >
        <div class="flex flex-[2_1_360px] flex-col gap-2">
          <span class="skel h-3.5 w-24" />
          <span class="skel h-11 w-full rounded-md" />
        </div>
        <div class="flex flex-[1_1_220px] flex-col gap-2">
          <span class="skel h-3.5 w-20" />
          <span class="skel h-11 w-full rounded-md" />
        </div>
      </div>
      <UiSkeletonStats :tones="['dark', 'white', 'white', 'white']" />
      <UiSkeletonCard
        :rows="8"
        :cols="7"
      />
    </template>

    <!-- Form: settings-style card of fields -->
    <template v-else-if="variant === 'form'">
      <div
        aria-hidden="true"
        class="card grid gap-4 p-5 md:grid-cols-2"
      >
        <div
          v-for="i in 8"
          :key="i"
          class="flex flex-col gap-2"
        >
          <span class="skel h-3.5 w-28" />
          <span class="skel h-11 w-full rounded-md" />
        </div>
      </div>
      <UiSkeletonCard :lines="3" />
    </template>

    <!-- Mobile: stacked phone cards -->
    <div
      v-else-if="variant === 'mobile'"
      aria-hidden="true"
      class="flex flex-col gap-3 p-4"
    >
      <div class="card flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between">
          <span class="skel h-3 w-16" />
          <span class="skel h-6 w-20" />
        </div>
        <span class="skel h-7 w-3/4" />
        <span class="skel h-3.5 w-1/2" />
        <div class="grid grid-cols-2 gap-2">
          <span class="skel h-[52px] w-full rounded-md" />
          <span class="skel h-[52px] w-full rounded-md" />
        </div>
      </div>
      <div
        v-for="i in 3"
        :key="i"
        class="card flex items-center gap-3 p-4"
      >
        <span class="skel h-[52px] w-12 rounded-md" />
        <div class="flex flex-1 flex-col gap-2">
          <span class="skel h-4 w-3/4" />
          <span class="skel h-3 w-1/2" />
        </div>
      </div>
    </div>
  </div>
</template>
