// A day rolls over at 5 am local time, so a 1 am workout belongs to the day before.

export const ROLLOVER_HOURS = 5

const pad = (n: number) => String(n).padStart(2, '0')

export function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(a).getTime() - parseKey(b).getTime()) / 864e5)
}

export function todayKey(now: number = Date.now()): string {
  return keyOf(new Date(now - ROLLOVER_HOURS * 36e5))
}

export function winKeys(end: string, n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i))
  return out
}

export function weekStart(k: string): string {
  const dow = (parseKey(k).getDay() + 6) % 7 // Monday = 0
  return addDays(k, -dow)
}

export function fmt(k: string, o?: Intl.DateTimeFormatOptions): string {
  return parseKey(k).toLocaleDateString('en-IN', o ?? { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Local clock time of `hour:00` on day `k`, in ms. */
export function atHour(k: string, hour: number): number {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0).getTime()
}
