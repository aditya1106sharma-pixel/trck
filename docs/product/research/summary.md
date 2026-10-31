# Build, borrow or skip, and the 5 riskiest assumptions

One page. Details and sources are in [photo-meal-logging.md](photo-meal-logging.md) and [next-session.md](next-session.md).

## Build, borrow or skip

| Piece | Decision | Why |
|---|---|---|
| Photo to item list (name, grams, macros, confidence) | **Borrow** Gemini Flash-Lite, free tier | Free, reads images, JSON output. Older Gemini scored worse than GPT and Claude on food photos, so the design must carry accuracy. |
| Always ask about oil, ghee, butter and sauces | **Build** | The NIH study's misses were mostly hidden fat, 250 to 345 kcal a meal. Nobody in the market makes this a required step. |
| Range instead of one number | **Build** | Model weight error is about a third even for the best models. |
| Your food list overrides the model | **Build** | Already a TRCK rule: your label values win. |
| Confirm before logging, edit with steppers | **Borrow** from MyFitnessPal Meal Scan | Same stepper as today's Eaten list. |
| Indian food recognition model | **Skip** | HealthifyMe built one; we cannot. Prompt for Indian names and household units instead. |
| Indian Nutrient Databank in the app | **Skip** for now | Recipe licence unclear, and it adds size. Use it by hand to check numbers. |
| Daily cap of 20 per person | **Build** | Free quota is per Google project, shared by every friend. |
| Copy a prompt for Claude, paste the reply back | **Build** | Never a dead end, free, private, works offline for the copy step. |
| Next session card from recovery and weekly gaps | **Borrow** the idea from Gravl, **build** the logic | A pure, tested function you can read. |
| Machine learning planner | **Skip** | One user, small data. Rules are clearer. |
| Swap button | **Borrow** from Hevy | Busy machines at 11 pm are common. |
| Equipment list | **Borrow** from Fitbod, smallest version | One list, all on by default. |
| Recovery percentages | **Skip** | Ready or Recovering is plainer. |

## The 5 riskiest assumptions, each with a cheap test

| # | Assumption | Risk area | Cheap test |
|---|---|---|---|
| 1 | You will take a photo, answer the fat question and fix items in under 30 seconds at 11 pm. If not, photo logging is slower than chips. | Usability | Log 5 real dinners with a stopwatch in the first week. Kill or simplify if the median is over 45 seconds. |
| 2 | Gemini Flash-Lite plus the fat question lands within about 25 percent of a weighed meal for Indian home food. | Value, feasibility | Weigh 5 home meals (roti, dal, sabzi, chicken) on a kitchen scale, build them with Build a meal, then photo them. Compare kcal. |
| 3 | The free Gemini quota and data terms are acceptable for you and for friends. | Viability | Read the AI Studio quota page and the terms during setup. Ask 2 friends if "Google may use your photo to improve its models" would stop them. |
| 4 | The 48 hour rule plus weekly gaps gives a session you would actually start, without changing more than one lift. | Value | For 2 weeks, note before each session whether you tapped Start this session and how many Swaps you used. More than 2 swaps on most days means the rules are off. |
| 5 | 3 minutes a set is close enough to keep a session at 45 to 50 minutes. | Feasibility | Note start and finish time for 4 sessions. Change the per set estimate in `plan.ts` (one constant) to match. |
