import { LEVELS } from '../lib/score'

/** The score visual: a barbell that gains plates as XP grows. Level 1 is a 5 kg plate each side. */
export function Plates({ xp }: { xp: number }) {
  let idx = 0
  LEVELS.forEach((l, i) => { if (xp >= l.xp) idx = i })
  const next = LEVELS[idx + 1]
  const partial = next ? Math.max(0, Math.min(1, (xp - LEVELS[idx].xp) / (next.xp - LEVELS[idx].xp))) : 1
  // plates heights, innermost first
  const H = [44, 56, 66, 76, 86]
  const W = 12
  const cx = 150
  const plate = (side: -1 | 1, i: number, fill: string, op = 1) => {
    const x = cx + side * (34 + i * (W + 2))
    return <rect key={`${side}${i}`} x={side === 1 ? x : x - W} y={50 - H[i] / 2} width={W} height={H[i]} rx={2} fill={fill} opacity={op} />
  }
  const rects = []
  for (let i = 0; i <= idx; i++) for (const s of [-1, 1] as const) rects.push(plate(s, i, 'var(--acc)'))
  if (next) for (const s of [-1, 1] as const) rects.push(plate(s, idx + 1, 'var(--acc)', 0.12 + partial * 0.5))
  return (
    <svg className="plates" viewBox="0 0 300 100" role="img" aria-label={`Barbell with ${(idx + 1) * 2} plates, ${xp} points`}>
      <rect x="10" y="48" width="280" height="4" rx="2" fill="var(--mut)" />
      <rect x={cx - 30} y="44" width="60" height="12" rx="2" fill="var(--ink)" opacity=".85" />
      <rect x="6" y="45" width="8" height="10" rx="2" fill="var(--ink)" opacity=".85" />
      <rect x="286" y="45" width="8" height="10" rx="2" fill="var(--ink)" opacity=".85" />
      {rects}
    </svg>
  )
}
