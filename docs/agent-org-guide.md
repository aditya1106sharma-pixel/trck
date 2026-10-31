# Running an agent organization for TRCK

A plain guide to the pieces, then five short lessons. Each lesson has one exercise you do yourself. Do them in order. Say "next" to Claude to start the next one.

## The pieces in one table

| Piece | What it is | Use it when | In this repo |
|---|---|---|---|
| CLAUDE.md | Memory. Read at the start of every session. | A rule must hold every time, for every agent. | `CLAUDE.md` |
| Skill | Know how. A folder with a SKILL.md that Claude loads only when the task matches. | A method you want done the same way (write a PRD, audit a design). | Hallmark, pm-skills (installed at user level, `~/.claude/skills`, plugins) |
| Command | A saved prompt you start with a slash. | You type the same request often. | `.claude/commands/*.md`: `/feature`, `/research`, `/prd`, `/design-check`, `/review`, `/ship`, `/weekly` |
| Subagent | A specialist with its own context window, tools and instructions. | A job is big, or needs fresh eyes, or must not be able to edit. | `.claude/agents/*.md`: product-lead, designer, engineer, reviewer, qa, nutrition-check |
| Hook | A script the harness runs on an event, every time, no matter what Claude thinks. | A rule must never be broken (never commit a key). | `.claude/settings.json` (Lesson 4 adds one) |
| MCP | A connection to an outside system through tools. | Claude needs to read or act somewhere else (GitHub, Drive). | GitHub MCP in cloud sessions |

Rule of thumb: memory says what is true, skills say how, commands say what to do now, subagents do it in their own room, hooks enforce, MCP connects.

## Reinstalling the user level tools in a fresh cloud session
Cloud sessions start empty, so user level installs vanish. Ask Claude: "Reinstall Hallmark, pm-skills (pm-product-discovery, pm-market-research, pm-execution) and gstack with `--prefix`, as in docs/agent-org-guide.md." The steps it should follow:
- Hallmark: clone github.com/Nutlope/hallmark and copy `skills/hallmark` to `~/.claude/skills/hallmark`.
- pm-skills: `claude plugin marketplace add <clone of github.com/phuryn/pm-skills>`, then `claude plugin install pm-execution@pm-skills --scope user` and the same for the other two.
- gstack: clone to `~/.claude/skills/gstack`, then `./setup --prefix --no-team --no-timeline-stop-hook`. The prefix keeps its `/review` and `/ship` from clashing with ours. Never run its team mode here: it edits CLAUDE.md and `.claude/`.

---

## Lesson 1. What each piece is, with real files

**CLAUDE.md is memory.** Open `CLAUDE.md`. "The day rolls over at 5 am" is there because every agent, every time, must know it. Keep it short: facts and rules only, no how-to essays. If a line is only needed for one kind of task, it belongs in a skill or a command instead.

**A command is a saved prompt.** Open `.claude/commands/review.md`. Seven lines. Typing `/review` is the same as pasting them. `$ARGUMENTS` is whatever you type after the slash.

**A subagent is a specialist with its own room.** Open `.claude/agents/reviewer.md`. The top says `tools: Read, Grep, Glob, Bash`. No Edit, so the reviewer cannot "fix" what it should only report. It starts with a clean context, so it reviews with fresh eyes instead of defending code it wrote.

**A skill is know how loaded on demand.** Hallmark lives in `~/.claude/skills/hallmark/SKILL.md`. Its description says when to use it. Claude reads only the description until a task matches, so 60 skills cost almost nothing until used.

**A hook always runs.** CLAUDE.md asks; a hook enforces. "No key in git" is a request in CLAUDE.md. In Lesson 4 it becomes a hook that blocks the commit.

**MCP is a connection.** In the cloud session, the GitHub tools (`mcp__github__*`) are MCP. They let Claude open a PR or read CI without a password in the repo.

**Exercise.** Open `.claude/commands/research.md` and `.claude/agents/product-lead.md` side by side. Write one sentence for each: who does the work, and what it is allowed to touch. Then type `/research a rest timer in Train` in a new session and watch which skills it loads.

---

## Lesson 2. An org chart for TRCK

| Team | Job | Our agent or command | gstack role (prefixed) | Missing? |
|---|---|---|---|---|
| Product | Research, PRD, say no | product-lead, `/research`, `/prd` | `/gstack-office-hours`, `/gstack-plan-ceo-review` | no |
| Design | Brief, screens, audit | designer, `/design-check` (Hallmark), `/design-pass` | `/gstack-plan-design-review`, `/gstack-design-review` | no |
| Engineering | Build, review | engineer, reviewer, `/feature`, `/review` | `/gstack-plan-eng-review`, `/gstack-review` | no |
| QA | Real browser at phone size | qa | `/gstack-qa`, `/gstack-qa-only` | no |
| Growth | Friends, onboarding, guide | none yet | none | **yes**: create `growth` |
| Data | Usage and nutrition checks | nutrition-check, `/weekly` | `/gstack-retro` | **yes**: create `data` for usage |

Rules for a new agent: a description that says exactly when to use it, the fewest tools that do the job, and one output. Example for growth: tools Read, Grep, Glob, Write; writes only `docs/friends-guide.md` and onboarding copy; never code.

**Exercise.** Before Claude creates them, write the one line description you would give `growth` and `data`. Compare with what Claude writes.

---

## Lesson 3. Agents in parallel, safely

Two agents editing the same folder can overwrite each other. A git worktree is a second checkout of the same repo in another folder, on its own branch. Each agent gets its own worktree, so they cannot collide.

- Start: `git worktree add ../trck-timer -b feat/timer`, and run the agent there. In Claude Code, the Agent tool's `isolation: "worktree"` does this for you.
- Review: read the diff (`git diff main...feat/timer`), run `/review` in that worktree, run the tests there, then merge one branch at a time.
- Clean up: `git worktree remove ../trck-timer`.
- Split work by files, not by feature words. In 0.6.0 the engineer owned `plan.ts`, `catalog.ts` and `Train.tsx` while photo work owned `photo.ts`, `Today.tsx` and `supabase/`. The shared file (`types.ts`) was changed first, before anyone started.

**Exercise.** Give two agents two small tasks (a rest timer, a waist chart) in two worktrees. Merge them yourself and note any conflict.

---

## Lesson 4. Hooks and a weekly scheduled task

- A `PreToolUse` hook on Bash that blocks any `git commit` when the staged files include `my-data.json`, a `.env` file, or text that looks like a key (`AIza...`, `sk-...`, `service_role`).
- A weekly scheduled task that runs `/weekly` on your exported log every Sunday evening and writes the review to a file you read on Monday.

**Exercise.** Try to commit a file named `my-data.json`. The hook should stop you with a plain message.

---

## Lesson 5. Measure the org, and kill a feature

For each feature, log three things for two weeks: did I use it (count), did it save time (seconds, before and after), did it change a number I care about (protein days hit, sessions a week). Write them in `docs/friction.md`.

Kill rule: if a feature is used less than twice a week for two weeks, or makes a key result worse, remove it. Write a two line note in the roadmap's Not doing list saying why. Removing is a success: fewer taps is the product.

**Exercise.** Pick one 0.6.0 key result from the PRDs and set a phone reminder to check it in 14 days.
