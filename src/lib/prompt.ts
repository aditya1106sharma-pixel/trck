import { addDays, fmt, winKeys } from './dates'
import { fuelData, advise } from './fuel'
import { gaps, monthEffective, weekEffective } from './muscles'
import { muscleLabel } from './catalog'
import { periodStats, avg } from './stats'
import { carbTarget, streaks, type Days } from './score'
import type { Settings } from './types'

const r1 = (n: number | null) => (n == null ? 'no data' : String(Math.round(n * 10) / 10))

/** A review prompt the user pastes into Claude. No API key, no cost, no server. */
export function reviewPrompt(days: Days, s: Settings, today: string): string {
  const w = periodStats(days, s, today, 7)
  const wp = periodStats(days, s, addDays(today, -7), 7)
  const st = streaks(days, s, today)
  const fd = fuelData(days, winKeys(today, 7))
  const adv = advise(fd, s, '7 day average')
  const weekGaps = gaps(weekEffective(days, s, today), 1).map((g) => `${muscleLabel(g.mu)} ${g.sets} of ${g.need}`)
  const monthGaps = gaps(monthEffective(days, s, today), 30 / 7).map((g) => `${muscleLabel(g.mu)} ${Math.round(g.sets)} of ${g.need}`)
  const wts = w.weights
  const lines = [
    `You are my strength and nutrition coach. I am on a ${s.days} day body recomposition that started ${fmt(s.start, { day: 'numeric', month: 'short', year: 'numeric' })}. I am 80 kg, 179 cm, skinny fat, training at a commercial gym in Bengaluru. Review my last 7 days, be direct, and give me no more than 5 changes for next week.`,
    '',
    `Targets: protein ${s.protein} g, fat ${s.fat} g, calories ${s.kcal}, carbs about ${carbTarget(s)} g, water ${s.water} glasses, tea or coffee cap ${s.cups}, cigarette cap ${s.cig}.`,
    '',
    'Last 7 days:',
    `- Days logged: ${w.logged} of 7. Average score: ${r1(avg(w.score, w.logged))} of 100. Streak: ${st.cur} days (best ${st.best}).`,
    `- Protein: average ${r1(avg(w.prot, w.foodDays))} g on food days, within 10% of target on ${w.proteinDays} of ${w.foodDays} days.`,
    `- Calories: average ${r1(avg(w.kcal, w.foodDays))}. Fat: average ${r1(fd.avg ? fd.avg.f : null)} g. Carbs: average ${r1(fd.avg ? fd.avg.cb : null)} g.`,
    `- Training: ${w.sessions} sessions, ${w.sets} working sets. Previous 7 days: ${wp.sessions} sessions, ${wp.sets} sets.`,
    `- Cigarettes: ${r1(avg(w.cig, w.logged))} a day. Tea or coffee: ${r1(avg(w.cups, w.logged))} cups a day.`,
    `- Body weight entries this week: ${wts.length ? wts.join(', ') + ' kg' : 'none'}.`,
    `- Muscles under the weekly set range: ${weekGaps.length ? weekGaps.join('; ') : 'none'}.`,
    `- Muscles under the 30 day range: ${monthGaps.length ? monthGaps.join('; ') : 'none'}.`,
    '',
    'What the food data says:',
    ...adv.cut.map((x) => `- Cut: ${x}`),
    ...adv.add.map((x) => `- Add: ${x}`),
    '',
    'Answer in this order: (1) the one thing that matters most, (2) food changes, (3) training changes, (4) habits, (5) what to measure next week. Say so plainly if the data is too thin to judge something.',
  ]
  return lines.join('\n')
}
