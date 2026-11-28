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
const adding = ref<Record<number, string | null>>({})
/** Case lines the office has collapsed, keyed by package id and line key. Cases start open. */
const openCases = ref<Record<string, boolean>>({})
const isCaseOpen = (p: Row, i: Row): boolean => openCases.value[`${p.id}:${lineKey(i)}`] !== false
function toggleCase(p: Row, i: Row) {
  openCases.value[`${p.id}:${lineKey(i)}`] = !isCaseOpen(p, i)
}

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
      packages: card.value!.packages.map((p: Row) => ({ id: p.id, name: p.name, price_per_day: Number(p.price_per_day) || 0, items: p.items.map((i: Row) => ({ type: i.type ?? 'class', equipment_class_id: i.equipment_class_id ?? null, case_kind_id: i.case_kind_id ?? null, vehicle_type: i.vehicle_type ?? null, count: i.count })) }))
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

/** Key for a package line: its type plus the class, case type or truck type it points at. */
function lineKey(i: Row): string {
  return `${i.type ?? 'class'}:${i.equipment_class_id ?? i.case_kind_id ?? i.vehicle_type}`
}

/** Everything a package can hold, grouped for the searchable picker. */
const addOptions = computed(() => {
  if (!card.value) {
    return []
  }
  const groups = [
    [
      { type: 'label' as const, label: 'Equipment' },
      ...card.value.classes.map((c: Row) => ({ label: c.name, value: `class:${c.id}`, icon: CATEGORY_ICONS[c.category] ?? 'i-lucide-box', description: `${c.category_label} · ${c.free_today} of ${c.owned} free today` }))
    ],
    [
      { type: 'label' as const, label: 'Cases & boxes' },
      ...(card.value.case_kinds ?? []).map((k: Row) => ({ label: k.name, value: `case:${k.id}`, icon: 'i-lucide-package', description: [caseContents(k.contents) ? `${caseContents(k.contents)} each` : 'Nothing packed yet', `${k.free_today} of ${k.owned} free`].join(' · ') }))
    ],
    [
      { type: 'label' as const, label: 'Trucks' },
      ...(card.value.vehicle_types ?? []).map((v: Row) => ({ label: v.label, value: `truck:${v.type}`, icon: 'i-lucide-truck', description: `${v.free_today} of ${v.owned} free today` }))
    ]
  ]
  return groups.filter(g => g.length > 1)
})

/** Icon for a package line: a truck, a case, or the equipment's category. */
function lineIcon(i: Row): string {
  return rateItemIcon(i, card.value)
}

function pick(p: Row, value: string | null) {
  adding.value[p.id] = value
  if (value) {
    addItem(p)
  }
}

