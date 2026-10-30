import { useCallback, useEffect, useRef, useState } from 'react'
import { blankDay, DEFAULT_SETTINGS, type AppData, type Day, type Settings } from './types'

const KEY = 'trck:v1'
const OLD_KEY = 'recomp-log-v1' // the first prototype, same origin only if it was ever hosted here

export function normDay(raw: Partial<Day> | undefined): Day {
  const b = blankDay()
  const d = { ...b, ...(raw ?? {}) } as Day
  d.f = Array.isArray(d.f) ? d.f : []
  d.s = d.s && typeof d.s === 'object' ? d.s : {}
  d.lift = d.lift && typeof d.lift === 'object' ? d.lift : {}
  d.w = Number(d.w) || 0
  d.cig = Number(d.cig) || 0
  d.cardio = Number(d.cardio) || 0
  return d
}

export function normSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.extra = Array.isArray(s.extra) ? s.extra : []
  s.foods = Array.isArray(s.foods) ? s.foods : []
  s.meals = Array.isArray(s.meals) ? s.meals : []
  return s
}

/** Accepts a TRCK export ({days, settings}) or the prototype export ({days, cfg}). */
export function parseImport(text: string): AppData {
  const j = JSON.parse(text) as { days?: Record<string, Partial<Day>>; settings?: Partial<Settings>; cfg?: Partial<Settings> }
  if (!j || typeof j !== 'object' || !j.days || typeof j.days !== 'object') throw new Error('No days found in this file.')
  const days: Record<string, Day> = {}
  for (const [k, v] of Object.entries(j.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = normDay(v)
  return { version: 1, days, settings: normSettings(j.settings ?? j.cfg), su: typeof (j as { su?: number }).su === 'number' ? (j as { su?: number }).su : 0 }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)
    if (raw) return parseImport(raw)
  } catch {
    /* fall through to a clean start */
  }
  return { version: 1, days: {}, settings: normSettings(undefined), su: 0 }
}

export type Store = {
  data: AppData
  mutate: (key: string, fn: (d: Day) => void) => void
  setSettings: (fn: (s: Settings) => void) => void
  replace: (d: AppData) => void
  saveError: boolean
}

export function useStore(): Store {
  const [data, setData] = useState<AppData>(load)
  const [saveError, setSaveError] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [data])

  const mutate = useCallback((key: string, fn: (d: Day) => void) => {
    setData((prev) => {
      const d = structuredClone(prev.days[key] ?? blankDay())
      fn(d)
      d.u = Date.now()
      return { ...prev, days: { ...prev.days, [key]: d } }
    })
  }, [])

  const setSettings = useCallback((fn: (s: Settings) => void) => {
    setData((prev) => {
      const s = structuredClone(prev.settings)
      fn(s)
      return { ...prev, settings: s, su: Date.now() }
    })
  }, [])

  const replace = useCallback((d: AppData) => setData(d), [])

  return { data, mutate, setSettings, replace, saveError }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
