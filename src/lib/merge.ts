import { SCHEMA_VERSION, type AppData } from './types'

/** Newest edit wins per day. Settings follow whichever side changed them last. Days are never deleted by a merge. */
export function mergeData(a: AppData, b: AppData): AppData {
  const days = { ...a.days }
  for (const [k, d] of Object.entries(b.days)) {
    const mine = days[k]
    if (!mine || (d.u ?? 0) > (mine.u ?? 0)) days[k] = d
  }
  const settings = (b.su ?? 0) > (a.su ?? 0) ? b.settings : a.settings
  return { version: SCHEMA_VERSION, days, settings, su: Math.max(a.su ?? 0, b.su ?? 0) }
}
