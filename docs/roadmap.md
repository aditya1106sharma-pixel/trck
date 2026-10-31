# Roadmap

## Now (v0.1)
Today, Train, Muscles, Fuel, Progress, Plan. Local only, backup and restore, installable on a phone, works offline.

## Next, in this order
1. Use it for a week. Write down every moment of friction in `docs/friction.md`.
2. Rest timer and a "repeat last session" button in Train.
3. Free sync between phone and laptop: Supabase free tier with email login, behind the storage adapter in `src/lib/store.ts`. Needs Aditya to create the project.
4. Body photos once a week, stored locally, side by side at day 1, 30 and 60.
5. AI review inside the app with the user's own key stored on the device (optional, off by default).
6. Friends: share a read only weekly summary link. Only if friends actually ask.

## Before friends sign up: what breaks with many users
Reviewed from `supabase/schema.sql` and `src/lib/sync.ts`, ordered by risk. Nothing here is fixed yet unless it says so. Supabase limits change, so check their current free tier page before relying on a number.

### High
1. ~~Signing out leaves the log on the device, and the next person to sign in gets it merged into their account.~~ Fixed in 0.4.1, see Done below.
2. **Two devices syncing at the same moment can lose an edit.** Sync reads the row, merges, then writes with no check that the row is unchanged, so the last write wins. Fix: add a `rev` number to the table, write only if `rev` still matches, and on a clash read again, merge again and retry. Add a test for the merge on retry.
3. **A forgotten password cannot be recovered.** There is no reset screen, and Supabase's built-in email sender allows very few emails an hour. Because Confirm email is off, a typo in the email address at sign up also locks the person out for good. Fix: add Forgot password (`resetPasswordForEmail` and a screen for choosing a new one), set the Site URL and redirect URL in Supabase to the live address, and use a free custom email service for sending. Needs Aditya to create that account.
4. **A free Supabase project pauses after about a week with no activity.** After that, nobody can sign in until it is restored by hand. Fix: a weekly GitHub Action that makes one harmless request to the project, and a line in the friends guide saying to keep a backup.

### Medium
5. **No way to delete an account or the cloud copy.** The table has no delete policy, and the app cannot delete a login. Friends need this. Fix: a database function `delete_my_account()` that removes the login (the row goes with it), a delete policy for the row, and a Delete account button in Plan that offers a backup download first.
6. **Anyone with the public key can create accounts, and a row can grow without limit.** Fix: a size check on `data` (about 1 MB), keep Supabase's sign up rate limits on, and add a free bot check (Cloudflare Turnstile) or an invite code only if sign ups get abused.
7. **A phone with the wrong clock wins every edit.** Merging trusts each device's own time (`u` and `su`). Fix: ignore any time more than a day ahead of now, and test it.
8. **The whole log is rewritten on every change, so the row grows with use.** Roughly a few KB per logged day, so a year is probably around a megabyte. Fine for now. Fix, only if it gets slow: store one row per month.

### Low
9. `updated_at` is set by the phone. Let the database set it with a trigger.
10. Sync errors show Supabase's raw words, and a failed sync is not retried until the next edit or the app coming back to the front. Show plain messages and retry after a minute.
11. Reset targets puts protein back to 140 and calories to 2400, which are Aditya's numbers. Reset to the numbers chosen at setup instead.
12. The project owner can read every saved log in the Supabase dashboard, because nothing is encrypted for the person alone. The friends guide says so. End to end encryption would be a large change and is not planned.

### Done
- **Sign out leak (0.4.1).** Sign out first saves to the cloud, asks, ends the session, then clears the device and keeps a copy. The app also remembers whose log is on the device (`trck:owner`). If a different account signs in on a device that still holds someone else's log, even after a session simply ran out, that log is copied aside and the device starts empty instead of merging. Copies are listed under Your data in Plan with a Download button. Gap: a log that was on a device before owners were tracked counts as the next person's to adopt, so the first sign in on such a device still takes it. The sign out flow was tested by logic tests only, not against a real account.

### Done in 0.4.0
- First run screen: protein target from body weight, a start date, no one else's data. A new account on a clean device starts with no logged days (on a device that still holds someone else's log, see High item 1). Anyone with days, changed settings, or a finished setup never sees it. A signed-in person waits for their cloud log to load first. A new phone that only has a backup file restores it from Plan after tapping Start.

## Not doing
Calorie database search, barcode scanning, social feed, notifications that nag.
