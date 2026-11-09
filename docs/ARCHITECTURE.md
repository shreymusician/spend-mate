# SpendMate — Architecture, Data Design, UI System, Roadmap

_Know where your money goes._

## 1. System overview

```
 React 19 PWA (Vite)  ──REST (cookies+Bearer)──▶  Express + TS  ──Mongoose──▶  MongoDB Atlas
        │                                              │
        └────────────── Socket.IO (JWT auth) ──────────┘
```

Monorepo, two packages: `server/` and `client/`. No shared runtime package; the
client re-declares the API types it uses (`client/src/types`).

### Backend layering (per module)
`routes → controller → service → model`, with `validators` (Zod) at the edge.
Controllers never touch Mongoose; services never touch `req`/`res`.
Cross-cutting: `middleware/` (auth, validate, error, rate-limit), `utils/money.ts`,
`socket/` (auth handshake + room per group / per user).

### Auth model
- Access token: JWT, 15 min, sent as `Authorization: Bearer`, kept **in memory** on the client.
- Refresh token: opaque random 256-bit, **HttpOnly, SameSite=Strict** cookie scoped to `/api/auth`.
  Stored hashed (SHA-256) in `refreshTokens` with a `family` id. Every refresh **rotates**;
  presenting an already-rotated token revokes the whole family (theft detection).
- CSRF: refresh/logout require `X-Requested-With: SpendMate` header + SameSite=Strict
  (cross-site forms cannot set a custom header).
- Passwords: bcrypt (cost 12). Rate limits on `/auth/*`.
- Authorization is always resource-based, checked server-side: group membership,
  relationship ownership/visibility, transaction owner.

### Money rules
- All amounts are **integer paise** (`Number`, validated `Number.isSafeInteger`).
- Splits (`utils/money.ts`): equal split distributes the remainder paise one-by-one
  (deterministic order); percentage split uses basis points (percent × 100) and
  largest-remainder; exact split must sum to the total. Client-supplied shares are
  never trusted — the server recomputes.
- Group balances are **derived** from `groupExpenses` + `expenseShares` + confirmed
  `settlements`, never stored as authoritative numbers.
- Settlements: payer _records_, **receiver confirms**. Only the receiver can confirm.

## 2. Database design (MongoDB / Mongoose)

| Collection | Key fields | Indexes |
|---|---|---|
| users | name, email, passwordHash, avatarUrl, role(`user`/`parent`/`child` is relational, not global), dob, prefs{theme,tone,notif}, createdAt | email unique |
| refreshTokens | user, tokenHash, family, expiresAt, revokedAt, replacedBy | tokenHash unique, user, TTL expiresAt |
| categories | user?, name, icon, color, isDefault | user+name unique |
| transactions | user, type(income/expense), amountPaise, title, reason, category, paymentMethod, merchant, tags[], receiptUrl, occurredAt, visibility(`private`/`shared`), deletedAt | user+occurredAt, user+category |
| budgets | user, category?, month(YYYY-MM), limitPaise | user+month+category unique |
| relationships | parent, child, status, permissions{shareAll,...}, createdAt | parent+child unique |
| invitations | kind(`parent`/`group`), code, token, inviter, target ref, expiresAt, status | code unique, TTL |
| groups | name, description, imageUrl, admin, createdAt | — |
| groupMembers | group, user, role(`admin`/`member`), joinedAt, leftAt | group+user unique |
| groupExpenses | group, paidBy, amountPaise, title, reason, splitMode, participants[], editHistory[] | group+createdAt |
| expenseShares | expense, group, user, sharePaise | expense, group+user |
| settlements | group, from, to, amountPaise, status(`pending`/`confirmed`/`rejected`), idempotencyKey | group+status, idempotencyKey unique-sparse |
| messages | group, sender, kind(`text`/`image`/`expense`/`system`), body, attachmentUrl, readBy[] | group+createdAt |
| notifications | user, kind, title, body, link, readAt, createdAt | user+readAt+createdAt |
| locationSessions | group, user, startedAt, expiresAt, stoppedAt | group+expiresAt |
| locationUpdates | session, lat, lng, accuracy, at | session+at, TTL (24h) |
| auditLogs | actor, entity, entityId, action, before, after, at | entity+entityId |

Multi-document writes (expense + shares + audit, settlement confirmation) use
`session.withTransaction` when the deployment is a replica set (Atlas always is).

## 3. Mobile UI system

- Frame: on phones, full-screen app; on desktop, a centred 430×932 "device" column.
- Shell: compact top bar (title · avatar · bell) → page body (internal scroll only
  for lists) → persistent bottom tab bar (Home · Activity · Groups · Settle · Profile).
  Safe-area via `env(safe-area-inset-*)`. Uses `100dvh`.
- Tokens (CSS variables in `styles/index.css`, Tailwind 4 `@theme`): navy/charcoal
  surfaces, lime accent, green/red semantic, off-white/grey text; light theme override.
- Primitives: `Button`, `Card`, `Segmented`, `Sheet` (bottom sheet w/ drag-to-dismiss,
  Framer Motion), `Field`, `Amount`, `EmptyState`.
- Motion: only sheet slide + tab fade; no scroll-driven animation.
- Voice: `lib/copy.ts` — pools of microcopy per context, with a `neutral` tone that
  suppresses jokes. Amounts/warnings are never replaced by jokes.

## 4. Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | Monorepo, auth (rotation), design system, mobile shell, money utils + tests | done |
| 2 Personal finance | Transactions, categories, budgets, dashboard, analytics | done (no receipt upload, no custom-category UI yet) |
| 3 Parent–child | Invite codes, links, read-only shared view, comments (polling, not realtime yet) | done |
| 4 Groups | Groups, members, invitations, expenses + splits | |
| 5 Settlements | Balances, simplification, partial/full, UPI links, confirm | |
| 6 Social | Chat, notifications, push | |
| 7 Location | Sessions, consent, map | |
| 8 Polish | PWA, tests, security pass, deploy docs | |
