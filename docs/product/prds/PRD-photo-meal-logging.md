# PRD: Photo meal logging

**Status: Approved** (Aditya approved the scope as written, 2026-10-31). Target release 0.6.0.
Research: [photo-meal-logging.md](../research/photo-meal-logging.md).

## 1. Summary
Snap a photo of a meal, add a few words, and TRCK lists the ingredients with portions and macros for you to check and log. It is for meals that are not on the chip list, like a plate at a friend's place. It is possible now because a free vision model can read photos, and it must be honest because photo apps undercount by about 250 to 345 kcal a meal.

## 2. Contacts
Aditya: owner and only user today. Friends: future users, privacy matters for them.

## 3. Background
Chips and Build a meal are fast for repeated foods. Mixed or new meals take a long time to build by hand, so they go unlogged or get guessed. Photo apps exist, but the NIH metabolic kitchen study shows all four tested apps miss mostly hidden fat. Our edge is to ask the fat question every time and let the user's own values win.

## 4. Objective
Log a mixed meal in under 30 seconds with an honest number.
Key results, after 2 weeks of use:
- KR1: median time from tapping Add meal photo to Log is 30 seconds or less (stopwatch, 5 meals).
- KR2: on 5 weighed home meals, the logged kcal is within 25 percent of the weighed meal.
- KR3: at least 4 meals a week are logged by photo, and none of them dead ends (fallback used counts as success).

## 5. Market segments
1. **Aditya at 11 pm or eating out**: one hand, tired, a meal that is not on the chip list.
2. **Friends using TRCK later**: need a plain privacy note and the same free path.
Constraints: free services only, no key in the client, photo never stored.

## 6. Value proposition
- **Who:** Aditya with a mixed meal not on the chip list.
- **Why:** log protein and calories honestly without building the meal item by item.
- **What before:** build a meal with 10 steppers, or guess, or skip logging.
- **How:** a photo plus a few words becomes an editable list of items, with the fat question asked every time.
- **What after:** the meal is logged in one screen, with a range that admits uncertainty, and his own food values used where they match.
- **Alternatives:** Cal AI or MyFitnessPal (paid, undercount fat, separate app), or pasting into Claude (works, but takes copying back by hand).

Statement: for a mixed meal, TRCK turns one photo into an honest, editable list in seconds, and never logs a number you have not checked.

## 7. Solution

### 7.1 Flow
1. Today, Protein section: **Add meal photo**.
2. Sheet: **Take photo** or **Choose photo**, an optional note ("chicken, 2 rotis, little oil"), and a plain line: "Your photo goes to Google Gemini to be read. On the free plan Google may use it to improve its models, and people at Google may see it. TRCK keeps no copy."
3. The photo is resized in the browser to about 1024 px and sent with the note to the `meal-photo` Edge Function.
4. Review: a list of items, each with grams, protein and kcal and a stepper (same as Eaten). Items that match your food list say "your values". The question "How much oil, ghee or butter went in?" is always shown with a teaspoon stepper. Any other questions from the model show below it. A range: "About 520 to 690 kcal, 38 g protein".
5. **Log meal** logs one meal entry with its items. **Save as favourite** also adds it to your meals. **Cancel** logs nothing.
6. If offline, signed out, over the cap or the call fails: "Copy a prompt for Claude" with the same questions, then "Paste Claude's reply" opens the same review screen.

### 7.2 Key features
- Edge Function: checks the sign in token, cap of 20 photos per person per day (resets 5:30 am IST), calls Gemini with a JSON schema, returns JSON only: `{items: [{name, grams, protein, fat, carbs, kcal, confidence, count?}], questions: [string], fat_tsp?}`.
- Strict parsing in the app (`src/lib/photo.ts`): bad JSON, missing fields, absurd values (an item over 3,000 kcal or 2 kg is dropped and flagged), kcal recomputed from macros when it disagrees badly.
- Your values win: an item whose name matches your food list uses your per unit values, scaled by count or grams.
- Range from confidence: high plus or minus 15 percent, medium 30, low 45, and the fat question adds its own kcal on top.
- Stored fields, all new and optional: `FoodEntry.src: 'photo'`, `FoodEntry.conf` (0 to 1). No stored field renamed. Migration test.
- Privacy: the photo lives in memory only, never in localStorage, never stored by the function. The key is an Edge Function secret.

### 7.3 Technology
Gemini model in one config line: `supabase/functions/meal-photo/config.ts`, default `gemini-3.1-flash-lite`, override with the `GEMINI_MODEL` secret. A small table `photo_quota` for the cap, written only by the function.

### 7.4 Assumptions and open questions
- The 5 riskiest assumptions and their tests are in [summary.md](../research/summary.md).
- Exact model string and free quota: confirm in AI Studio during setup.
- Gemini free terms reportedly do not apply in the EEA, UK and Switzerland (not verified). Fine for India.

## 8. Release
- **0.6.0:** everything above. The feature shows the fallback until the key and function are set up.
- **Later:** per item search in your food list, a "weigh it" mode, paid tier switch if friends join.
- **Not doing:** storing photos, a calorie database, barcode scanning, any health claim.
- Size: about 2 days of agent time.
