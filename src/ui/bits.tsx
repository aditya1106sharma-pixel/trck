import type { ReactNode } from 'react'

export const r1 = (n: number) => Math.round(n * 10) / 10
export const f0 = (n: number | null) => (n == null ? 'n/a' : String(Math.round(n)))
export const f1 = (n: number | null) => (n == null ? 'n/a' : String(r1(n)))

export function Seg<T extends string>({ value, onChange, opts, label }: { value: T; onChange: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, t]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="step" role="group" aria-label={label}>
      <button aria-label={`${label} minus`} onClick={() => onChange(Math.max(min, r1(value - step)))}>−</button>
      <output>{value}</output>
      <button aria-label={`${label} plus`} onClick={() => onChange(Math.min(max, r1(value + step)))}>+</button>
    </div>
  )
}

export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return <button className="check" aria-pressed={on} aria-label={label} onClick={onToggle} />
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <header><h2>{title}</h2>{right}</header>
      {children}
    </section>
  )
}

export function Rail({ pct, ok }: { pct: number; ok?: boolean }) {
  return <div className={'rail' + (ok ? ' ok' : '')} role="presentation"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
}

export function Num({ v, d = 0 }: { v: number | null; d?: number }) {
  return <>{v == null ? 'n/a' : d ? v.toFixed(d) : Math.round(v)}</>
}
