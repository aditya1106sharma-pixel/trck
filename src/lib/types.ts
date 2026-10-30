// Field names match the prototype's exported data, so old logs import without conversion.

export type MuscleId =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core'

export type Part = {
  n: string
  p: number // protein g per unit
  f: number // fat g per unit
  cb: number // carbs g per unit
  k: number // kcal per unit
  q: number // amount in units
  t?: string
  u?: string
}

export type FoodEntry = {
  id: string
  n: string
  p: number
  f?: number // older entries have no fat or carbs
  cb?: number
  k: number
  q: number
  h?: boolean | number // half step quantity (per 100 g items)
  t?: string
  m?: boolean | number // built meal
  c?: boolean | number // tea or coffee
  parts?: Part[]
}

export type SetLog = { w: number | null; r: number | null }

export type Day = {
  f: FoodEntry[]
  s: Record<string, boolean>
  w: number
  cig: number
  cardio: number
  sleep: number | null
  wt: number | null
  waist: number | null
  lift: Record<string, SetLog[]>
  done: boolean
  note: string
  u: number // last edited, ms
}

export type Food = {
  n: string
  p: number
  f: number
  cb: number
  u: string
  t: string
  h?: boolean | number
  k?: number
}

export type Meal = { n: string; parts: Part[] }

export type Exercise = {
  id: string
  n: string
  m: Partial<Record<MuscleId, number>> // 1 main, 0.5 helper
  s: number
  lo: number
  hi: number
  inc: number
  c?: string[]
  x?: boolean // user added
  off?: boolean // removed from routine, history kept
}

export type Settings = {
  protein: number
  kcal: number
  fat: number
  water: number
  cups: number
  cig: number
  hour: number // usual workout finish hour, 24h
  start: string // YYYY-MM-DD
  days: number
  extra: Exercise[]
  foods: Food[]
  meals: Meal[]
}

export type AppData = {
  version: 1
  days: Record<string, Day>
  settings: Settings
  su?: number // settings last changed, ms, used by sync
}

export const DEFAULT_SETTINGS: Settings = {
  protein: 140,
  kcal: 2400,
  fat: 70,
  water: 12,
  cups: 3,
  cig: 6,
  hour: 23,
  start: '2026-10-30',
  days: 60,
  extra: [],
  foods: [],
  meals: [],
}

export function blankDay(): Day {
  return {
    f: [], s: {}, w: 0, cig: 0, cardio: 0, sleep: null, wt: null, waist: null,
    lift: {}, done: false, note: '', u: 0,
  }
}
