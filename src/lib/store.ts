import { useCallback, useEffect, useRef, useState } from 'react'
import { blankDay, DEFAULT_SETTINGS, SCHEMA_VERSION, type AppData, type Day, type Settings } from './types'

const KEY = 'trck:v1'
const OLD_KEY = 'recomp-log-v1' // the first prototype, same origin only if it was ever hosted here
const BACKUP_KEY = 'trck:backups'
export const MAX_BACKUPS = 5

type Raw = Record<string, unknown>
export type Migration = (raw: Raw) => Raw
/** MIGRATIONS[n] turns stored version n into n + 1. Never rename a field: add the new one and keep the old. */
export const MIGRATIONS: Record<number, Migration> = {}

/** Brings stored data up to `target`. Data with no version is the prototype export, which is version 1. */
export function migrate(raw: Raw, migrations: Record<number, Migration> = MIGRATIONS, target = SCHEMA_VERSION): Raw {
  let v = typeof raw.version === 'number' ? raw.version : 1
  if (v > target) throw new Error('This data is from a newer version of TRCK. Reload the app to update, then try again.')
  let cur = raw
  while (v < target) {
    const step = migrations[v]
    if (!step) throw new Error(`Cannot upgrade this data from version ${v}.`)
    cur = { ...step(cur), version: v + 1 }
    v += 1
  }
  return cur
}

export type Backup = { at: number; reason: string; json: string }
type Mem = Pick<Storage, 'getItem' | 'setItem'>

export function addBackup(list: Backup[], b: Backup, max = MAX_BACKUPS): Backup[] {
  return [...list, b].slice(-max)
}

export function readBackups(mem: Mem = localStorage): Backup[] {
  try {
    const raw = JSON.parse(mem.getItem(BACKUP_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((b): b is Backup => !!b && typeof b.json === 'string' && typeof b.at === 'number') : []
  } catch {
    return []
  }
}

/**
 * Keeps the last 5 snapshots. If storage is nearly full it keeps fewer, down to just this one, which drops the oldest first.
 * Returns false when not even this one fits, so a caller about to clear data can stop.
 */
export function saveBackup(json: string, reason: string, mem: Mem = localStorage, now = Date.now()): boolean {
  const list = readBackups(mem)
  if (list[list.length - 1]?.json === json) return true
  const next = addBackup(list, { at: now, reason, json })
  for (const keep of [MAX_BACKUPS, 2, 1]) {
    try { mem.setItem(BACKUP_KEY, JSON.stringify(next.slice(-keep))); return true } catch { /* try fewer */ }
  }
  return false
}

export function normDay(raw: Partial<Day> | undefined): Day {
  const b = blankDay()
  const d = { ...b, ...(raw ?? {}) } as Day
  d.f = Array.isArray(d.f) ? d.f : []
  d.s = d.s && typeof d.s === 'object' ? d.s : {}
  d.lift = d.lift && typeof d.lift === 'object' ? d.lift : {}
  d.w = Number(d.w) || 0
  d.cig = Number(d.cig) || 0
  d.cardio = Number(d.cardio) || 0
  if (d.plan !== undefined && !(Array.isArray(d.plan) && d.plan.every((x) => typeof x === 'string'))) delete d.plan
  if (Array.isArray(d.f)) for (const x of d.f) if (x && x.conf !== undefined && !(typeof x.conf === 'number' && x.conf >= 0 && x.conf <= 1)) delete x.conf
  return d
}

export function normSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.extra = Array.isArray(s.extra) ? s.extra : []
  s.foods = Array.isArray(s.foods) ? s.foods : []
  s.meals = Array.isArray(s.meals) ? s.meals : []
  if (s.noEq !== undefined && !Array.isArray(s.noEq)) delete s.noEq
  return s
}

/** Accepts a TRCK export ({days, settings}) or the prototype export ({days, cfg}). */
export function parseImport(text: string): AppData {
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('No days found in this file.')
  const j = migrate(parsed as Raw) as { days?: Record<string, Partial<Day>>; settings?: Partial<Settings>; cfg?: Partial<Settings> }
  if (!j.days || typeof j.days !== 'object') throw new Error('No days found in this file.')
  const days: Record<string, Day> = {}
  for (const [k, v] of Object.entries(j.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = normDay(v)
  return { version: SCHEMA_VERSION, days, settings: normSettings(j.settings ?? j.cfg), su: typeof (j as { su?: number }).su === 'number' ? (j as { su?: number }).su : 0 }
}

export function storedVersion(raw: string): number {
  try {
    const v = (JSON.parse(raw) as Raw | null)?.version
    return typeof v === 'number' ? v : 1
  } catch {
    return 1
  }
}

export function blankData(): AppData {
  return { version: SCHEMA_VERSION, days: {}, settings: normSettings(undefined), su: 0 }
}

/** `locked` means the device holds data from a newer TRCK. Nothing may be saved over it until the app is updated. */
export function loadFrom(raw: string | null, mem: Mem = localStorage): { data: AppData; locked: boolean } {
  const blank = blankData()
  if (!raw) return { data: blank, locked: false }
  try {
    if (storedVersion(raw) < SCHEMA_VERSION) saveBackup(raw, 'before upgrade', mem)
    return { data: parseImport(raw), locked: false }
  } catch {
    saveBackup(raw, 'unreadable', mem)
    return { data: blank, locked: storedVersion(raw) > SCHEMA_VERSION }
  }
}

function load() {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) } catch { /* private mode */ }
  return loadFrom(raw)
}

export type Store = {
  data: AppData
  /** True when this device holds data from a newer version. Changes are not saved until the app updates. */
  locked: boolean
  mutate: (key: string, fn: (d: Day) => void) => void
  setSettings: (fn: (s: Settings) => void) => void
  /** Pass `backup` to snapshot what is on the device first, as an import does. Returns false, and changes nothing, if that copy cannot be kept. */
  replace: (d: AppData, backup?: boolean) => boolean
  saveError: boolean
}

export function useStore(): Store {
  const [boot] = useState(load)
  const [data, setData] = useState<AppData>(boot.data)
  const [saveError, setSaveError] = useState(false)
  const first = useRef(true)
  const latest = useRef(data)
  latest.current = data

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (boot.locked) return
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [data, boot.locked])

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

  const replace = useCallback((d: AppData, backup = false) => {
    if (backup && !saveBackup(JSON.stringify(latest.current), 'before import')) return false
    setData(d)
    return true
  }, [])

  return { data, locked: boot.locked, mutate, setSettings, replace, saveError }
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
