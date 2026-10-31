# Switch on photo meal logging

Until this is done, Add meal photo still works: it says "Photo reading is not switched on yet" and offers the Claude prompt. About 15 minutes, all free, no card. Do one step at a time.

The key never goes in the app, in GitHub, or in a chat. It lives only as a secret inside Supabase.

## Step 1. Create the Gemini key in Google AI Studio
1. On a laptop, open https://aistudio.google.com and sign in with your Google account.
2. Accept the terms. Read the line about unpaid services: on the free tier Google may use what you send to improve its models, and people may review it. That is why the app shows its privacy line.
3. Click **Get API key**, then **Create API key**. Let it create a new Google Cloud project for it (name it `trck`).
4. Copy the key. Keep the tab open. Do not paste it anywhere except step 4.
5. Open the quota or rate limit page for the project and check that the model in step 3 has a free tier. Write down the requests a day.

## Step 2. Create the quota table in Supabase
1. Open your Supabase project, then **SQL Editor**, **New query**.
2. Paste all of `supabase/photo.sql`, click **Run**. You should see "Success. No rows returned".

## Step 3. Check the model name
1. In AI Studio, open the model picker and find the Flash-Lite model. The app uses `gemini-3.1-flash-lite` (set in `supabase/functions/meal-photo/config.ts`).
2. If AI Studio shows a different exact name (for example with `-preview`), note it for step 4. No code change is needed.

## Step 4. Store the key as a Supabase secret
1. Supabase: **Edge Functions**, then **Secrets** (or Project Settings, Edge Functions).
2. Add a secret named `GEMINI_API_KEY`, paste the key, save.
3. Only if the model name differed in step 3: add `GEMINI_MODEL` with that exact name.
4. Close the AI Studio tab. The key now lives only in Supabase.

## Step 4b. Two safety settings
1. **Never turn on billing** for the `trck` project in Google Cloud. With no card attached the free quota simply runs out and stops, which keeps this free.
2. Add a secret `ALLOWED_ORIGIN` with your site address, for example `https://aditya1106sharma-pixel.github.io`, so only your app can call the function from a browser.
3. Sign ups are open, so anyone with an account could use up the shared free quota. To limit it, add a secret `ALLOWED_USERS` with the user ids allowed to read photos, separated by commas (Supabase, Authentication, Users, copy the id). Leave it out and every signed in account gets the 20 a day cap.

## Step 5. Deploy the function
Easiest, no install: Supabase, **Edge Functions**, **Deploy a new function**, **Via editor**. Name it exactly `meal-photo`. Paste `supabase/functions/meal-photo/index.ts` into `index.ts`, add a second file `config.ts` with the content of `supabase/functions/meal-photo/config.ts`, then **Deploy**. Leave "Verify JWT" on.

Or with the Supabase CLI on your laptop: `npx supabase login`, `npx supabase link --project-ref <your ref>`, `npx supabase functions deploy meal-photo`.

## Step 6. Test it on your phone
1. Reload TRCK twice so 0.6.0 is running. Make sure you are signed in (Plan, Sync).
2. Today, **Add meal photo**, **Choose photo**, pick any food photo.
3. You should see "About ... to ... kcal" and the oil question. Tap **Cancel** so nothing is logged.
4. If it says "not switched on", check the function name is `meal-photo` and the secret name is `GEMINI_API_KEY`.

## If you ever want to turn it off
Delete the `GEMINI_API_KEY` secret. The app falls back to the Claude prompt at once.
