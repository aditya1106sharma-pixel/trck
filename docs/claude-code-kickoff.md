# Starter prompt for Claude Code

Open this folder in Claude Code (desktop app, Code tab), then paste everything inside the box.

```
You are the lead engineer and product partner for TRCK, my recomposition tracker. Read CLAUDE.md, README.md, docs/design-brief.md and docs/roadmap.md first, then do the following in order. Ask me only when something needs my login or a decision only I can make.

GOAL: I want to iterate on TRCK many times a week, deploy each version in under two minutes, use it daily on my phone, and later hand it to friends without breaking my own data.

1. GET IT LIVE
   - Check git status. If there is no repo, init it, make a private-by-default plan: public repo named trck (the repo holds no personal data; my-data.json is gitignored). Use the gh CLI to create it and push to main. If gh is missing or not logged in, tell me the exact command to run and wait.
   - Make sure the Pages workflow in .github/workflows/pages.yml exists (run setup.ps1 if _setup still exists), enable Pages with Actions as source, and give me the live URL once it is green.
   - Walk me through Supabase sync using README.md, one step at a time, and verify it by checking the app build with the two variables set.

2. BUILD THE SHIPPING SYSTEM
   - Release flow: /ship already exists. Test it end to end with a trivial change. Make sure every deploy shows the version number from package.json at the bottom of Plan, so I can see which version my phone is running.
   - Auto update: make the service worker update cleanly. When a new version is deployed, the app shows a small "Update ready, tap to reload" bar instead of needing two reloads.
   - Safety net for data: before any change that touches stored fields, add a schema version and a migration function in src/lib/store.ts with a test. Add an automatic local backup (keep the last 5 snapshots in localStorage) before every import or migration.
   - Quality gate: GitHub Action on pull requests that runs typecheck, tests and build. Add a Playwright smoke test (load, log a food, reload, value persists, 400 px, light and dark) to docs/qa and to CI.
   - Branch previews: set up Cloudflare Pages (free) so every branch gets its own preview URL, and tell me the setup steps. Keep GitHub Pages as production until I say otherwise.

3. MAKE IT SHAREABLE
   - Multi user is already supported by Supabase auth and row level security. Review supabase/schema.sql and src/lib/sync.ts for what breaks with many users (rate limits, conflicts, password reset, deleting an account) and list the fixes in docs/roadmap.md ordered by risk.
   - Add a first run screen for new users: set protein target from body weight, pick a start date, and skip the prototype data. Test that a new account starts clean.
   - Write a one page docs/friends-guide.md in plain words: what it is, how to install on a phone, how to back up.

4. WORK LOOP FROM NOW ON
   - Every idea I give you goes through /feature. Every UI change goes through the designer agent and gets screenshots in light and dark at 400 px. Every release goes through /review then /ship.
   - Keep docs/friction.md. When I tell you something annoyed me while logging, add a line with the date and fix the top item first.
   - Keep CHANGELOG.md in plain words a friend would understand.

RULES: free services only, no paid keys, no server I have to maintain. Never rename stored fields. Never commit my-data.json, .env.local or any key. Explain each step in a sentence before you do it, and keep answers short.

START by doing step 1 and report back with the live URL.
```

## Why this order
Live first, because a real URL on your phone teaches you more than any plan. Then the shipping system, so each later change is cheap and safe. Then sharing, because friends will find the bugs your own data hides.
