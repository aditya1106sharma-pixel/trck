# Email code sign in: one setting in Supabase

TRCK 0.6.1 signs you in with a code emailed to you, with no password. Supabase's default email only contains a link, not the code. Change that once.

1. Supabase, your project, **Authentication**, then **Emails** (in some versions **Email Templates**).
2. Open the **Magic link** template. This is the email an existing account gets.
3. Replace its body with:

   ```
   <h2>Your TRCK code</h2>
   <p>Type this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It works once and expires soon. If you did not ask for it, ignore this email.</p>
   ```
4. Save.
5. Do the same for the **Confirm signup** template. This is the email a brand new account gets the first time.

Notes
- Supabase's built in email sender only delivers to people on your Supabase project team, and it allows only a few emails an hour. That is fine for you alone. For friends, set up a free email service as described in `docs/password-reset-setup.md`.
- The code is 6 digits by default. The app accepts 6 to 10.
- Your old password still works under "Use a password instead".
