// Numbers for the owner's Money and Insights screens. Rough business numbers, worked out in the browser.
import { addMonths, monthKey } from './dates'
import type { Payment } from './types'

/** Money collected per month, newest last, for the last `months` months including this one. Voided payments do not count. */
export function revenueByMonth(payments: Payment[], today: string, months = 6): { month: string; total: number; count: number }[] {
  const keys = Array.from({ length: months }, (_, i) => monthKey(addMonths(today.slice(0, 7) + '-01', i - months + 1)))
  const out = keys.map((month) => ({ month, total: 0, count: 0 }))
  for (const p of payments) {
    if (p.voided) continue
    const slot = out.find((o) => o.month === monthKey(p.paid_on))
    if (slot) { slot.total += p.amount; slot.count += 1 }
  }
  return out
}

/** Share as a whole percent, or null when there is nothing to divide by. */
export const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null)

export interface Funnel { viewed: number; submitted: number; approved: number }

export function funnelFrom(counts: Record<string, number>, visitors: number): Funnel {
  return { viewed: visitors || counts.join_viewed || 0, submitted: counts.join_submitted ?? 0, approved: counts.request_approved ?? 0 }
}
