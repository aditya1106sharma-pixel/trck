---
description: Audit screens against the design brief with Hallmark, at 360 px, light and dark
argument-hint: <screen or component path>
---
Design check: $ARGUMENTS

1. Read `docs/design-brief.md`. The brief wins over Hallmark wherever they disagree.
2. Run the Hallmark skill in audit mode on the named files (`/hallmark audit <path>`). Audit only, no edits.
3. Build, serve with `npx vite preview`, and screenshot the screen with Playwright at 360 px and 400 px wide, light and dark. Save to `docs/qa/screens/`.
4. Check the gym case: one hand, 11 pm, 44 px targets, thumb reach, contrast 4.5:1, nothing scrolls sideways, longest names wrap.
5. Report a punch list, most serious first, each with file and a one line fix. Then hand the fixes to the designer agent.
