<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'book', title: 'Packages & rates' })
useHead({ title: 'Packages & rates · Blaster Pro Audio' })

const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const card = ref<Row | null>(null)
const dirty = ref(false)
const busy = ref(false)
const adding = ref<Record<number, string>>({})

async function load() {
  card.value = (await api.get<{ data: Row }>('/rate-card')).data
  dirty.value = false
}
onMounted(load)

const editable = computed(() => can('book', 'edit'))
const touch = () => {
  dirty.value = true
}

async function save() {
  busy.value = true
  try {
    card.value = (await api.put<{ data: Row }>('/rate-card', {
      classes: card.value!.classes.map((c: Row) => ({ id: c.id, daily_rate: Number(c.daily_rate) || 0 })),
      services: card.value!.services.map((s: Row) => ({ id: s.id, rate: Number(s.rate) || 0 })),
      packages: card.value!.packages.map((p: Row) => ({ id: p.id, name: p.name, price_per_day: Number(p.price_per_day) || 0, items: p.items.map((i: Row) => ({ equipment_class_id: i.equipment_class_id, count: i.count })) }))
    })).data
    dirty.value = false
    notify('Prices saved. New quotes use them from now on.')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

async function addPackage() {
  try {
    await api.post('/packages', { name: 'New package', price_per_day: 0, items: [] })
    await load()
  } catch (e) {
    fail(e)
  }
}

async function removePackage(p: Row) {
  try {
    await api.del(`/packages/${p.id}`)
    await load()
  } catch (e) {
    fail(e)
  }
}

function addItem(p: Row) {
  const id = Number(adding.value[p.id])
  const cls = card.value!.classes.find((c: Row) => c.id === id)
  if (!cls) {
    return
  }
  const existing = p.items.find((i: Row) => i.equipment_class_id === id)
  if (existing) {
    existing.count++
  } else {
    p.items.push({ equipment_class_id: id, name: cls.name, count: 1 })
  }
  adding.value[p.id] = ''
  touch()
}

function shortToday(p: Row): string[] {
  return p.items.filter((i: Row) => {
    const c = card.value!.classes.find((x: Row) => x.id === i.equipment_class_id)
    return c && c.free_today < i.count
  }).map((i: Row) => i.name)
}
</script>

<template>
  <div class="contents">
    <UiPageHeader
      title="Packages & rates"
      subtitle="Prices used by every new quote. Changing a price never changes quotes already sent."
      :back="{ to: '/bookings', label: 'Bookings' }"
    >
      <template
        v-if="editable"
        #actions
      >
        <span
          v-if="dirty"
          class="badge self-center bg-[#FFF1D6] text-[#6B4100]"
        >Unsaved changes</span>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!dirty || busy"
          @click="save"
        >
          Save prices
        </button>
      </template>
    </UiPageHeader>

    <UiSkeletonPage
      v-if="!card"
      variant="packages"
    />
    <template v-else>
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="font-display m-0 text-[26px] font-extrabold uppercase">
            Packages
          </h2>
          <button
            v-if="editable"
            type="button"
            class="btn btn-outline-blue btn-sm"
            @click="addPackage"
          >
            + Add package
          </button>
        </div>
        <div
          class="grid gap-3"
          style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))"
        >
          <article
            v-for="p in card.packages"
            :key="p.id"
            class="card flex flex-col gap-3 p-4"
            :style="{ borderTop: `6px solid ${p.accent_color}` }"
          >
            <div class="flex items-start justify-between gap-2">
              <input
                v-model="p.name"
                type="text"
                aria-label="Package name"
                class="font-display w-full border-0 bg-transparent p-0 text-[22px] font-extrabold uppercase"
                :disabled="!editable"
                @input="touch"
              >
              <span class="badge flex-none bg-[#ECEEF1] text-[#3B3F47]">{{ plural(p.usage_count, 'booking') }}</span>
            </div>
            <label class="flex items-center gap-2 text-sm">₱
              <input
                v-model="p.price_per_day"
                inputmode="numeric"
                aria-label="Price per day"
                class="ctl ctl-sm"
                style="width: 120px; font-size: 20px; font-weight: 700"
                :disabled="!editable"
                @input="touch"
              > per day
            </label>
            <ul class="m-0 flex list-none flex-col p-0 text-sm">
              <li
                v-for="i in p.items"
                :key="i.equipment_class_id"
                class="flex items-center justify-between gap-2 border-b border-dashed border-[#DADDE3] py-1.5"
              >
                <span>{{ i.name }}</span>
                <span class="flex items-center gap-1">
                  <b>×</b><input
                    v-model.number="i.count"
                    type="number"
                    min="1"
                    class="ctl ctl-sm"
                    style="width: 64px; min-height: 32px"
                    :aria-label="`${i.name} count`"
                    :disabled="!editable"
                    @input="touch"
                  >
                  <button
                    v-if="editable"
                    type="button"
                    aria-label="Remove"
                    class="inline-flex size-8 cursor-pointer items-center justify-center rounded border border-[#DADDE3] bg-white text-[#B4121A]"
                    @click="p.items = p.items.filter((x: Row) => x !== i); touch()"
                  >
                    <UIcon
                      name="i-lucide-x"
                      class="size-3.5"
                    />
                  </button>
                </span>
              </li>
              <li
                v-if="!p.items.length"
                class="py-1.5 text-[#565B66]"
              >
                No contents yet. Add classes from the rate card below.
              </li>
            </ul>
            <div
              v-if="editable"
              class="flex gap-2"
            >
              <select
                v-model="adding[p.id]"
                class="ctl ctl-sm"
                aria-label="Add a class"
              >
                <option value="">
                  Add a class…
                </option>
                <option
                  v-for="c in card.classes"
                  :key="c.id"
                  :value="String(c.id)"
                >
                  {{ c.name }}
                </option>
              </select>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="!adding[p.id]"
                @click="addItem(p)"
              >
                Add
              </button>
            </div>
            <p
              class="m-0 text-[13px] font-semibold"
              :class="shortToday(p).length ? 'text-[#B4121A]' : 'text-[#1D6B3C]'"
            >
              {{ shortToday(p).length ? `Short today: ${shortToday(p).join(', ')} (sub-rent or wait for returns)` : 'Fully available today' }}
            </p>
            <button
              v-if="editable && !p.usage_count"
              type="button"
              class="self-start border-0 bg-transparent p-0 text-sm font-semibold text-[#B4121A] underline"
              @click="removePackage(p)"
            >
              Delete package
            </button>
          </article>
        </div>
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <div>
            <h2 class="font-display m-0 text-[26px] font-extrabold uppercase">
              Rate card by class
            </h2>
            <p class="mt-0.5 mb-0 text-sm text-[#565B66]">
              Individual rental rates. Counts come from serialized inventory, so a class can't be booked past what you own.
            </p>
          </div>
        </div>
        <div class="tbl-wrap">
          <table
            class="tbl"
            style="min-width: 700px"
          >
            <thead>
              <tr>
                <th>Class</th><th>Category</th><th>Owned</th><th>Out today</th><th>Free today</th><th>Daily rate</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in card.classes"
                :key="c.id"
              >
                <td data-cell="title">
                  <b>{{ c.name }}</b>
                </td>
                <td data-label="Category">
                  {{ c.category_label }}
                </td>
                <td data-label="Owned">
                  {{ c.owned }}
                </td>
                <td data-label="Out today">
                  {{ c.out_today }}
                </td>
                <td
                  data-label="Free today"
                  class="font-bold"
                  :class="c.free_today === 0 ? 'text-[#B4121A]' : 'text-[#1D6B3C]'"
                >
                  {{ c.free_today }}
                </td>
                <td data-label="Daily rate">
                  <label class="flex items-center gap-1">₱
                    <input
                      v-model="c.daily_rate"
                      inputmode="numeric"
                      class="ctl ctl-sm"
                      style="width: 100px"
                      :aria-label="`${c.name} daily rate`"
                      :disabled="!editable"
                      @input="touch"
                    ></label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card flex flex-col">
        <div class="card-head">
          <h2 class="h-section m-0">
            Services
          </h2>
        </div>
        <div
          v-for="s in card.services"
          :key="s.id"
          class="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F2] px-5 py-3"
        >
          <span><b>{{ s.name }}</b><span class="block text-[13px] text-[#565B66]">{{ s.note }}</span></span>
          <label class="flex items-center gap-1">₱
            <input
              v-model="s.rate"
              inputmode="numeric"
              class="ctl ctl-sm"
              style="width: 110px"
              :aria-label="`${s.name} rate`"
              :disabled="!editable"
              @input="touch"
            ></label>
        </div>
      </section>
    </template>
  </div>
</template>
