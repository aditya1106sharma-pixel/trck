# Research: AI trainer in Train, and the app revamp

Date: 2026-11-01. Method: pm-product-discovery (assumptions), pm-market-research (competitors), web search. **Not verified** means second hand only. Where I could not open Google's own pages (this session's network blocks `ai.google.dev`), the fact comes from search results and is marked.

## What Aditya told us (the evidence, in his words)
- Too many manual taps, too much scrolling to find a lift.
- At the gym he got better results by photographing a machine, typing its name, or filming himself and asking Claude, than by using TRCK.
- He wants that, but with the context of his week: "upper body the day before yesterday, lower body, traps and shoulders yesterday".
- He wants a trainer that says "you hit this yesterday, rest it, try this instead", reads soreness reports ("I woke up sore here"), reads his measurements and photos, and closes a loop with his diet and supplements.
- After a set he wants to say "I did it" and have the log, weights and muscles hit written for him, plus the next push.
- Goal: skinny fat, body recomposition, high protein, lean tissue built while fat comes down. It should be visible.
- Input by photo, video, text and voice. Answers with images and videos.
- Free to run. One person. No dependence on other people.

## 1. Gaps in the idea
1. **Free AI is tight.** His own AI Studio page for the `TRCK` project shows 5 requests a minute and **20 requests a day** for Gemini 2.5 Flash, and 10 a minute and 20 a day for 2.5 Flash Lite (screenshot he sent, 2026-10-31). That is the whole project, shared with meal photos. A chat coach used all day would hit it by lunch. The design must spend AI requests on what only AI can do and use plain rules for the rest.
2. **Body photos and Google's free tier.** On the free tier Google may use inputs to improve its models and people may read them ([Simon Willison on the terms](https://simonwillison.net/2024/Oct/17/gemini-terms-of-service), not opened directly). Body photos in a swimsuit are the most private thing in the app. Default: they never leave the phone. Sending one to the coach is an explicit tap with a plain warning.
3. **Form checking by AI is unreliable.** The only LLM study I found says vision models are well short of a human coach and sometimes invent corrections ([FormCoach, arXiv, not peer reviewed](https://arxiv.org/html/2508.07501v1)). A trial of an AI app against a physical therapist found it could tell correct squat form but was weak at spotting bad form ([trial listing](https://becarispublishing.com/doi/10.2217/cer-2021-0253), as summarised by search, not verified). So: the coach may describe what it sees and suggest a cue, never say "your form is fine" or "your form is wrong" with certainty. Heavy compound lifts get a "film from the side, ask a person" line.
4. **Soreness is a weak signal.** Sources agree soreness peaks about 48 to 72 hours after a hard session and fades in 5 to 7 days, that waiting about 48 hours is common guidance, and that soreness is not proof a session worked ([GoodRx](https://www.goodrx.com/well-being/movement-exercise/should-you-work-out-when-sore-active-recovery), [Livestrong](https://livestrong.com/article/424999-should-i-keep-working-out-if-my-calves-are-sore), low authority). The repeated bout effect means the same session hurts less the second time ([abstract](https://www.bisp-surf.de/Record/PU201101000411)). So soreness may only **delay** a muscle's Ready time, never shorten it. This keeps the 48 hour rule in CLAUDE.md intact.
5. **Waist is the right habit, but unproven.** I found no study showing waist change tracks fat or lean mass in recomposition. Practitioner advice is to repeat waist and hip girths at the same landmarks every 2 to 4 weeks ([search summary](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11405322/), not specific). The app should show waist, weight, strength and photos together and never claim fat loss from one number.
6. **Recomposition is slow and noisy.** Untrained people can gain muscle and lose fat together, and higher protein helps ([editorial](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11405322/), [trial in older women](https://pubmed.ncbi.nlm.nih.gov/35019903/)). Daily weight is noise. The view should be weekly and say so.
7. **Voice on a phone browser is patchy.** Speech recognition is partial in Chrome on Android and Safari on iOS, and reportedly absent in installed iPhone web apps ([caniuse](https://caniuse.com/speech-recognition), one 2023 blog, not verified for 2026). Voice must be a bonus on top of typing, never the only path.
8. **Too many inputs is its own friction.** Four input types in the first version would repeat the "too many clicks" problem. One capture button, and the app chooses the path.
9. **Not medical.** Soreness can be injury. The coach must say "sharp pain, swelling or pain that does not ease: stop and see a doctor" and give no diagnosis (CLAUDE.md: no health claims).

## 2. What the market is doing

| App | What it does | Source |
|---|---|---|
| Gym AI, Gymeo, SnapSets, FitLens, GymMayday | Photo of a machine, identifies the exercise, instructions, target muscles. Several log sets from the photo. Scanning is mostly behind a subscription. | [Gym AI](https://apps.apple.com/us/app/id6763727868), [Gymeo](https://apps.apple.com/app/id6748888066), [SnapSets](https://appfelstrudel.com/id/6749048169/snapsets-ai-gym-tracker.html), [FitLens](https://sourceforge.net/app/fitlens-ai/web-app/) (store listings, not tested) |
| WHOOP Coach | Chat coach on your own recovery and strain data, built on OpenAI. The most developed conversational coach found. Paid. | [BikeRadar](https://www.bikeradar.com/news/whoop-coach-chatgpt-4/) |
| Fitbod | Per muscle recovery heat map, generates workouts. A chat "Coach Chat" was upcoming at the time of one interview, not confirmed shipped. | [Fitbod help](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout), [TechRadar](https://techradar.com/health-fitness/fitness-apps/its-no-longer-enough-for-an-app-to-tell-you-what-to-do-people-want-to-know-why-fitness-app-fitbods-founder-on-the-reason-behind-the-ai-fitness-boom) |
| Gravl | Next Workout card with recovery per muscle, Regenerate and Skip, makes up missed muscles. | [Gravl help](https://help.gravl.ai/en/articles/10242599-gravl-ai-the-magic-behind-the-recovery-split) |
| Hevy, Strong | Logging with the Previous column and Replace exercise. No coach. | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy) |

The gap nobody fills: one capture button that takes a machine photo, a clip, a sentence or a soreness note, answers with the week's context, and **writes the log for you**. Paid apps do scanning or chat; none combined both with a recomposition view, as far as I could find.

## 3. Features worth borrowing

| From | Feature | Decision |
|---|---|---|
| Gym AI, SnapSets | Photo of machine to exercise and a prefilled log | Borrow. |
| WHOOP Coach | Answers that cite your own data ("you did legs yesterday") | Borrow. The week context pack is the product. |
| Gravl | Next Workout card with a reason per muscle | Already built in 0.6.0 (Today's session). |
| Hevy | Previous values beside the set, Replace keeps the sets | Borrow: prefill from last time, one tap to swap. |
| Fitbod | Recovery heat map | Already have (Muscles). Keep Ready or Recovering, add soreness. |
| All | Subscriptions, gamified streaks, a 3D body | Skip. |

## 4. How we build it for free

**Inputs.** One capture button opens the camera or the library (photo or short clip), with a text box and, where the browser allows, a mic. Photos are resized in the browser to about 1024 px, as in meal photos.

**The context pack (no AI, no network, always free).** A pure function builds a short text of the last 7 days: sessions, sets per muscle against range, what is Ready or Recovering and when, soreness reports, latest measurements and their trend, protein days hit, supplements, the goal. About 300 words. This is attached to every coach question and is also what makes the free Claude route as good as the in-app one.

**Two ways to ask, both free:**
1. **In the app.** A new Edge Function `coach` (same Gemini key, same sign in check, same allowlist as `meal-photo`) takes the context pack, the question and one photo, and returns JSON cards. A visible counter shows requests left today out of 20. When it runs out or is offline, the app switches to route 2 without losing the question.
2. **Copy for Claude.** Builds the context pack plus the question, copies it, and he attaches his photo or video in the Claude app, as he already does. He pastes Claude's JSON reply back and the same cards appear. Claude takes videos, which the free Gemini quota should not be trusted with (see below).

**Video.** Gemini accepts video, with inline data for short clips under about 20 MB and a File API for more ([Google video docs, via search, not opened](https://ai.google.dev/gemini-api/docs/video-understanding)). I found no free tier video limit and cannot confirm Flash Lite accepts video. So in v1 clips go through the Claude route, and in-app video is a later experiment once we know the quota.

**Answers as cards**, not a wall of chat: an exercise card (name, target muscles, how to set it up, 3 cues, a safety line), a recommendation card (rest, swap or push, with the reason from the log), a log card (the sets, tap to confirm and write), and a note card. A **log card** is the key: nothing is written until he taps Log.

**Images and videos in answers.** `free-exercise-db` is a public domain list of 800+ exercises with images and instructions ([repo](https://github.com/yuhonas/free-exercise-db), [README](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/README.md)). One source says the dataset including images is free for any use, but I could not verify the image rights independently, so check before we ship the images. wger is open but licensed per exercise ([search summary](https://apify.com/crawlerbros/wger-exercise-scraper.md), not wger's own page). Videos: a link to a YouTube search for "<exercise> form", which needs no key and no cost.

**Soreness.** A body map where he taps a muscle and a level (a little, a lot, sharp). Stored as new optional `Day.sore`. It can delay Ready, never advance it.

**Measurements and photos.** Waist, chest, arms, thighs, hips, weight, on a schedule he sets (default every 2 weeks). New optional `Day.meas`. Photos are kept on the phone in IndexedDB, front, side and back, with a side by side compare. They are not synced and never sent to AI unless he taps Ask about this photo.

**Voice.** The browser's speech recognition where it exists, with typing always available.

## 5. Build, borrow or skip

| Piece | Decision |
|---|---|
| Context pack builder | **Build** (pure, tested, free) |
| Coach cards with a Log button | **Build** |
| `coach` Edge Function on the existing Gemini key | **Build** (needs a go ahead: a new server function, see CLAUDE.md) |
| Copy for Claude, paste the reply back | **Build** (reuses the meal photo pattern) |
| Machine photo to exercise | **Borrow** the idea; Gemini does it, with our exercise list as the menu |
| Soreness map that delays Ready | **Build** |
| Measurements, local body photos, side by side | **Build** (roadmap item 4 already wanted body photos) |
| Recomposition view: waist, weight trend, strength, protein days | **Build** |
| Exercise images | **Borrow** free-exercise-db after checking image rights |
| In-app video analysis | **Skip for v1** (quota unknown), use Claude |
| Real time pose or rep counting | **Skip** (heavy, unreliable) |
| Paid API for unlimited coach | **Skip** unless Aditya decides to pay |
| Social, streak guilt, gamified badges | **Skip** |

## 6. The 5 riskiest assumptions, each with a cheap test

| # | Assumption | Cheap test |
|---|---|---|
| 1 | One capture button beats his current "photo to Claude chat" flow on speed. If it takes more than about 20 seconds from camera to a usable answer, he will go back to the chat. | Prototype test: time 5 machines with a stopwatch, app route against his usual route. |
| 2 | 20 AI requests a day is enough when the app spends them on photos and hard questions and the rules do the rest. | Count questions he asks in a normal gym day (a week of his chat history is enough). If it is over 15, add the Claude route as the default. |
| 3 | The coach's advice, given only the context pack, is better than the same question without it. | Ask Claude the same 5 questions with and without a hand built pack. He picks which answer he would follow. |
| 4 | Soreness and measurement entry takes under 10 seconds, so he keeps doing it. | Log soreness each morning for a week. If fewer than 5 of 7 days, simplify to one tap. |
| 5 | The recomposition view tells him something true. Waist, weight and strength together move the right way over 4 weeks while protein is hit. | Measure waist, weight and a top set on day 1 and day 28. If the view is flat while his mirror changed, the signals are wrong and photos should lead. |
