// Where each client stands today, worked out from their plans and payments. Pure, so it is easy to test.
import { addDays, daysBetween } from './dates'
import type { Client, JoinRequest, Membership, Payment } from './types'

export type State = 'active' | 'ending' | 'expired' | 'upcoming' | 'none'
export const ENDING_WINDOW = 7 // a plan that ends within this many days shows as Ending
export const RECENT_EXPIRED = 30 // expired plans older than this drop off the Today list

export interface ClientStatus {
  state: State
  current: Membership | null // the plan covering today, if any
  latest: Membership | null // the plan that ends last
  coveredThrough: string | null // last day covered, following back to back renewals
  daysLeft: number | null // 0 means it ends today
  daysSinceEnd: number | null
  due: number // rupees still owed across live plans
  paid: number // rupees paid across live plans
  nextStart: string // where a renewal should start
}

const live = (ms: Membership[]) => ms.filter((m) => m.status !== 'cancelled')
const validPayments = (ps: Payment[]) => ps.filter((p) => !p.voided)

/** Money still owed on one plan. Never below zero. */
export function dueOn(m: Membership, payments: Payment[]): number {
  if (m.status === 'cancelled') return 0
  const paid = validPayments(payments).filter((p) => p.membership_id === m.id).reduce((s, p) => s + p.amount, 0)
  return Math.max(0, m.price - paid)
}

export function clientStatus(memberships: Membership[], payments: Payment[], today: string): ClientStatus {
  const ms = live(memberships)
  const pays = validPayments(payments)
  const paid = pays.filter((p) => p.membership_id && ms.some((m) => m.id === p.membership_id)).reduce((s, p) => s + p.amount, 0)
  const due = ms.reduce((s, m) => s + dueOn(m, pays), 0)
  const latest = ms.reduce<Membership | null>((a, m) => (!a || m.end_date > a.end_date ? m : a), null)
  const current = ms.filter((m) => m.start_date <= today && m.end_date >= today).sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null
  const upcoming = ms.filter((m) => m.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null

  // Follow plans that start on or before the day after the last covered day.
  const chainFrom = (end: string): string => {
    let through = end
    for (;;) {
      const next = ms.find((m) => m.start_date <= addDays(through, 1) && m.end_date > through)
      if (!next) return through
      through = next.end_date
    }
  }

  if (current) {
    const coveredThrough = chainFrom(current.end_date)
    const daysLeft = daysBetween(today, coveredThrough)
    return { state: daysLeft <= ENDING_WINDOW ? 'ending' : 'active', current, latest, coveredThrough, daysLeft, daysSinceEnd: null, due, paid, nextStart: addDays(coveredThrough, 1) }
  }
  if (upcoming) {
    const coveredThrough = chainFrom(upcoming.end_date)
    return { state: 'upcoming', current: null, latest, coveredThrough, daysLeft: daysBetween(today, coveredThrough), daysSinceEnd: null, due, paid, nextStart: addDays(coveredThrough, 1) }
  }
  if (latest) {
    return { state: 'expired', current: null, latest, coveredThrough: latest.end_date, daysLeft: null, daysSinceEnd: daysBetween(latest.end_date, today), due, paid, nextStart: today }
  }
  return { state: 'none', current: null, latest: null, coveredThrough: null, daysLeft: null, daysSinceEnd: null, due, paid, nextStart: today }
}

export const STATE_LABEL: Record<State, string> = { active: 'Active', ending: 'Ending', expired: 'Expired', upcoming: 'Starts soon', none: 'No plan' }

/** "ends today", "ends tomorrow", "ends in 3 days". */
export function endsInWords(daysLeft: number): string {
  if (daysLeft <= 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `in ${daysLeft} days`
}

export interface Row { client: Client; status: ClientStatus }

export function buildRows(clients: Client[], memberships: Membership[], payments: Payment[], today: string): Row[] {
  const mBy = new Map<string, Membership[]>()
  const pBy = new Map<string, Payment[]>()
  for (const m of memberships) mBy.set(m.client_id, [...(mBy.get(m.client_id) ?? []), m])
  for (const p of payments) pBy.set(p.client_id, [...(pBy.get(p.client_id) ?? []), p])
  return clients.map((c) => ({ client: c, status: clientStatus(mBy.get(c.id) ?? [], pBy.get(c.id) ?? [], today) }))
}

export interface TodayLists {
  requests: JoinRequest[]
  ending: Row[]
  expired: Row[]
  dues: Row[]
  counts: { active: number; ending: number; expired: number; requests: number; due: number }
}

/** What the owner should act on today. Archived clients never show. */
export function todayLists(rows: Row[], requests: JoinRequest[]): TodayLists {
  const on = rows.filter((r) => !r.client.archived)
  const ending = on.filter((r) => r.status.state === 'ending').sort((a, b) => (a.status.daysLeft ?? 0) - (b.status.daysLeft ?? 0))
  const expired = on.filter((r) => r.status.state === 'expired' && (r.status.daysSinceEnd ?? 999) <= RECENT_EXPIRED)
    .sort((a, b) => (a.status.daysSinceEnd ?? 0) - (b.status.daysSinceEnd ?? 0))
  const dues = on.filter((r) => r.status.due > 0).sort((a, b) => b.status.due - a.status.due)
  const pending = requests.filter((r) => r.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))
  return {
    requests: pending, ending, expired, dues,
    counts: {
      active: on.filter((r) => r.status.state === 'active' || r.status.state === 'ending').length,
      ending: ending.length, expired: expired.length, requests: pending.length,
      due: dues.reduce((s, r) => s + r.status.due, 0),
    },
  }
}

export type Filter = 'all' | 'active' | 'ending' | 'expired' | 'due' | 'archived'

export function filterRows(rows: Row[], filter: Filter, query: string): Row[] {
  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, '')
  return rows
    .filter((r) => (filter === 'archived' ? r.client.archived : !r.client.archived))
    .filter((r) => {
      if (filter === 'active') return r.status.state === 'active' || r.status.state === 'upcoming'
      if (filter === 'ending') return r.status.state === 'ending'
      if (filter === 'expired') return r.status.state === 'expired' || r.status.state === 'none'
      if (filter === 'due') return r.status.due > 0
      return true
    })
    .filter((r) => !q || r.client.full_name.toLowerCase().includes(q) || (digits.length >= 3 && r.client.phone.includes(digits)) || (r.client.email ?? '').includes(q))
    .sort((a, b) => a.client.full_name.localeCompare(b.client.full_name))
}
