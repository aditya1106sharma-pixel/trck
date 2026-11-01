# Switch on the trainer chat (one function, about 5 minutes)

The Trainer on Train answers inside TRCK using the same Gemini key you set up for meal photos. Until this is done it says "The trainer is not switched on yet" and offers the Claude app instead, so nothing breaks.

Everything else is already in place: the key (`GEMINI_API_KEY`), the model (`GEMINI_MODEL`), your allow list (`ALLOWED_USERS`) and the address (`ALLOWED_ORIGIN`). You do not need to run any SQL. The daily count is shared with meal photos, because Google's free limit is one pool for the whole project.

## Steps
1. Supabase, **Edge Functions**, **Deploy a new function**, **Via editor**.
2. Name it exactly `coach`. No other characters, and no trailing hyphen.
3. Replace the starter code with all of `supabase/functions/coach/index.ts` from GitHub. It is one file, there is nothing else to add.
4. **Deploy**.
5. Open the new function's **Settings** and turn **Verify JWT with legacy secret** off, then **Save changes**. The function checks who you are itself.
6. Check the URL on the Settings page ends `/functions/v1/coach`.

## Test it on your phone
1. Reload TRCK twice. Plan should show the new version number.
2. Sign in under Plan, Sync, if you are not already.
3. Train, then the **Trainer** box. Type "Yesterday I did leg press, 3 sets of 10 at 60" and tap **Send**.
4. You should get a short answer and a box that says "I want to make 2 changes" or similar. Check the list. Tap **Agree and apply**. Open the day before to see it logged.

## Good to know
- **20 messages a day.** Your AI Studio page shows 20 requests a day for the project. Each message uses one, and so does each meal photo. The Trainer header shows how many you have used. When they run out it says so and keeps your question for the Claude app.
- **Never turn on billing** for the `TRCK` Google project. Without a card the free limit simply stops, which keeps this free.
- **The trainer only proposes.** Changes are applied after you tap Agree and apply, never before. It adds sets, notes and soreness. It never deletes or overwrites your log.
- **Clips** still go through the Claude app. Photos go to the trainer.
- **Privacy.** A photo is sent to Google Gemini to answer. On the free plan Google may use it to improve its models, and people there may read it. TRCK keeps no copy. Body photos are not part of this release and will stay on your phone.
- **If it says "The trainer could not answer this time"**, open the function's **Logs** tab in Supabase, copy the latest error and send it to me.
