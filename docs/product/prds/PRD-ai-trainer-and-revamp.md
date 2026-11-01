# PRD: AI trainer in Train, and the app revamp

**Status: Draft.** Waiting for Aditya to pick a design direction and the first slice. Not approved to build.
Research: [ai-trainer-revamp.md](../research/ai-trainer-revamp.md). Designs: see the prototype link in the reply that delivered this.

## 1. Summary
Replace the long Train list with a trainer. One capture button takes a photo of a machine, a clip, a sentence or a soreness note. The app answers with your week in mind and writes the log when you say you did it. Body measurements and local photos feed a recomposition view, so the loop from training, food and supplements to your body is visible.

## 2. Background
Aditya got better results at the gym by sending Claude a photo, a name or a video than by using TRCK, because TRCK has no way to ask. He pays in taps and scrolling. The pieces exist: Ready and weekly sets (`muscles.ts`), the session planner (`plan.ts`), the photo pipeline and quota (`meal-photo`), the Claude route. What is missing is the conversation, the context, the soreness and body signals, and a faster logging screen.

## 3. Objective
Cut the time from "new machine" to "logged and knowing what to push" to about 20 seconds, and make the body trend visible.
Key results after 2 weeks:
- KR1: median time from tapping capture to a usable answer is 20 seconds or less (stopwatch, 5 machines).
- KR2: at least 3 of 4 gym sessions are logged through the coach or session mode, not the old list.
- KR3: soreness logged on at least 5 of 7 days in a week, measurements taken on schedule.
- KR4: the app never uses more than 20 AI requests a day, and the Claude route works when it runs out.

## 4. Market segment
One person: Aditya, skinny fat, recomposing, 3 to 4 gym sessions a week at Cult SG Palya and Jayanagar, often trying new machines, using one hand at 11 pm. Later, friends, only if they ask.

## 5. Value proposition
- **Who:** Aditya in the gym, mid session, one hand free.
- **Why:** try a new machine or exercise safely, rest what is tired, push what is ready, without asking a person.
- **What before:** photo to a Claude chat, retype the week each time, write the log by hand.
- **How:** a capture button plus a context pack of his week, answers as cards, a Log button.
- **What after:** one tap from "what is this machine" to a logged set, with a reason to rest or push, and a body trend that shows it working.
- **Alternatives:** paid scanners and coaches (Gym AI, WHOOP Coach), or his own chat with Claude.

## 6. Solution

### 6.1 Navigation (the revamp)
Five tabs, each doing one job, instead of six lists:
- **Today:** the score, one next action, protein and habits. Fewer sections, no long scroll.
- **Train:** the trainer. Today's session, the capture bar, the coach thread, Start session.
- **Body:** Muscles map with soreness, measurements, photos, the recomposition view.
- **Fuel:** as now, with Add meal photo.
- **Plan:** settings, data, sign in.

### 6.2 Train, the trainer
1. **Capture bar** pinned above the tab bar: camera, library, mic when supported, and a text box. One tap to the camera.
2. **Context pack** (`src/lib/context.ts`, pure, tested): last 7 days of sessions, sets per muscle against range, Ready or Recovering with hours left, soreness, latest measurements and trend, protein days hit, supplements, goal. About 300 words. Attached to every question.
3. **Answers as cards:** exercise card, recommendation card (rest, swap or push, with the reason from the log), log card, note card. Each has a plain one line safety note where relevant. No card says form is right or wrong with certainty.
4. **Log by saying you did it:** "3 sets of 10 at 40" turns into a log card. Nothing writes until he taps Log.
5. **Two routes, both free:** in app (Edge Function `coach`, counter of requests left today out of 20) and Copy for Claude with the pack, paste the reply back. When one fails the other is offered with the question kept.
6. **Session mode:** one lift at a time, full screen, last time prefilled, big steppers, a rest timer, Swap, Next. Replaces scrolling nine lifts.

### 6.3 Body
- **Soreness:** tap a muscle, choose a little, a lot or sharp. A sore muscle shows as Recovering. Soreness can delay Ready, never advance it (the 48 hour rule in CLAUDE.md is unchanged). A "sharp" report adds a stop and see a doctor line.
- **Measurements:** weight, waist, chest, arms, thighs, hips on his own schedule (default every 2 weeks).
- **Photos:** front, side, back, kept on the phone only. Side by side compare. Never sent to AI unless he taps Ask about this photo.
- **Recomposition view:** waist, weekly weight average, top set strength and protein days hit, together, with a plain note that one number proves nothing.

### 6.4 Stored fields (new, optional, never renamed)
`Day.sore` (muscle to level), `Day.meas` (measurements), `Settings.measDays`. Photos live in IndexedDB, not in `trck:v1`. The coach thread lives in its own local key, not synced. Each defaulted in `normDay` or `normSettings`, with a migration test.

### 6.5 Technology and rules to respect
Free only. The `coach` function reuses `GEMINI_API_KEY`, the sign in check and `ALLOWED_USERS`. A new server function needs Aditya's go ahead. No key in the client. No health claims. No em dashes, no emoji. Design brief to be updated with the chosen direction first.

### 6.6 Slices (each ships on its own)
1. **Context pack, capture bar, cards, Copy for Claude, paste back.** No server. Proves the loop.
2. **Soreness and measurements.** Feeds the pack.
3. **Session mode and the navigation revamp.**
4. **In app coach** (`coach` Edge Function, counter).
5. **Body photos and the recomposition view.**
6. Later: exercise images, in app video, voice.

### 6.7 Assumptions and open questions
The 5 riskiest assumptions and their tests are in [the research](../research/ai-trainer-revamp.md). Open: which direction, whether to start with slice 1, and the go ahead for the `coach` function.

## 7. Release
- First: slice 1 as 0.7.0. Then 0.7.x per slice.
- **Not doing:** paid plans, social, pose tracking, rep counting, storing body photos in the cloud, any medical claim.
