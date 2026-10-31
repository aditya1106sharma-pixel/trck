# Turn on password reset

The app side is built: Sign in, then **Forgot password?**, sends a link that opens a "New password" screen. Two things in Supabase must be set before it works, and a third before friends can use it. Only you can do these, because they need your Supabase login.

## 1. Tell Supabase where the link may return to (2 minutes)
Without this the email link goes to the wrong address.
1. Supabase, your project, **Authentication**, then **URL Configuration**.
2. **Site URL:** `https://aditya1106sharma-pixel.github.io/trck/`
3. **Redirect URLs:** add `https://aditya1106sharma-pixel.github.io/trck/`
4. Save.

If you later want it to work on Cloudflare preview addresses, add those here too.

## 2. Try it yourself
Supabase's built in email sender is enough for your own address.
1. In the app: Plan, Sync, Sign out. Then Sign in, **Forgot password?**, type your email, **Email me a link**.
2. The email can take a few minutes. Check spam.
3. Open the link. It works on any device, not only the one that asked. You should land on **New password**. Choose one and tap Save. You end up signed in.

If the email never arrives, or the link opens the app without the New password screen, tell me exactly what you saw.

## 3. Let friends receive the email (needed before you share the app)
Supabase's own documentation says the built in sender only delivers to addresses on your project's team, is limited to 2 emails an hour, and is not meant for real use. So a friend's reset email would not arrive. You need a free email service connected to Supabase.

1. Create an account with an email service that offers SMTP. Options I looked at:
   - **Brevo.** Its help centre says the free plan allows 300 emails a day. I could not confirm whether you can send without owning a domain (a single verified sender address may be enough). Check their sender settings page.
   - **Resend.** Third party sources say about 100 a day on the free plan. I could not confirm whether it will send to other people without a domain you own. Check their docs.
   - **Gmail with an app password.** Works with SMTP if the account has 2 step verification on. I did not look up current limits.
2. In Supabase: **Authentication**, then **Emails**, then **SMTP Settings** (the name may differ slightly). Turn on custom SMTP and fill in the host, port, user and password from the service, plus a sender address and a sender name such as "TRCK".
3. With custom SMTP, Supabase starts at 30 emails an hour. That is plenty. You can change it under Rate Limits.
4. Run step 2 again with a friend's address, or one of your own that is not your Supabase login.
5. Mail from a free sender address often lands in spam. Tell friends to look there.

## 4. After it works for a friend
Tell me and I will update `docs/friends-guide.md`. Today it still says there is no password reset, which is true until step 3 is done.

## Good to know
- The reset link proves you own the email address, so it also lets someone with access to that inbox take over the account. That is how every reset works.
- A reset does not lose any data. The log stays in the account and on the device.
- The app asks for at least 6 characters because that is Supabase's minimum. You can raise it under Authentication, Providers, Email if you want longer.
