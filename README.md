# PhoneMail — Phone-Number Email + Username Messaging

PhoneMail is a full-stack app where each account gets a PhoneMail address (`phone@phonemail.com`) **and** a unique **username** for login and messaging.

- **Login / signup:** username + password (no demo accounts)
- **Messaging:** search users by username and chat in 1:1 conversations
- **Email features:** inbox, drafts, spam, trash, favorites, aliases, SMS/IVR simulators
- **UI:** WhatsApp-style mobile + Gmail-style desktop
- **Database:** PostgreSQL when `DATABASE_URL` is set; otherwise embedded **PGlite** (Postgres-compatible) at `.data/pglite`

---

## Quick Start

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or your `PORT`).

- Create account: [/register](http://localhost:3000/register)
- Health: [/api/health](http://localhost:3000/api/health)

### First real users (no demo data)

1. Open `/register`
2. Create **alice** with password + phone
3. Create **bob** the same way (different phone)
4. Log in as alice → search `bob` → send a message
5. Log in as bob → open the conversation → reply

### Docker Compose (PostgreSQL)

```bash
docker compose up -d --build
```

Sets `DATABASE_URL` to the Compose Postgres service. `SEED_DEMO_DATA=false` by default.

### Render

Use the included `render.yaml` Blueprint. Keep `SEED_DEMO_DATA=false`. Optionally set `DATABASE_URL` to a Render Postgres instance.

---

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres URL (optional; otherwise PGlite) |
| `SEED_DEMO_DATA` | `true` only if you want optional demo seed (default **false**) |
| `JWT_SECRET` | JWT signing secret |
| `EMAIL_DOMAIN` | Default `phonemail.com` |
| `SMS_PROVIDER` | `simulated` or `twilio` |

---

## API (auth & messaging)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ username, password, confirmPassword, phone, displayName? }` |
| POST | `/api/auth/login` | `{ username, password }` → JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users/search?q=` | Username search (auth) |
| POST | `/api/conversations/with-user` | `{ username }` open/create 1:1 |
| POST | `/api/messages/compose` | `to` may be username, phone, or email |

---

## Database schema

Tables: `users` (incl. unique `username`), `otps`, `aliases`, `conversations`, `conversation_participants`, `messages`, `user_message_states`, `sms_notifications`, `ivr_logs`.

Initialized automatically on startup (see `server/sqlPersist.ts`).
