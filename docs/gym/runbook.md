# TRCK Gym: runbook

What to do when something goes wrong, and the limits to know about. Start with `/gym-debug` in Claude: it follows this page.

## Where to look first
1. **More, Insights, App problems** in the app (owner only). Every crash and failed database call is saved there with the app version.
2. **Supabase, Logs** (API and Postgres). Filter by the time it happened.
3. **Supabase, Table Editor, `app_errors`** and **`activity`**. `activity` records every change to clients, memberships, payments, requests, plans and staff, with who did it.
4. The browser console on the phone, if you can reproduce it on a laptop with `npm run dev:gym`.

## Common problems

| What they see | Why | Fix |
| --- | --- | --- |
| "No membership found" after Google sign in | The Gmail they used is not on any client or staff record | Owner opens the client, Edit, puts in that Gmail. Staff: More, Staff, add the email. Then sign in again |
| "More than one member uses …" | Two client records share one email (often family) | Give each client their own email, or clear it on one |
| Google sign in comes back to a blank page or an error | Redirect URL not allowed | Supabase, Authentication, URL Configuration: Site URL and Redirect URLs must be exactly the app address |
| "This join link is not right" | Wrong slug in the link | Copy the link again from More |
| "Too many requests right now" on the join form | 30 requests in one hour, the spam guard | Wait an hour. Raise the number in `submit_join_request` if a real event needs it |
| "Could not load" with "not connected to its database" | The GitHub variables were missing when it was built | Check the three variables, then rerun the Pages deploy |
| Everything fails, Supabase says the project is paused | No requests for 7 days | Restore it in Supabase (one click, data is kept). Check the keep alive action is green |
| WhatsApp does not open | WhatsApp is not installed on that device, or a browser blocked it | Use **Copy message** and paste it in WhatsApp |
| A payment was entered twice | Human error | Owner opens the client, Payments, **Void**, with a reason. It stays visible, crossed out |
| Wrong plan picked | Human error | Owner cancels the plan with a reason, then adds the right one |

## Limits on the free plan (late 2026, check supabase.com/pricing)
- Database 500 MB. At 100 members this app uses well under 50 MB a year.
- Pauses after 7 days with no requests. The keep alive action prevents it. GitHub turns off scheduled actions in a repo with no commits for 60 days: if that happens, re-enable it under Actions.
- **No backups you can restore.** The owner should download **More, Full backup** every week or two and keep it in Google Drive. Moving to Supabase Pro adds daily backups, but costs money: decide that with the owner first.
- Google sign in has no cost or limit that matters here.

## Restoring from a backup
The backup JSON has every table. To restore into a fresh project: run `schema.sql`, then ask Claude to write insert statements from the JSON (`/gym-debug restore from backup <file>`). Payments keep their receipt numbers.

## Changing the database later
Never edit a live table by hand without a plan. Write the change as a new file `supabase/gym/migrations/NNN-what.sql`, add tests to `supabase/gym/test/rls.sql`, run `npm run test:db`, have the db-guard agent review it, then paste it into the SQL Editor. Never rename or drop a column the app reads.

## Privacy
The app holds names, phone numbers, birth dates and health answers. Keep it that way:
- Only invited staff can read client data, enforced by the database, not just the app.
- Members see only their own plan and payments, never staff notes or health answers.
- Backups and CSVs contain all of it. Do not share them.
- If a member asks to be removed, the owner archives them and you clear their details in the Table Editor. Payments stay for the accounts.
This is a sensible setup for a small gym, not legal advice.
