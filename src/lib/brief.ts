// One block of text to paste into a Claude chat so it can plan today's workout and the rest of the day.
// Built only from what is logged. Pure: no network, no AI.
import { EQUIPMENT, SUPPLEMENTS, muscleLabel } from './catalog'
import { buildContext } from './context'
import { diffDays, winKeys } from './dates'
import { routine } from './muscles'
import { liftTarget, planSession } from './plan'
import { cupsOf, protein, score, sessionsInWeek } from './score'
import { exportSync, KEYS } from './tracksync'
import type { AppData } from './types'

export function chatBrief(data: AppData, today: string, now: number, n = 7): string {
  const { days, settings: s } = data
  const dayN = Math.max(1, diffDays(today, s.start) + 1)
  const plan = planSession(days, s, today, now)
  const L: string[] = []

  L.push('You are my strength coach and food planner for a personal recomposition plan. I log everything in my own app, TRCK. Use only the numbers below and what I tell you. Do not invent weights, reps or meals I have not logged.')
  L.push('')
  L.push('HOW TO HELP ME')
  L.push('1. First, if you need it, ask me in one short message: how I slept, energy 1 to 5, any soreness or pain, and how many minutes I have in the gym.')
  L.push('2. Then give me today\'s workout as a short list: lift, sets x reps, the weight to use, and one cue. Start from the suggested session below, follow the overload targets, and skip any muscle that is still recovering. If today should be rest, say so and why.')
  L.push('3. Tell me how to reach my protein target for the rest of today with plain Indian home food, and one habit to focus on (cigarettes, tea or coffee, water, sleep).')
  L.push('4. Keep it short and practical. I am a beginner, often training late at night.')
  L.push('5. When I tell you what I did, ate or how I feel, end your reply with a TRCK-SYNC v1 block holding only those new values, in the format at the bottom, so I can paste it back into TRCK. Use the lift ids from MY ROUTINE in top_sets. TRCK only takes those, so put any other lift (even one suggested below that is not in my routine) in notes, like notes=calf raise 30x12,12.')
  L.push('6. Safety: sharp pain, swelling or pain that does not ease means stop that lift and see a doctor. Food numbers are rough estimates. This is not medical advice.')
  L.push('')
  L.push('MY PLAN')
  L.push(`Day ${dayN} of ${s.days}, started ${s.start}. Goal: lose fat and build muscle at the same time.`)
  L.push(`Targets each day: protein ${s.protein} g, about ${s.kcal} kcal, fat about ${s.fat} g, water ${s.water} glasses, at most ${s.cups} cups of tea or coffee, at most ${s.cig} cigarettes.`)
  L.push(`Training: 3 to 4 full body sessions a week. Sessions this week so far: ${sessionsInWeek(days, today)}. I usually finish around ${s.hour}:00.`)
  L.push('Rules TRCK uses: a muscle counts as trained at 2 or more sets in a day (main muscle 1 set, helper 0.5), and is ready 48 hours after the session. Soreness I report only delays that. Add weight once every set hits the top of the rep range, otherwise add a rep.')
  L.push('')
  L.push('MY ROUTINE (id: name, sets x rep range, weight step, next target)')
  for (const ex of routine(s)) {
    const mus = Object.entries(ex.m).filter(([, w]) => w === 1).map(([m]) => muscleLabel(m).toLowerCase()).join(', ')
    L.push(`- ${ex.id}: ${ex.n} (${mus}), ${ex.s} x ${ex.lo} to ${ex.hi}, step ${ex.inc} kg, next: ${liftTarget(ex, days, today)}`)
  }
  const missing = (s.noEq ?? []).map((id) => EQUIPMENT.find((e) => e.id === id)?.n ?? id)
  if (missing.length) L.push(`My gym does not have: ${missing.join(', ')}.`)
  L.push('')
  L.push(`TRCK'S SUGGESTED SESSION TODAY (about ${plan.minutes} min, ${plan.sets} sets)`)
  if (plan.lifts.length) for (const l of plan.lifts) L.push(`- ${l.ex.n} (${l.id}), ${l.ex.s} sets, target ${l.target}. ${l.reason.replace(/\.$/, '')}.`)
  else L.push('- Nothing suggested: everything is recovering or done for the week.')
  if (plan.skipped.length) L.push('Left out: ' + plan.skipped.map((x) => `${muscleLabel(x.mu).toLowerCase()} (${x.why.toLowerCase()})`).join(', ') + '.')
  L.push(plan.style.text)
  L.push('')
  L.push('MY WEEK')
  L.push(buildContext(days, s, today, now))
  L.push('')
  L.push(`HABITS AND SCORE, LAST ${n} DAYS (TRCK scores 100: protein 30, training 20, supplements 20, habits 20, water 10)`)
  for (const k of winKeys(today, n)) {
    const d = days[k]
    if (!d) { L.push(`- ${k}: nothing logged`); continue }
    const supp = SUPPLEMENTS.filter((x) => d.s[x.id]).map((x) => x.n.toLowerCase())
    L.push(`- ${k}: score ${score(d, s).total}, protein ${Math.round(protein(d))} g, water ${d.w}, tea or coffee ${cupsOf(d)}, cigarettes ${d.cig}, cardio ${d.cardio} min, supplements ${supp.length ? supp.join(', ') : 'none'}${d.done ? ', session done' : ''}`)
  }
  L.push('')
  L.push('TRCK-SYNC v1 FORMAT (for your replies)')
  L.push('First line TRCK-SYNC v1, then one line per date: key=value pairs joined by " | ". Leave out keys with no data. Dates YYYY-MM-DD; my day runs until 5 am, so a 1 am session belongs to the day before.')
  L.push(`Keys: ${KEYS.join(', ')}.`)
  L.push('weight_kg and sleep_hrs are numbers, sleep_in and sleep_out HH:MM, sleep_q, energy, hunger, gut 1 to 5 whole numbers, steps a whole number, protein_g and kcal are the day\'s totals.')
  L.push('top_sets example: pulldown 45x10,10,9; row 40x10,42.5x8 (weight x reps, the weight is written again only when it changes).')
  L.push('Put the block in a code block. The "missing:" note at the end of my lines is only for you, do not add it.')
  L.push('')
  L.push(`MY LOG, LAST ${n} DAYS`)
  L.push(exportSync(data, n, today))
  return L.join('\n')
}
