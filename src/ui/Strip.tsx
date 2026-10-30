import { f0 } from './bits'

type Props = {
  label: string
  values: (number | null)[]
  target?: number
  good?: (v: number) => boolean
  summary: string
  line?: boolean
}

/** A small bar or line strip over the last days. Gaps stay gaps. */
export function Strip({ label, values, target, good, summary, line }: Props) {
  const W = 300, H = 56, pad = 4
  const nums = values.filter((v): v is number => v != null)
  const max = Math.max(1, ...nums, target ?? 0)
  const min = line && nums.length ? Math.min(...nums, target ?? Infinity) - 0.5 : 0
  const span = Math.max(0.001, max - min)
  const n = values.length
  const bw = (W - pad * 2) / n
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2 - 6)
  const pts = values.map((v, i) => (v == null ? null : ([pad + i * bw + bw / 2, y(v)] as const)))
  let d = ''
  pts.forEach((p) => { if (p) d += (d && !d.endsWith('M') ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) })
  return (
    <div className="tile">
      <div className="row sp"><h2>{label}</h2><span className="sm mut">{summary}</span></div>
      <svg className="strip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${summary}`} preserveAspectRatio="none">
        {target != null && <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="var(--mut)" strokeDasharray="3 3" strokeWidth="1" />}
        {line ? (
          <>
            <path d={d} fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinejoin="round" />
            {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--acc)" />)}
          </>
        ) : (
          values.map((v, i) =>
            v == null ? <rect key={i} x={pad + i * bw + bw * 0.3} y={H - pad - 1} width={Math.max(1, bw * 0.4)} height={1} fill="var(--line)" /> : (
              <rect key={i} x={pad + i * bw + bw * 0.15} y={y(v)} width={Math.max(1, bw * 0.7)} height={Math.max(2, H - pad - y(v))} rx="1"
                fill={good ? (good(v) ? 'var(--ok)' : 'var(--acc)') : 'var(--acc)'} />
            )
          )
        )}
      </svg>
      <span className="sr" hidden>{values.map(f0).join(', ')}</span>
    </div>
  )
}
