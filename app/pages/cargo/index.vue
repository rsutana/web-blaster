<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'logistics', title: 'Cargo' })
useHead({ title: 'Cargo · Blaster Pro Audio' })

const api = useApi()
const route = useRoute()
const router = useRouter()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const editable = computed(() => can('logistics', 'edit'))

const trucks = ref<Row[]>([])
const cargo = ref<Row | null>(null)
const loadingList = ref(true)
const loadingCargo = ref(false)
const gearOpen = ref(false)
const gearTarget = ref<{ kind: 'truck' | 'case', id: number, name: string } | null>(null)
const crewOpen = ref(false)
const caseOpen = ref(false)
const tripOpen = ref(false)

const selected = computed(() => {
  const id = Number(route.query.truck)
  return Number.isFinite(id) && id > 0 ? id : null
})
const truck = computed(() => trucks.value.find(t => t.id === selected.value) ?? null)
const tripPreset = computed(() => {
  if (!cargo.value) {
    return null
  }
  const crew = cargo.value.crew as Row[]
  return {
    vehicle_id: cargo.value.vehicle.id as number,
    driver_personnel_id: (crew.find(p => p.role === 'driver' && p.is_active)?.personnel_id ?? null) as number | null,
    helper_ids: crew.filter(p => p.role === 'helper' && p.is_active).map(p => p.personnel_id as number)
  }
})

async function loadTrucks() {
  trucks.value = (await api.get<{ data: Row[] }>('/vehicles')).data
  loadingList.value = false
  if (!selected.value && trucks.value.length && window.matchMedia('(min-width: 901px)').matches) {
    await select(trucks.value.find(t => t.is_active)?.id ?? trucks.value[0]!.id, true)
  }
}

async function loadCargo() {
  if (!selected.value) {
    cargo.value = null
    return
  }
  loadingCargo.value = true
  try {
    cargo.value = (await api.get<{ data: Row }>(`/vehicles/${selected.value}/cargo`)).data
  } catch (e) {
    fail(e)
  } finally {
    loadingCargo.value = false
  }
}

/** The tree changed: show the fresh copy and keep the truck list's counts in step. */
function applyCargo(next: Row) {
  cargo.value = next
  const t = trucks.value.find(x => x.id === next.vehicle.id)
  if (t) {
    Object.assign(t, { items_count: next.items.length, containers_count: next.containers.length, crew_count: next.crew.length })
  }
}

async function refresh() {
  await loadCargo()
  if (cargo.value) {
    applyCargo(cargo.value)
  }
}

function select(id: number, replace = false) {
  return (replace ? router.replace : router.push)({ query: { ...route.query, truck: String(id) } })
}

function openGear(target: { kind: 'truck' | 'case', id: number, name: string }) {
  gearTarget.value = target
  gearOpen.value = true
}

function tripSaved(trip: Row) {
  notify(`Planned ${trip.code}.`)
  refresh()
}

watch(selected, loadCargo)
onMounted(() => Promise.all([loadTrucks(), loadCargo()]).catch(fail))
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader
      title="Cargo"
      subtitle="What each truck carries: loose gear, cases with what's packed inside, and the crew who ride it. Book a truck on a booking to send it all to the event."
    />

    <div class="flex flex-wrap items-start gap-6">
      <div
        class="flex-[1_1_260px] min-[901px]:sticky min-[901px]:top-8 min-[901px]:max-w-[300px]"
        :class="{ 'max-[900px]:hidden': selected }"
      >
        <UiSkeletonCard v-if="loadingList" />
        <CargoTruckList
          v-else
          :trucks="trucks"
          :selected="selected"
          @select="select"
        />
      </div>

      <div
        class="flex min-w-0 flex-[999_1_480px] flex-col gap-4"
        :class="{ 'max-[900px]:hidden': !selected }"
      >
        <button
          v-if="selected"
          type="button"
          class="btn btn-secondary btn-sm self-start min-[901px]:hidden"
          @click="router.push({ query: { ...route.query, truck: undefined } })"
        >
          <UIcon
            name="i-lucide-chevron-left"
            class="size-4"
          />All trucks
        </button>
        <UiSkeletonCard v-if="loadingCargo && !cargo" />
        <CargoTruckTree
          v-else-if="cargo"
          :cargo="cargo"
          :editable="editable"
          :class="{ 'opacity-60': loadingCargo }"
          @update="applyCargo"
          @reload="refresh"
          @add-gear="openGear"
          @add-crew="crewOpen = true"
          @new-case="caseOpen = true"
          @plan-trip="tripOpen = true"
        />
        <section
          v-else-if="!loadingList"
          class="card"
        >
          <UiEmpty text="Pick a truck to see what it carries." />
        </section>
      </div>
    </div>

    <CargoAddGearPanel
      v-model:open="gearOpen"
      :target="gearTarget"
      @changed="refresh"
    />
    <CargoNewCasePanel
      v-model:open="caseOpen"
      :truck="truck"
      @saved="refresh"
    />
    <CargoAddCrewPanel
      v-model:open="crewOpen"
      :truck="truck"
      :on-truck="(cargo?.crew ?? []).map((p: Row) => p.personnel_id)"
      :has-driver="(cargo?.crew ?? []).some((p: Row) => p.role === 'driver')"
      @saved="applyCargo"
    />
    <LogisticsTripPanel
      v-model:open="tripOpen"
      :preset="tripPreset"
      @saved="tripSaved"
    />
  </div>
</template>
