# TRCK

A free tracker for a 60 day recomposition: protein and food, lifts with progressive overload, muscle coverage and recovery, habits, and a barbell score.

## What it runs on (all free)
- Front end: Vite, React, TypeScript. Installable web app (PWA), works offline.
- Hosting: GitHub Pages, deployed by GitHub Actions on every push to main.
- Backend (optional): Supabase free tier. Email and password login, one Postgres table with row level security. Without it the app still works and keeps data on the device.

## Run locally
```
npm install
npm run dev
npm test
npm run build
```

## Go live
1. Create a GitHub repo named `trck`, push this folder to `main`.
2. Repo Settings, Pages, Source: GitHub Actions.
3. Your app is at `https://<your-username>.github.io/trck/`. On the phone open it in Chrome, menu, Add to Home screen.

## Turn on sync
1. supabase.com, New project (free). Authentication, Providers, Email: turn off "Confirm email" (single user is simpler).
2. SQL Editor: paste `supabase/schema.sql` and run it.
3. Project Settings, API: copy the Project URL and the anon public key.
4. GitHub repo, Settings, Secrets and variables, Actions, Variables tab: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Re-run the deploy.
5. In the app: Plan, Sync, Create account. Do the same on the phone with the same login.

First time: on the laptop, Plan, Restore or import, choose `my-data.json`. It syncs up and appears on the phone.

## Checks and previews
- Pull requests run typecheck, logic tests, the build and a browser smoke test (`.github/workflows/ci.yml`). Run the browser test yourself with `npm run build` then `npm run test:e2e`. The first run needs `npx playwright install chromium`.
- Branch preview addresses: see `docs/previews.md`.
- The app shows its version at the bottom of Plan. When a new version is deployed, an "Update ready" bar appears. Tap it to reload.
- Stored data carries a schema version. Before an import or an upgrade, the app keeps a copy of the old data on the device (the last five).

## Work on it with Claude Code
Open this folder in Claude Code. `CLAUDE.md` explains the project. Commands: `/feature`, `/design-pass`, `/review`, `/ship`, `/weekly`. Agents live in `.claude/agents`. See `docs/claude-code-kickoff.md` for the starter prompt.
