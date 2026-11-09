# SpendMate

Mobile-first personal finance + group expense app (MERN, TypeScript).
Design and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status
SpendMate is focused on **tracking money and sharing it with a parent**. Built and working:

- Sign up with name, gender, date of birth, mobile number and a 4-digit **Secret Pin**; sign in with mobile number + Secret Pin (5 wrong tries lock the account for 15 minutes). **Forgot Secret Pin?** resets it by confirming mobile number + date of birth (same lockout; all devices are signed out). iPhone-style screens with light and dark mode.
- Add money spent or received, with a reason, category, payment method, date and tags; edit, delete (with history), search, filters.
- Home balance, monthly summary, category bars, 6-month chart, optional budgets.
- **Family:** a child makes a 6-character code, the parent enters it, and the parent can then *view* the entries the child chose to share (read-only, refreshes every 15 seconds) and leave comments. The child can stop sharing at any time, hide or show past entries in one tap, and keep any entry private.

Not built yet: groups and bill splitting, settlements, chat, live location, push notifications, receipt photos, installable app (PWA).

## How your dad uses it
1. You: open **Family → "I'm a child: invite my parent"** and send him the code.
2. Dad: creates his own account on SpendMate (mobile number + Secret Pin), opens **Family**, types the code under "I have a code", and taps Connect.
3. From then on he sees your shared entries under **Family → your name**. New entries are shared by default (switch off per entry).

## Run locally
```bash
cd server && npm install && cp .env.example .env   # fill MONGODB_URI + JWT_ACCESS_SECRET
npm run dev                                         # API on :4000 (MongoDB Atlas)
```
No Atlas yet? `npm run dev:memory` uses an in-memory MongoDB (first run downloads ~800 MB; data is lost on exit).
```bash
cd client && npm install && npm run dev             # app on :5173, proxies /api → :4000
```

## Test
```bash
cd server && npm test && npm run typecheck
cd client && npx tsc -b
```
