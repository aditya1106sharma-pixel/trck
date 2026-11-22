// Calendar dates as 'YYYY-MM-DD' strings in the gym's time zone. No times, so no off by one hour bugs.

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'))

/** Today's date at the gym. The gym, not the phone, decides what today is. */
export function todayIn(timeZone = 'Asia/Kolkata', now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const toUTC = (d: string) => new Date(d + 'T00:00:00Z')
const fromUTC = (t: Date) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`

export function addDays(d: string, n: number): string {
  const t = toUTC(d)
  t.setUTCDate(t.getUTCDate() + n)
  return fromUTC(t)
}

/** Adds months the way Postgres does: 31 Jan plus one month is 28 Feb (or 29 in a leap year). */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(day, last))}`
}

/** The last day a plan covers. Mirrors membership_end() in supabase/gym/schema.sql, and both are tested. */
export const membershipEnd = (start: string, months: number, days: number): string => addDays(addMonths(start, months), days - 1)

/** Whole days from a to b. Positive when b is later. */
export const daysBetween = (a: string, b: string): number => Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000)

/** 2026-02-27 reads as 27 Feb 2026. With short, 27 Feb. */
export function fmtDate(d: string | null | undefined, short = false): string {
  if (!d || !isDate(d.slice(0, 10))) return ''
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return short ? `${day} ${MONTHS[m - 1]}` : `${day} ${MONTHS[m - 1]} ${y}`
}

/** How long a plan runs, in words: "1 month", "3 months", "7 days", "1 month and 15 days". */
export function planLength(months: number, days: number): string {
  const p: string[] = []
  if (months) p.push(`${months} month${months === 1 ? '' : 's'}`)
  if (days) p.push(`${days} day${days === 1 ? '' : 's'}`)
  return p.join(' and ')
}

/** Age in whole years on a date, or null without a birth date. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  if (!dob || !isDate(dob)) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

/** 'YYYY-MM' of a date, for grouping money by month. */
export const monthKey = (d: string): string => d.slice(0, 7)

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
