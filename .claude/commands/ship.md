---
description: Test, bump the version, update the changelog, commit and push so GitHub Pages deploys
argument-hint: <what changed, in a sentence>
---
Ship: $ARGUMENTS

1. Run `npm test && npm run build`. Stop and report if anything fails.
2. Run the reviewer agent on the diff. Fix serious findings first.
3. Bump the patch version in package.json (minor if a new feature, ask me before a major). Keep package-lock.json in step.
4. Add a dated entry to CHANGELOG.md in plain words: what a user will notice.
5. Commit with a clear message, push to main, then wait for the Pages workflow and tell me the live URL and whether it went green. Use `gh run watch`.
6. Check the live page: the Plan tab shows the new version number at the bottom. On the phone, the app shows "Update ready, tap to reload" within a minute of opening it. Tap it. No double reload is needed.
