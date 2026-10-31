import { mergeData } from './merge'
import { parseImport } from './store'
import type { AppData } from './types'

// Two devices can save at the same moment. A save only goes through if the cloud row is still the one we read.
// If it changed, we read again, merge the other device's changes in, and retry, so neither edit is lost.

export type Row = { data: unknown; updated_at: string }
export type Remote = {
  read(): Promise<Row | null>
  /** `expected` is the updated_at we read, or null when there was no row. ok false means someone else wrote first. */
  write(data: AppData, expected: string | null): Promise<{ ok: boolean }>
}
export type Outcome = 'saved' | 'busy' | 'cancelled'

/** JSON with keys in a fixed order, so two copies with the same content compare equal. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** The next updated_at: now, but always later than the one we read, so two writers never share a stamp. */
export function nextStamp(expected: string | null, now = Date.now()): string {
  const prev = expected ? Date.parse(expected) : NaN
  return new Date(Number.isNaN(prev) ? now : Math.max(now, prev + 1)).toISOString()
}

export function parseRemote(data: unknown): AppData {
  const d = parseImport(JSON.stringify(data))
  const su = (data as { su?: unknown } | null)?.su
  if (typeof su === 'number') d.su = su
  return d
}

export async function pushMerge(o: {
  remote: Remote
  getLocal: () => AppData
  /** Called when the merge changed what this device holds. */
  apply: (merged: AppData) => void
  /** False once the person has signed out, or a newer run has started. Checked before every write. */
  guard: () => Promise<boolean>
  tries?: number
}): Promise<Outcome> {
  for (let i = 0; i < (o.tries ?? 4); i++) {
    const row = await o.remote.read()
    if (!(await o.guard())) return 'cancelled'
    const local = o.getLocal()
    const remote = row ? parseRemote(row.data) : null
    const merged = remote ? mergeData(local, remote) : local
    if (stable(merged) !== stable(local)) o.apply(merged)
    if (remote && stable(merged) === stable(remote)) return 'saved'
    if (!(await o.guard())) return 'cancelled'
    if ((await o.remote.write(merged, row?.updated_at ?? null)).ok) return 'saved'
  }
  return 'busy'
}
