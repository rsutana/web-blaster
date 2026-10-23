<script setup lang="ts">
import type { Row } from '~/types/api'

definePageMeta({ module: 'book', title: 'Quotation' })

const route = useRoute()
const api = useApi()
const { notify, fail } = useNotify()
const { can } = useAuthUser()
const quote = ref<Row | null>(null)
const busy = ref(false)

async function load() {
  quote.value = (await api.get<{ data: Row }>(`/quote-versions/${route.params.id}`)).data
  useHead({ title: `${quote.value.booking.code} quote v${quote.value.version} · Blaster Pro Audio` })
}
onMounted(() => load().catch(fail))

/** The browser's print dialog saves the page as a PDF; print styles hide everything but the document. */
function download() {
  window.print()
}

async function send() {
  busy.value = true
  try {
    await api.post(`/quote-versions/${quote.value!.id}/dispatches`, {})
    await load()
    notify(`Quote v${quote.value!.version} sent to ${quote.value!.client.email ?? 'the client'}.`)
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

const snap = computed(() => quote.value?.snapshot ?? {})
const surcharges = computed(() => (snap.value.surcharges ?? []).filter((s: Row) => s.is_enabled && s.amount))
</script>

<template>
  <div class="contents">
    <UiSkeletonPage
      v-if="!quote"
      variant="document"
    />
    <template v-else>
      <div class="no-print flex flex-wrap items-center justify-between gap-3">
        <NuxtLink
          :to="`/bookings/${quote.booking.id}?tab=quote`"
          class="inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          <UIcon
            name="i-lucide-chevron-left"
            class="size-3.5"
          />{{ quote.booking.code }} · {{ quote.booking.name }}
        </NuxtLink>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary"
            @click="download"
          >
            <UIcon
              name="i-lucide-download"
              class="size-[18px]"
            />Download PDF
          </button>
          <button
            v-if="can('book', 'edit')"
            type="button"
            class="btn btn-secondary"
            :disabled="busy"
            @click="send"
          >
            {{ quote.is_sent ? 'Send again' : 'Send quote' }}
          </button>
        </div>
      </div>
      <p
        v-if="!quote.is_current"
        role="status"
        class="no-print m-0 rounded-md bg-[#FFF1D6] px-4 py-3 text-sm text-[#6B4100]"
      >
        <b>This is v{{ quote.version }}.</b> The quote has changed since. Generate a new version from the booking to include the changes.
      </p>

      <article class="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg border border-[#DADDE3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <header class="flex flex-wrap items-start justify-between gap-5 bg-[#0B0B0C] p-7 text-white">
          <div class="flex flex-col gap-2 text-[13px] text-[#C9CCD2]">
            <img
              src="/logo.png"
              alt="Blaster Pro Audio Touring Group"
              class="h-auto w-[220px]"
            >
            <span class="font-semibold text-white">{{ quote.company.name }}</span>
            <span>{{ quote.company.address }}</span>
            <span>TIN {{ quote.company.tin }}{{ quote.company.is_vat_registered ? ' · VAT registered' : '' }}</span>
            <span>{{ quote.company.phone }} · {{ quote.company.billing_email }}</span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="font-display text-[40px] leading-none font-extrabold">QUOTATION</span>
            <span class="font-mono text-[15px]">{{ quote.booking.code }} · v{{ quote.version }}</span>
          </div>
        </header>
        <div class="flex h-1.5">
          <span class="flex-[3] bg-[#2F5596]" /><span class="flex-1 bg-[#ED1B24]" />
        </div>
        <div class="grid gap-5 p-7 text-sm md:grid-cols-3">
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">Prepared for</span><b>{{ quote.client.name }}</b><span v-if="quote.client.attn">Attn: {{ quote.client.attn }}</span><span v-if="quote.client.address">{{ quote.client.address }}</span><span v-if="quote.client.email">{{ quote.client.email }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">For</span><b>{{ quote.booking.name }}</b><span>{{ quote.booking.date }}</span><span>{{ quote.booking.venue }}</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="eyebrow mb-1 text-[#565B66]">Quote</span><span>Prepared {{ quote.generated_on }}</span><span v-if="quote.generated_by">By {{ quote.generated_by }}</span>
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
                  {{ l.description }}<div
                    v-if="l.note"
                    class="text-[13px] text-[#565B66]"
                  >
                    {{ l.note }}
                  </div>
                </td><td class="py-2.5 text-right">
                  {{ l.qty }}
                </td><td class="py-2.5 text-right">
                  {{ peso(l.unit_rate, true) }}
                </td><td class="py-2.5 text-right">
                  {{ peso(l.amount, true) }}
                </td>
              </tr>
              <tr
                v-for="s in surcharges"
                :key="s.kind"
                class="border-b border-[#EEF0F2]"
              >
                <td class="py-2.5">
                  {{ s.label }}<div
                    v-if="s.note"
                    class="text-[13px] text-[#565B66]"
                  >
                    {{ s.note }}
                  </div>
                </td><td class="py-2.5 text-right">
                  {{ s.quantity ?? '' }}
                </td><td class="py-2.5 text-right" /><td class="py-2.5 text-right">
                  {{ peso(s.amount, true) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex justify-end p-7">
          <dl class="m-0 grid w-full max-w-[360px] grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <dt>Subtotal</dt><dd class="m-0 text-right">
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
            <div class="col-span-2 mt-2 flex items-baseline justify-between rounded-md bg-[#0B0B0C] px-4 py-3 text-white">
              <span class="eyebrow font-bold">Total</span><span class="figure text-[28px]">{{ peso(snap.total, true) }}</span>
            </div>
            <dt class="mt-2">
              {{ num(snap.deposit_pct) }}% deposit to confirm
            </dt><dd class="m-0 mt-2 text-right font-bold">
              {{ peso(snap.deposit, true) }}
            </dd>
            <dt>Balance after deposit</dt><dd class="m-0 text-right">
              {{ peso(snap.balance_after_deposit, true) }}
            </dd>
          </dl>
        </div>
        <footer class="flex flex-wrap justify-between gap-2 border-t border-[#DADDE3] px-7 py-4 text-[13px] text-[#565B66]">
          <span>Prices in PHP. This quotation is not a contract; the booking is confirmed once the contract is signed and the deposit is paid.</span><span class="no-print">{{ quote.sent_label }}</span>
        </footer>
      </article>
    </template>
  </div>
</template>
