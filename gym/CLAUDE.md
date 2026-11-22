# TRCK Gym

A web app for a friend's gym, built next to TRCK. Members fill a public join form, the owner approves and records plan and payment, and every reminder is a prefilled WhatsApp message the owner sends from his own phone. Members sign in with Google to see their plan. Free to run: no WhatsApp API, no SMS, no paid service.

## Stack and layout
- Same toolchain as TRCK (Vite, React 18, TypeScript strict, Vitest, Playwright). Built by `gym/vite.config.ts` into `dist/gym`, deployed with TRCK to GitHub Pages at `/trck/gym/`.
- `gym/src/lib/` pure logic, all tested in `gym/src/lib/gym.test.ts`: phone, dates, money, status (where a client stands), messages (templates), join (form rules), csv, insights, errors. `types.ts` mirrors the database.
- `gym/src/api.ts` is the only file that talks to Supabase. Screens never build queries.
- `gym/src/screens/`: Join (public), Access (sign in, no access, client home), Owner (shell, Today, Requests), Clients, More (Money, settings, insights).
- `gym/src/ui/`: bits (router, sheet, fields, toast, QR, error boundary), forms (plan, payment, WhatsApp message).
- `supabase/gym/schema.sql` is the whole database: tables, row level security, and the functions the app calls. `supabase/gym/test/` runs it against a real local Postgres.
- Docs: `docs/gym/setup.md` (go live), `docs/gym/runbook.md` (problems and limits).

## Commands
- `npm run dev:gym` runs the gym app on port 5174
- `npm test` logic tests (TRCK and gym). `npm run test:db` schema and access rule tests. `npm run build` builds both apps
- `npm run test:e2e` builds with a fake Supabase and runs `docs/qa/gym.spec.ts` with TRCK's tests
- Run `npm test && npm run test:db && npm run build` before saying anything is done. Run `npm run test:e2e` after UI changes

## Rules that must not break
- Access is enforced in the database. A new table gets row level security and tests in `rls.sql` for owner, staff, another gym, a client and someone signed out. Never rely on the app hiding something
- Members and the public never read tables. The public uses `join_info` and `submit_join_request`; members use `whoami` and `my_home`
- Memberships and payments are written only through the SQL functions. Nothing is deleted: payments are voided with a reason, plans cancelled, clients archived
- `membership_end` in SQL and `membershipEnd` in `dates.ts` must agree. Both are tested on the same four cases
- Dates are 'YYYY-MM-DD' in the gym's time zone (`todayIn`), never `new Date()` for a day
- Money is whole rupees, shown with `inr()` (₹1,48,000)
- Phones are stored as +91XXXXXXXXXX via `normalizePhone`
- Never rename a column. Add new ones as nullable with a default, in a new migration file, with tests
- The app never sends a message by itself. It fills a template, the owner presses send
- No paid service, SMS or WhatsApp API without asking Aditya
- Same design rules as TRCK: read `docs/design-brief.md`. Plain words, no emoji, 44 px targets, works at 360 px, light and dark

## Debugging
Use `/gym-debug`. App errors are in the `app_errors` table and on More, Insights. Every data change is in `activity`.
