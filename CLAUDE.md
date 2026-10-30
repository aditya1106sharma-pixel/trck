# TRCK

Aditya's personal recomposition tracker. Single user, free to run, local first. Goal: 60 days, 140 g protein, 3 to 4 full body sessions a week, fewer cigarettes and cups of tea or coffee. It must be a joy to open at 11 pm in a gym.

## Stack
Vite + React 18 + TypeScript (strict) + Vitest. No backend. Data lives in localStorage under `trck:v1`, with JSON export and import. PWA with a cache first service worker. Hosting is free static (GitHub Pages, Cloudflare Pages or Vercel).

## Commands
- `npm run dev` runs the app
- `npm test` runs logic tests. `npm run build` type checks and builds
- Run all of `npm test && npm run build` before saying anything is done

## Layout
- `src/lib/` pure logic with no React: score, muscles, fuel, stats, prompt, store, catalog, dates. All rules live here and every rule has a test in `lib.test.ts`
- `src/screens/` one file per tab. `src/ui/` shared pieces. `src/styles.css` is the whole design system
- `docs/design-brief.md` is the design source of truth. `docs/roadmap.md` is what comes next

## Rules that must not break
- Data names in `src/lib/types.ts` match the old prototype export. Never rename a stored field. Add new ones as optional and default them in `normDay`
- The day rolls over at 5 am, so a 1 am session belongs to the day before. Use `todayKey`, never `new Date()` for day keys
- Score is 100 points: protein 30, training 20, supplements 20, habits 20, water 10. A streak day is 60 or more. Change a rule and its test together
- A muscle is trained on a day at 2 or more effective sets (main 1, helper 0.5) and is Ready 48 hours after the usual finish hour
- Nutrition numbers are rough. Never present them as medical advice. No health claims
- Free only. Do not add a paid service, a required API key or a server without asking Aditya
- No emoji, no purple gradients, no glass cards, no stock illustrations. Read the design brief before touching CSS

## Style
Plain sentences, no jargon in the UI, no em dashes. Numbers use the display font. Touch targets 44 px. Works at 360 px wide, light and dark.

## Working with the agents
Use the commands in `.claude/commands`: `/feature` for new work, `/design-pass` for UI, `/review` before every commit, `/ship` to release, `/weekly` to review a week of logs. Agents in `.claude/agents` are product-lead, designer, engineer, reviewer, qa and nutrition-check.
