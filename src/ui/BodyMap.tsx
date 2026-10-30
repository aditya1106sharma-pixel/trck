import type { MuscleId } from '../lib/types'
import { muscleLabel } from '../lib/catalog'

type Props = { fill: (mu: MuscleId) => string; selected: MuscleId | null; onPick: (mu: MuscleId) => void }

/** Front and back figure. Each muscle is a tappable shape. */
export function BodyMap({ fill, selected, onPick }: Props) {
  const N = 'color-mix(in srgb, var(--ink) 14%, var(--bg))'
  const Z = (mu: MuscleId) => ({
    className: 'mz' + (selected === mu ? ' on' : ''),
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': muscleLabel(mu),
    fill: fill(mu),
    onClick: () => onPick(mu),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(mu) } },
  })
  const el = (mu: MuscleId, cx: number, cy: number, rx: number, ry: number, rot = 0, key = '') => (
    <ellipse key={mu + key} {...Z(mu)} cx={cx} cy={cy} rx={rx} ry={ry} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} />
  )
  const pair = (mu: MuscleId, cx: number, cy: number, rx: number, ry: number, rot = 0) => [
    el(mu, cx, cy, rx, ry, rot, 'l'), el(mu, 200 - cx, cy, rx, ry, rot ? -rot : 0, 'r'),
  ]
  const base = (
    <g fill={N} stroke={N} strokeWidth="6" strokeLinejoin="round">
      <circle cx="100" cy="28" r="16" /><rect x="94" y="42" width="12" height="16" rx="4" />
      <path d="M68 64 Q100 56 132 64 L127 122 L122 158 L78 158 L73 122 Z" />
      <rect x="41" y="68" width="18" height="56" rx="9" /><rect x="141" y="68" width="18" height="56" rx="9" />
      <rect x="33" y="124" width="16" height="58" rx="8" /><rect x="151" y="124" width="16" height="58" rx="8" />
      <circle cx="41" cy="190" r="7" /><circle cx="159" cy="190" r="7" />
      <rect x="76" y="152" width="48" height="26" rx="12" />
      <rect x="73" y="170" width="26" height="96" rx="13" /><rect x="101" y="170" width="26" height="96" rx="13" />
      <rect x="76" y="262" width="20" height="82" rx="10" /><rect x="104" y="262" width="20" height="82" rx="10" />
      <ellipse cx="86" cy="350" rx="12" ry="6" /><ellipse cx="114" cy="350" rx="12" ry="6" />
    </g>
  )
  const seam = { stroke: 'var(--bg)', strokeWidth: 1.5, opacity: 0.7, fill: 'none', pointerEvents: 'none' as const }
  return (
    <svg className="body" viewBox="0 0 420 380" role="group" aria-label="Body map, front and back">
      <g>
        {base}
        {pair('quads', 86, 218, 12, 44)}{pair('calves', 86, 304, 8, 32)}
        {pair('biceps', 50, 98, 8, 18)}{pair('forearms', 41, 148, 7, 24)}
        <path {...Z('core')} d="M86 108 H114 Q118 108 118 114 V148 Q118 154 112 154 H88 Q82 154 82 148 V114 Q82 108 86 108 Z" />
        <path d="M100 110V152M85 124H115M85 139H115" {...seam} />
        {pair('chest', 85, 90, 18, 14, -6)}{pair('shoulders', 58, 76, 12, 14)}
      </g>
      <g transform="translate(220,0)">
        {base}
        {pair('hamstrings', 86, 224, 12, 40)}{pair('calves', 86, 304, 9, 30)}{pair('glutes', 89, 170, 13, 13)}
        {pair('triceps', 50, 98, 8, 18)}{pair('forearms', 41, 148, 7, 24)}
        <path {...Z('back')} d="M72 70 Q100 60 128 70 L125 126 Q122 130 118 130 H82 Q78 130 75 126 Z" />
        <path {...Z('back')} d="M84 130 H116 L114 152 Q100 158 86 152 Z" />
        <path d="M100 66V150" {...seam} />
        {pair('shoulders', 58, 76, 12, 14)}
      </g>
      <text x="100" y="374">FRONT</text><text x="320" y="374">BACK</text>
    </svg>
  )
}
