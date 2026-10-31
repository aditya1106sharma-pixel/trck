# Changelog

## 0.6.0 - 2026-10-31
- Train now opens with Today's session: the lifts for tonight, picked from what is Ready, what is short this week and the lifts you do most. Each lift says why it is there and what to aim for. Swap changes a lift when a machine is busy. Start this session puts those lifts at the top of Train.
- It also tells you whether your recent sessions look like full body or an upper and lower split.
- Equipment at my gym, under Lifts: turn off machines your centre does not have, and the plan will not suggest them.
- Add meal photo, on Today: take or choose a photo, add a few words, and TRCK lists the items with portions and macros, and a range, not one false exact number. It always asks how much oil, ghee or butter went in, because that is what photos miss. Nothing is logged until you tap Log meal. Your own food values are used where they match. You can save it as a favourite.
- The photo is sent to Google Gemini to be read and is not kept anywhere. On the free plan Google may use it to improve its models; the app says so before you send.
- Offline, signed out or over 20 photos a day? Copy a prompt for Claude, then paste Claude's reply back into the same screen.
- Photo reading needs a one time setup in Supabase before it works: docs/photo-setup.md. Until then the Claude route works.

## 0.5.0 - 2026-10-31
- Forgot your password? On the sign in screen, tap Forgot password, type your email, and a link is sent. The link opens a screen to choose a new password, and you end up signed in.
- An old or already used link says so in plain words instead of failing quietly.
- Sign in problems now come back in plain words, such as "Too many tries. Wait a minute."
- The email side needs setting up once before it works for friends. The steps are in docs/password-reset-setup.md.

## 0.4.2 - 2026-10-31
- Phone and laptop saving at the same moment no longer lose an edit. If another device saved first, TRCK reads its changes, adds them to yours and saves again.
- If that still cannot settle after a few tries, Plan says another device is saving. Tap Sync now a few seconds later.

## 0.4.1 - 2026-10-31
- Signing out now clears the log from that device, so the next person to sign in there cannot get it mixed into their account. Your account keeps your log.
- Before it clears, the app saves everything to your account first and asks you to confirm.
- A copy is always kept on the device. Plan, Your data now lists the copies kept, with a Download button for each.
- If someone else's log is found on a device when a different person signs in, it is copied aside and the device starts empty.

## 0.4.0 - 2026-10-31
- New people now get a short setup screen: body weight, a protein target worked out from it, and a start date. Nothing from anyone else's log is pre-filled.
- If you already have a log, or sign in on a second phone, you never see it.
- A friends guide is in the project: what TRCK is, how to put it on a phone, and how to back it up.

## 0.3.1 - 2026-10-31
- Small messages like "Copied" now appear above the "Update ready" bar instead of on top of it.

## 0.3.0 - 2026-10-31
- Plan now shows which version of TRCK you are running, at the bottom.
- When a new version is ready, a small bar says "Update ready". Tap it to reload. No more reloading twice.
- Before you import a file, the app keeps a copy of what was on your device (the last five), so a wrong import can be undone.
- Your saved data now carries a version number, so future updates can upgrade it safely.
- The text in Your data is now correct when you are signed in: your log is on the device and in your account.

## 0.2.0 - 2026-10-31
- Optional cloud sync with Supabase, so phone and laptop share one log.
- First public build: Today, Train, Muscles, Fuel, Progress, Plan.
