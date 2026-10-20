<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'inv', title: 'Invoice' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const inv = ref<Row | null>(null)
const payOpen = ref(false)

async function load() {
  inv.value = (await api.get<{ data: Row }>(`/invoices/${route.params.id}`)).data
  useHead({ title: `${inv.value.number} · Blaster Pro Audio` })
}
onMounted(load)

async function send() {
  try {
    inv.value = (await api.post<{ data: Row }>(`/invoices/${inv.value!.id}/dispatches`, {})).data
    notify(`Invoice emailed to ${inv.value!.bill_to.email}.`)
  } catch (e) {
    fail(e)
  }
}

async function onPaid(p: Row) {
  await load()
  notify(`${peso(p.amount, true)} recorded on ${inv.value!.number}.${p.is_booking_confirmed ? ' Booking confirmed.' : ''}`)
}

function print() {
  window.print()
}

const STATUS_BG: Record<string, string> = { paid: '#1D6B3C', part_paid: '#2F5596', unpaid: '#C4141C' }
const snap = computed(() => inv.value?.snapshot ?? {})
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!inv"
      variant="document"
    />
    <template v-else>
      <div class="no-print flex flex-wrap items-center justify-between gap-3">
        <NuxtLink
          :to="`/bookings/${inv.booking.id}?tab=invoices`"
          class="inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <UIcon
            name="i-lucide-chevron-left"
            class="size-3.5"
          />{{ inv.booking.code }} · {{ inv.booking.name }}
        </NuxtLink>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            @click="print"
          >
            Print / PDF
          </button>
          <button
            v-if="can('inv', 'edit')"
            type="button"
            class="btn btn-outline-blue"
            @click="send"
          >
            {{ inv.sent_count > 0 ? 'Send again' : 'Send reminder' }}
          </button>
          <button
            v-if="can('inv', 'edit') && inv.amount_due > 0"
            type="button"
            class="btn btn-primary"
            @click="payOpen = true"
          >
            Record payment
          </button>
        </div>
      </div>

      <article class="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg border border-[#DADDE3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <header class="flex flex-wrap items-start justify-between gap-5 bg-[#0B0B0C] p-7 text-white">
          <div class="flex flex-col gap-2 text-[13px] text-[#C9CCD2]">
            <img
              src="/logo.png"
              alt="Blaster Pro Audio Touring Group"
              class="h-auto w-[220px]"
            >
            <span class="font-semibold text-white">{{ inv.company.name }}</span>
            <span>{{ inv.company.address }}</span>
            <span>TIN {{ inv.company.tin }}{{ inv.company.is_vat_registered ? ' · VAT registered' : '' }}</span>
            <span>{{ inv.company.phone }} · {{ inv.company.billing_email }}</span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="font-display text-[40px] leading-none font-extrabold">INVOICE</span>
            <span class="font-mono text-[15px]">{{ inv.number }}</span>
            <span
              class="badge text-white"
              :style="{ background: STATUS_BG[inv.display_status] }"
            >{{ inv.display_status === 'paid' ? 'Paid' : inv.display_status === 'part_paid' ? 'Part paid' : (inv.is_overdue ? 'Overdue' : 'Unpaid') }}</span>
          </div>
        </header>
        <div class="flex h-1.5">
          <span class="flex-[3] bg-[#2F5596]" /><span class="flex-1 bg-[#ED1B24]" />
        </div>
        <div class="grid gap-5 p-7 text-sm md:grid-cols-3">
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">Bill to</span><b>{{ inv.bill_to.name }}</b><span>Attn: {{ inv.bill_to.attn ?? '—' }}</span><span>{{ inv.bill_to.address }}</span><span v-if="inv.bill_to.tin">TIN {{ inv.bill_to.tin }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">For</span><b>{{ inv.booking.name }} · {{ inv.booking.code }}</b><span>{{ inv.booking.date }}</span><span>{{ inv.booking.venue }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">Dates</span><span>Issued {{ inv.issued_on }}</span><b>Due {{ inv.due_on }}</b><span>Terms: {{ inv.terms }}</span>
          </div>
        </div>
        <div class="overflow-x-auto px-7">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b-2 border-[#0B0B0C] text-left text-xs tracking-[.06em] text-[#565B66] uppercase">
                <th class="py-2.5">
                  Description
                </th><th class="py-2.5 text-right">
                  Qty
                </th><th class="py-2.5 text-right">
                  Rate
                </th><th class="py-2.5 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="l in snap.lines ?? []"
                :key="l.id"
                class="border-b border-[#EEF0F2]"
              >
                <td class="py-2.5">
                  {{ l.description }}
                </td><td class="py-2.5 text-right">
                  {{ l.qty }}
                </td><td class="py-2.5 text-right">
                  {{ peso(l.unit_rate, true) }}
                </td><td class="py-2.5 text-right">
                  {{ peso(l.amount, true) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex justify-end p-7">
          <dl class="m-0 grid w-full max-w-[360px] grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt>Contract subtotal</dt><dd class="m-0 text-right">
              {{ peso(snap.subtotal, true) }}
            </dd>
            <template v-if="snap.discount">
              <dt>Discount {{ num(snap.discount_pct) }}%</dt><dd class="m-0 text-right">
                − {{ peso(snap.discount, true) }}
              </dd>
            </template>
            <template v-if="snap.surcharge_total">
              <dt>Add-ons &amp; surcharges</dt><dd class="m-0 text-right">
                {{ peso(snap.surcharge_total, true) }}
              </dd>
            </template>
            <dt>Net of VAT</dt><dd class="m-0 text-right">
              {{ peso(snap.net, true) }}
            </dd>
            <dt>VAT 12%</dt><dd class="m-0 text-right">
              {{ peso(snap.vat, true) }}
            </dd>
            <dt class="font-bold">
              Contract total
            </dt><dd class="m-0 text-right font-bold">
              {{ peso(snap.total, true) }}
            </dd>
            <dt>This invoice ({{ inv.label }})</dt><dd class="m-0 text-right">
              {{ peso(inv.amount, true) }}
            </dd>
            <template v-if="inv.paid">
              <dt>Payments received</dt><dd class="m-0 text-right text-[#1D6B3C]">
                − {{ peso(inv.paid, true) }}
              </dd>
            </template>
            <div class="col-span-2 mt-2 flex items-baseline justify-between rounded-md bg-[#0B0B0C] px-4 py-3 text-white">
              <span class="eyebrow font-bold">Amount due</span><span class="figure text-[28px]">{{ peso(inv.amount_due, true) }}</span>
            </div>
          </dl>
        </div>
        <div class="mx-7 mb-6 rounded-md bg-[#F2F3F5] p-4 text-sm">
          <div class="eyebrow mb-1.5 text-[#565B66]">
            How to pay
          </div>
          <p class="m-0 whitespace-pre-line">
            {{ inv.company.bank_details }}
          </p>
          <p class="mt-1 mb-0">
            {{ inv.company.gcash_details }}
          </p>
          <p class="mt-2 mb-0">
            Put <b class="font-mono">{{ inv.number }}</b> in the reference. This is a billing invoice. The official receipt is issued once payment clears.
          </p>
        </div>
        <div
          v-if="inv.payments.length"
          class="mx-7 mb-6 flex flex-col gap-1 text-sm"
        >
          <div class="eyebrow mb-1 text-[#565B66]">
            Payments
          </div>
          <div
            v-for="p in inv.payments"
            :key="p.id"
            class="flex justify-between"
          >
            <span>{{ p.received_on }} · {{ p.method_label }} · <span class="font-mono">{{ p.reference ?? '—' }}</span></span><span class="text-[#1D6B3C]">{{ peso(p.amount, true) }}</span>
          </div>
        </div>
        <footer class="flex flex-wrap justify-between gap-2 border-t border-[#DADDE3] px-7 py-4 text-[13px] text-[#565B66]">
          <span>Thank you for booking Blaster Pro Audio.</span><span>{{ inv.sent_label }}</span>
        </footer>
      </article>

      <BookingsRecordPaymentModal
        v-model:open="payOpen"
        :url="`/invoices/${inv.id}/payments`"
        :subtitle="`${inv.number} · due ${inv.due_short}`"
        :default-amount="inv.amount_due"
        :max="inv.amount_due"
        ref-placeholder="e.g. GCash 1029 3384 22"
        @saved="onPaid"
      />
    </template>
  </div>
</template>
