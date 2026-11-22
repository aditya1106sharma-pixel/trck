# TRCK Gym: going live

About 30 minutes, once. Everything here is free. You need: a Google account you own (for Supabase and Google Cloud), and admin on this GitHub repo.

When it is done, the app lives at `https://<your-github-name>.github.io/trck/gym/` and the join link is `…/gym/#/join/<slug>`.

## 1. Make the database (Supabase, free)
1. Go to supabase.com, sign in, **New project**. Name it `trck-gym`. Region **Mumbai (ap-south-1)**. Save the database password in your password manager. This is a second project, separate from TRCK's. The free plan allows two.
2. Open **SQL Editor**, **New query**, paste all of `supabase/gym/schema.sql`, press **Run**. It should say "Success. No rows returned".
3. New query again, and make the gym. Change the four values:
   ```sql
   select setup_gym('forge', 'Forge Fitness', 'owner.gmail@gmail.com', '+919800000000');
   ```
   - `forge` is the slug in the join link: lowercase letters, numbers and dashes.
   - The email is the Gmail your friend will sign in with. He becomes the main owner.
   - It also makes four starter plans (Monthly ₹1,500, Quarterly ₹4,000, Half year ₹7,000, Yearly ₹12,000). He can change them in the app.
4. Add yourself as an owner too, so you can help and debug:
   ```sql
   insert into staff (gym_id, email, role, name)
   select id, 'your.gmail@gmail.com', 'owner', 'Aditya' from gyms where slug = 'forge';
   ```

## 2. Turn on Google sign in
1. Go to console.cloud.google.com, make a project called `TRCK Gym`.
2. **APIs and Services, OAuth consent screen**: External. App name `TRCK Gym`, your email as support and developer contact. Scopes: leave the defaults (email, profile, openid). Then **Publish app** so it is "In production". With only these basic scopes Google does not need to review it, and any member can sign in.
3. **Credentials, Create credentials, OAuth client ID**: type Web application. Under **Authorized redirect URIs** add
   `https://<project-ref>.supabase.co/auth/v1/callback` (the project ref is in your Supabase URL).
4. Copy the Client ID and Client secret.
5. In Supabase: **Authentication, Sign In / Providers, Google**: enable, paste both, save.
   Then open **Email** on the same page and turn it **off**. Google is the only way in. Leaving email sign up on would let someone register with the owner's address if email confirmation were ever switched off.
6. In Supabase: **Authentication, URL Configuration**:
   - Site URL: `https://<your-github-name>.github.io/trck/gym/`
   - Redirect URLs: add the same address, and `http://localhost:5174/**` for local testing.

## 3. Connect the app
1. Supabase, **Project Settings, API Keys**. Copy the **Project URL** and the **anon public** key (under Legacy API keys if you see two tabs). Both are safe to be public: the database rules decide what anyone can see.
2. GitHub repo, **Settings, Secrets and variables, Actions, Variables tab**, add three **variables** (not secrets):
   - `VITE_GYM_SUPABASE_URL` = the Project URL
   - `VITE_GYM_SUPABASE_ANON_KEY` = the anon key
   - `GYM_SLUG` = `forge` (used by the keep alive job)
3. Merge the gym branch into `main`. The **Deploy to GitHub Pages** action builds TRCK and the gym app together.
4. Run **Actions, Gym keep alive, Run workflow** once. It should end green with "Supabase answered 200". From then on it runs twice a week, so the free project never pauses.

## 4. Check it works (10 minutes, with your friend)
- [ ] Owner opens `…/trck/gym/`, taps **Continue with Google**, lands on **Today**.
- [ ] More, **Copy link**. Open it in a private window on another phone. Fill the form with a real number.
- [ ] Back on the owner phone, Requests shows it. Open it, **Approve and start a plan**, record a payment.
- [ ] The welcome message appears. **Open WhatsApp** opens his WhatsApp with the message typed. He presses send.
- [ ] The member signs in with the Gmail they gave on the form and sees days left and the payment.
- [ ] More, Insights shows the visit and the request.
- [ ] Print the QR code from More for the front desk.

## Run it on your laptop
```bash
cp .env.example .env.local   # then fill in the two VITE_GYM_ values
npm run dev:gym              # opens on http://localhost:5174
```
Join form: `http://localhost:5174/#/join/forge`.

## If something fails
See `docs/gym/runbook.md`, or open Claude in this repo and type `/gym-debug` with what you saw.