function addItem(p: Row) {
  const [type, ref] = String(adding.value[p.id]).split(':')
  let line: Row | null = null
  if (type === 'class') {
    const cls = card.value!.classes.find((c: Row) => String(c.id) === ref)
    line = cls ? { type, equipment_class_id: cls.id, category: cls.category, name: cls.name } : null
  } else if (type === 'case') {
    const kind = card.value!.case_kinds.find((k: Row) => String(k.id) === ref)
    line = kind ? { type, case_kind_id: kind.id, name: kind.name, contents: kind.contents } : null
  } else if (type === 'truck') {
    const vt = card.value!.vehicle_types.find((v: Row) => v.type === ref)
    line = vt ? { type, vehicle_type: vt.type, name: vt.label } : null
  }
  if (!line) {
    return
  }
  const key = lineKey(line)
  const existing = p.items.find((i: Row) => lineKey(i) === key)
  if (existing) {
    existing.count++
  } else {
    p.items.push({ ...line, count: 1 })
  }
  adding.value[p.id] = null
  touch()
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
            <ul
              class="m-0 flex list-none flex-col p-0 text-sm"
              role="tree"
              :aria-label="`${p.name} contents`"
            >
              <li
                v-for="i in p.items"
                :key="lineKey(i)"
                class="border-b border-dashed border-[#DADDE3] py-1.5"
                role="treeitem"
                :aria-expanded="i.type === 'case' ? isCaseOpen(p, i) : undefined"
              >
                <div class="flex items-center justify-between gap-2">
                  <component
                    :is="i.type === 'case' ? 'button' : 'span'"
                    :type="i.type === 'case' ? 'button' : undefined"
                    class="flex min-w-0 items-start gap-2 border-0 bg-transparent p-0 text-left text-sm"
                    :class="i.type === 'case' ? 'cursor-pointer' : ''"
                    @click="i.type === 'case' && toggleCase(p, i)"
                  >
                    <UIcon
                      :name="lineIcon(i)"
                      class="mt-0.5 size-4 flex-none text-[#565B66]"
                    />
                    <span class="flex flex-col">
                      <span class="flex flex-wrap items-center gap-x-2">
                        <span :class="i.type === 'case' ? 'font-semibold' : ''">{{ i.name }}</span>
                        <span
                          v-if="i.type === 'case'"
                          class="text-[13px] text-[#565B66]"
                        >{{ plural((i.contents ?? []).reduce((n: number, c: Row) => n + c.count, 0), 'item') }} each</span>
                      </span>
                      <span
                        v-if="i.type === 'case'"
                        class="flex items-center gap-0.5 text-[12px] text-[#565B66]"
                      >
                        <UIcon
                          :name="isCaseOpen(p, i) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                          class="size-3.5 flex-none"
                        />
                        {{ caseContents(i.contents) ? `Each holds ${caseContents(i.contents)}` : 'No cases of this type packed yet' }}
                      </span>
                    </span>
                  </component>
                  <span class="flex flex-none items-center gap-1">
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
                </div>
                <ul
                  v-if="i.type === 'case' && isCaseOpen(p, i)"
                  role="group"
                  class="m-0 mt-1 ml-[30px] flex list-none flex-col border-l-2 border-dashed border-[#DADDE3] p-0 pl-4"
                >
                  <li
                    v-for="c in i.contents ?? []"
                    :key="c.equipment_class_id"
                    role="treeitem"
                    class="flex items-center justify-between gap-3 py-1 text-sm"
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      <UIcon
                        :name="lineIcon({ equipment_class_id: c.equipment_class_id })"
                        class="size-4 flex-none text-[#565B66]"
                      />
                      <span>{{ c.name }}</span>
                      <span class="text-[13px] text-[#565B66]">×{{ c.count }} each</span>
                    </span>
                    <span
                      v-if="i.count > 1"
                      class="flex-none text-[13px] font-semibold text-[#3B3F47]"
                    >{{ c.count * i.count }} total</span>
                  </li>
                  <li
                    v-if="!(i.contents ?? []).length"
                    class="py-1 text-sm text-[#565B66]"
                  >
                    No cases of this type are packed yet.
                  </li>
                </ul>
              </li>
              <li
                v-if="!p.items.length"
                class="py-1.5 text-[#565B66]"
              >
                No contents yet. Add equipment, cases or trucks below.
              </li>
            </ul>
            <USelectMenu
              v-if="editable"
              :model-value="adding[p.id] ?? null"
              :items="addOptions"
              value-key="value"
              :filter-fields="['label', 'description']"
              :search-input="{ placeholder: 'Search equipment, cases, trucks…', icon: 'i-lucide-search' }"
              icon="i-lucide-plus"
              placeholder="Add equipment, case or truck"
              size="lg"
              class="w-full"
              :content="{ align: 'start' }"
              :ui="{ content: 'min-w-72', itemDescription: 'text-xs' }"
              aria-label="Add to package"
              @update:model-value="(v: string | null) => pick(p, v)"
            >
              <template #empty>
                Nothing matches. Add gear in Equipment or a case in Logistics.
              </template>
            </USelectMenu>
            <p
              class="m-0 text-[13px] font-semibold"
              :class="dirty ? 'text-[#565B66]' : p.short_today?.length ? 'text-[#B4121A]' : 'text-[#1D6B3C]'"
            >
              {{ dirty ? 'Save prices to recheck what is free today' : p.short_today?.length ? `Short today: ${p.short_today.join(', ')} (sub-rent or wait for returns)` : 'Fully available today' }}
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
              Individual rental rates. Classes come from your equipment list. Add gear in Equipment to see it here.
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
                  <NuxtLink
                    :to="{ path: '/equipment', query: { q: c.name } }"
                    class="font-bold text-inherit hover:underline"
                  >
                    {{ c.name }}
                  </NuxtLink>
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
