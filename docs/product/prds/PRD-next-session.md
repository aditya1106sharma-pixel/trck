# PRD: Next session suggestion

**Status: Approved** (Aditya approved the scope as written, 2026-10-31). Target release 0.6.0.
Research: [next-session.md](../research/next-session.md).

## 1. Summary
A "Today's session" card at the top of Train picks the lifts for tonight from what is Ready, what is short this week and what you usually do, with one line saying why for each lift. It removes the 11 pm "what do I train" moment. It is a pure function with tests, no AI and no network.

## 2. Background
Train shows the same routine every time. When upper body was trained yesterday, you have to work out by hand what is ready, what is short this week and which variation to add. Gravl and Fitbod do this with hidden models. TRCK already has the parts: the 48 hour Ready rule, weekly ranges and the overload hint.

## 3. Objective
Start the right session in one tap.
Key results, over 2 weeks:
- KR1: you tap Start this session on at least 3 of 4 sessions.
- KR2: median swaps per session is 1 or fewer.
- KR3: weekly sets for every muscle land inside its range in at least 1 of the 2 weeks.

## 4. Market segments
1. **Aditya, 3 to 4 full body sessions a week at Cult SG Palya or Jayanagar**, sometimes the day after an upper body session.
2. **Someone on an upper and lower split**: same logic, no setting needed.

## 5. Value proposition
- **Who:** Aditya walking into the gym.
- **Why:** train what is ready and short this week, without doing the maths.
- **What before:** check the Muscles tab, remember yesterday, pick lifts by feel.
- **How:** a card that ranks Ready muscles by weekly gap and picks your most used lifts, with a reason and a target for each.
- **What after:** one tap fills Train with tonight's lifts, inside about 45 to 50 minutes.
- **Alternatives:** Fitbod or Gravl (paid, black box), or a fixed routine (ignores recovery).

Statement: TRCK tells you tonight's session and why, from your own log, in one card.

## 6. Solution

### 6.1 Rules (`src/lib/plan.ts`, `planSession`)
1. Muscles considered: those with a weekly range. **Ready** means 48 hours have passed since the usual finish hour on the last day it got 2 or more sets.
2. Order: Ready muscles under the top of their range, biggest gap to the low end first, then the longest since trained.
3. Lift for a muscle: a lift where it is a main muscle, that your gym has, and whose main muscles are all Ready. Routine lifts first, then more history first.
4. Coverage: each picked lift adds its sets (main 1, helper 0.5) to every muscle it trains, so an RDL covers hamstrings and glutes.
5. Variation only when the muscle has no lift in your routine, or it is still under range after its first lift (second pass, time allowing).
6. Time cap: 3 minutes a set, at most 50 minutes (16 sets). Muscles that do not fit are listed as "No time today".
7. Each lift shows: a reason ("Quads: ready, 0 of 8 sets this week"), the target weight and reps from the overload hint, and a **Swap** button that cycles other lifts for the same muscle.
8. Style: from the last 4 weeks of sessions, say "full body", "upper and lower" or "mixed", with sessions a week.
9. Empty history: everything is Ready, so the plan is a full body routine.

### 6.2 Key features
- **Today's session** card at the top of Train, today only.
- **Start this session** stores the lift ids on the day (`Day.plan`, new optional field) and Train shows those lifts first with their targets. Variations are added to your lifts so their sets count. **Show all lifts** and **Clear session** links.
- **Equipment at my gym** list under Lifts (new optional `Settings.noEq`, the ids switched off; empty means all on). Custom lifts are always available.

### 6.3 Required example
Yesterday: chest press, lat pulldown, seated row, shoulder press, curl, pushdown. Today the card suggests leg press (quads), Romanian deadlift (hamstrings, glutes), standing calf raise (calves, a variation), cable crunch (core), plus a second quads variation if time allows. Covered by a test.

### 6.4 Assumptions and open questions
- 3 minutes a set and 48 hours: tested in [summary.md](../research/summary.md), one constant each.
- One equipment list for both centres. Per centre lists only if you switch often.

## 7. Release
- **0.6.0:** all of the above.
- **Later:** a rest day suggestion when nothing is Ready, per centre equipment.
- **Not doing:** AI, recovery percentages, auto changing sets or reps.
- Size: about 1 day of agent time.
