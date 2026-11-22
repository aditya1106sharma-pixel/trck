# TRCK Gym changelog

## 0.1.0 - 2026-11-22
First version, for the first 10 members.
- Public join form at `#/join/<gym>`: contact, about you, seven yes or no health questions and consent. Saves as you type, guards against spam and double taps.
- Owner and staff sign in with Google. Today shows who is waiting to join, plans ending this week, plans that ended in the last 30 days, and money due.
- Approve a request by picking a plan, start date, price and what was paid. The app writes the welcome message.
- Clients: search, filters, add a walk in, edit details and staff notes, renew, record payments, send receipts, archive. Owners can void a payment or cancel a plan with a reason; nothing is deleted.
- WhatsApp: every message is a template filled in with name, plan, dates and amounts. Copy it, or open WhatsApp with it typed in, and send from your own phone. Owners can change the wording. No WhatsApp API, no cost.
- Members sign in with the Gmail they gave and see days left, plans and payments.
- Money: collected this month, the last 6 months, recent payments. Insights: join funnel, member and front desk activity, and app problems.
- Owner downloads: clients sheet (CSV) and full backup (JSON). QR code for the join link.
- Database rules keep each gym, staff member and client to what they may see, tested against a real Postgres.
