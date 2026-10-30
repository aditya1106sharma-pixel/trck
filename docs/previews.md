# Branch previews with Cloudflare Pages (free)

Every branch and pull request gets its own web address, so you can try a change on your phone before it goes live. GitHub Pages stays as production. Cloudflare is only for trying things.

## One time setup (about 5 minutes)
1. Go to dash.cloudflare.com and sign in. A free account is enough.
2. Workers & Pages, Create, Pages, Connect to Git. Pick the `trck` repo.
3. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Environment variables, add these to both Production and Preview:
   - `NODE_VERSION` = `20`
   - `VITE_SUPABASE_URL` = the same value as in GitHub
   - `VITE_SUPABASE_ANON_KEY` = the same value as in GitHub
5. Save and deploy.
6. Project, Settings, Builds, Production branch: change it to `cf-production`, a branch that does not exist. Then only previews are built and `main` is not published a second time.
7. Same page: Branch deployments, set to "All non-production branches".

## How you use it
- Push a branch (or open a pull request) and Cloudflare builds it. The web address looks like `<branch>.trck-xxx.pages.dev`. Cloudflare posts it on the pull request.
- Each preview is a separate site, so it has its own empty data. Sign in with your account to see your log, or use Restore or import.
- Sign in works on previews with no extra setup, because TRCK uses email and password.

## Good to know
- Anyone with a preview address can open it. The app holds no personal data until you sign in.
- Cloudflare previews are not the live app. Friends only ever get the GitHub Pages address.
