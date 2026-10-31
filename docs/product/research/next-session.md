# Research: next session suggestion

Date: 2026-10-31. Method: pm-product-discovery (identify-assumptions-existing) and pm-market-research (competitor-analysis), web search. **Not verified** means second hand only.

## 1. Gaps in the idea

1. **Ready is not the same as worth training.** A muscle can be ready and already over its weekly range. Rank by the weekly gap, and skip muscles at the top of their range.
2. **Lifts hit more than one muscle.** A Romanian deadlift trains hamstrings and glutes, and helps back. The plan has to count what each lift already covers, or it will stack three lifts on glutes.
3. **Helpers on tired muscles.** Rows after a back day are out, but is an RDL (back as helper) fine the day after back? Decision: a lift is skipped only when a *recovering* muscle is one of its *main* muscles. Helpers are fine.
4. **The 48 hour rule is a simplification.** Fitbod says full recovery can take up to 7 days and lets you adjust by hand ([Fitbod help](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)). We keep 48 hours because it is our rule, and the plan never forbids you from training anything.
5. **Calves have no lift in the routine.** The plan must offer a variation when a muscle has nothing, which the idea covers.
6. **Time.** 3 minutes a set is a guess that includes rest. 16 sets is about 48 minutes.
7. **Equipment differs by centre.** Cult SG Palya and Jayanagar may not have the same machines. One "equipment at my gym" list, all on by default, is the smallest version. Per gym lists come later if you actually switch often.
8. **Empty history.** On day 1 there is nothing to rank by. The plan should still give a full body session from the routine.

## 2. What the market is doing

| App | Next workout logic | Source |
|---|---|---|
| Fitbod | Per muscle recovery percentage, heat map, prefers fresh muscles, uses goals, level, equipment and history. Formula not published. Says 150 million workouts logged. | [Fitbod help](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout), [Fitbod blog](https://fitbod.me/blog/fitbod-algorithm) (company sources) |
| Gravl | "Recovery split": picks the next session from muscle recovery, not a fixed calendar. Next Workout card shows recovery per muscle, suggests rest at 60 percent or below, Regenerate and Skip buttons, makes up skipped muscles later. | [Gravl help: recovery split](https://help.gravl.ai/en/articles/10242599-gravl-ai-the-magic-behind-the-recovery-split), [Gravl help: fatigue](https://help.gravl.ai/en/articles/10226237-gravl-muscle-fatigue-and-recovery) |
| Hevy | No auto plan. Routines plus a Previous column (last time you did the lift). Replace an exercise from a menu, the new one keeps sets and timers. | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy), [Hevy features](https://www.hevyapp.com/features/track-workouts/) |
| Strong | Templates and previous values. I found no official help page for replace or suggestions (not verified). | [screensdesign walkthrough](https://screensdesign.com/apps/strong-workout-tracker-gym-log/?vs=133312) |
| Cult.fit | Classes and programs; no public next session planner found (not verified). | [Analytics Insight](https://www.analyticsinsight.net/amp/story/apps/best-fitness-apps-in-india-to-try-in-2026-top-10-picks) |

## 3. Features worth borrowing

| From | Feature | Borrow? |
|---|---|---|
| Gravl | A Next Workout card at the top that explains itself per muscle | Yes: "Today's session" card with a reason line per lift |
| Gravl | Make up missed muscles later | Yes, for free: the weekly gap does this |
| Hevy | Replace an exercise and keep sets | Yes: Swap button on every lift |
| Hevy, Strong | Last time and the target next to the lift | Already have it (overload hint), reuse it |
| Fitbod | Equipment profile | Yes, a simple on and off list |
| Fitbod, Gravl | A recovery percentage | No. Ready or Recovering is plainer and already ours |
| Fitbod | Machine learning on millions of workouts | No. A pure function you can read and test |

## 4. Training evidence used for the rules

- Weekly sets per muscle: more sets meant more growth, up to the 10+ sets a week group, and the data could not say whether more than 10 helps ([Schoenfeld et al. 2017, PDF](https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf)). Our ranges in `catalog.ts` (6 to 18) sit in that space. Later work argues for 12 to 20 ([Stronger by Science](https://www.strongerbyscience.com/?p=56687)). These are starting points, not rules.

## 5. Articles worth reading

- [How Fitbod creates your workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- [Gravl: the recovery split](https://help.gravl.ai/en/articles/10242599-gravl-ai-the-magic-behind-the-recovery-split)
- [Hevy: previous workout values](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)
- [Schoenfeld 2017 weekly volume meta-analysis](https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf)

## 6. How we build it ourselves, free

A pure function `planSession(days, settings, today, now)` in `src/lib/plan.ts`. No network, no AI.

1. For each muscle with a weekly range: Ready (48 hour rule), this week's sets, and the gap to the low end.
2. Ready muscles with sets under the top of their range, biggest gap first.
3. For each one, the main lift with the most history that your gym has, preferring the routine. If the muscle has no routine lift, offer a variation.
4. Count what each picked lift covers (main 1, helper 0.5), so one lift can serve two muscles.
5. Second pass: muscles still under range get a variation, while time allows.
6. Stop at 16 sets (about 48 minutes at 3 minutes a set).
7. Each lift gets a reason line, the target from the overload hint, and a list of swaps.
8. Separately, read the last 4 weeks of sessions and say whether they look like full body, upper and lower, or mixed.
