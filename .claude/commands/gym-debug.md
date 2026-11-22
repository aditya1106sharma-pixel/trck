---
description: Find and fix a problem in TRCK Gym. Paste what you saw, an error from Insights, or a screenshot
---
Something is wrong in the gym app: $ARGUMENTS

1. Read `gym/CLAUDE.md` and `docs/gym/runbook.md`. If the runbook's table already covers it, say so and give the fix in plain steps.
2. Work out where it lives: the public join form, sign in, owner or staff screens, the member page, or the database. Find the exact file and line. Error messages shown in the app come from `gym/src/lib/errors.ts` or from `raise exception` lines in `supabase/gym/schema.sql`, so search for the wording.
3. Reproduce it before fixing: a failing test in `gym/src/lib/gym.test.ts`, `supabase/gym/test/rls.sql` or `docs/qa/gym.spec.ts`.
4. Fix it with the smallest change. Database changes go in a new `supabase/gym/migrations/NNN-what.sql` and need the db-guard agent's review.
5. Run `npm test && npm run test:db && npm run build`, and `npm run test:e2e` if a screen changed.
6. Tell me in plain words what was wrong, what you changed, and anything I must do by hand (for example paste a migration into the Supabase SQL Editor). Never guess at data in the live database: ask me to run a read only query and paste the result.
