import type { AppData, Settings } from './types'

// A rough guide for building muscle while losing fat. Not medical advice.
export const PROTEIN_PER_KG = 1.8
export const WEIGHT_MIN = 30
export const WEIGHT_MAX = 250

export const validWeight = (kg: number) => kg >= WEIGHT_MIN && kg <= WEIGHT_MAX

/** Protein target for a body weight, to the nearest 5 g. */
export function proteinFor(kg: number): number {
  return Math.min(300, Math.max(60, Math.round((kg * PROTEIN_PER_KG) / 5) * 5))
}

/** A new person sees the first run screen. Anyone with logged days, changed settings, or a finished setup never does. */
export function needsSetup(d: AppData): boolean {
  return !d.settings.ready && !d.su && Object.keys(d.days).length === 0
}

/**
 * Whether to show the first run screen now. A signed-in person waits until their log has loaded
 * from the cloud, so a second phone does not ask again or overwrite their settings.
 */
export function showSetup(d: AppData, o: { locked: boolean; loading: boolean; email: string | null; state: string }): boolean {
  if (!needsSetup(d) || o.locked || o.loading) return false
  return !o.email || o.state === 'ok'
}

export function applySetup(s: Settings, o: { protein: number; start: string }): void {
  s.protein = o.protein
  s.start = o.start
  s.ready = true
}
