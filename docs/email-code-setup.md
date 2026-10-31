# Passwordless sign in: what to set in Supabase

TRCK signs you in with an emailed link, with no password. Type your email on the Sign in screen, tap Email me a sign in link, open the email on the same phone, tap **Sign in**, and you are in.

## One setting is needed: where the link may return to
1. Supabase, your project, **Authentication**, then **URL Configuration**.
2. **Site URL:** `https://aditya1106sharma-pixel.github.io/trck/`
3. **Redirect URLs:** add `https://aditya1106sharma-pixel.github.io/trck/`
4. Save. Without this the link opens the wrong address.

## Tips
- Open the email in the same browser you use for TRCK. On an iPhone, a TRCK icon added to the home screen keeps its own storage, so sign in inside that icon and use the code box if your email has a code.
- Supabase's built in email sender allows only about 2 emails an hour and only delivers to your project team. That is fine for you. Do not tap Send again more than once or twice.
- The link works once and expires soon.

## Optional: a code instead of a link
The built in sender cannot change the email wording (Supabase says so on the template page: "Set up custom SMTP to edit templates"). If you later connect a free email service (see `docs/password-reset-setup.md`, step 3), you can edit the **Magic link or OTP** template to include `{{ .Token }}`, and the code box on the Sign in screen will work. Until then, use the link.

Your old password still works under "Use a password instead".
