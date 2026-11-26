/** Days after the last event day when the balance (or full amount, with no deposit) is due. */
export const PAYMENT_DUE_OPTIONS = [0, 7, 15, 30, 45, 60, 90]

/** "30 days after the event", "on the last event day". */
export function paymentDueText(days: number | string): string {
  const d = Number(days)
  if (d === 0) {
    return 'on the last event day'
  }
  return d === 1 ? '1 day after the event' : `${d} days after the event`
}

/** Same as paymentDueText, capitalised for option labels. */
export function paymentDueLabel(days: number | string): string {
  const text = paymentDueText(days)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
