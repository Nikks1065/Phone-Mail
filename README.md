# PhoneMail — Phone-Number-Based Email Application

PhoneMail is a full-stack email platform where a verified phone number is the primary email identity (e.g. `9876543210@phonemail.com`).

It ships a **WhatsApp/Spike-inspired mobile UI** and a **Gmail-inspired desktop UI** on one Express + React stack, with OTP auth, conversation threading, single-reply enforcement, alias IDs, inbound email webhooks, Twilio-ready SMS notifications, and toll-free IVR account creation (with an in-app simulator).

Built for the **AlphaStack Buildathon**. A native Android APK is **not** required — the responsive web app is the deliverable.

---

## Quick Start

### Local (recommended for development)

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Registration-only portal: [http://localhost:3000/register](http://localhost:3000/register)
- Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Docker Compose

```bash
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

Data persists in the `app_data` volume (JSON store under `/app/.data`). Postgres is started for schema provisioning / future migration; the running app uses the persistent JSON relational store for mail data.

### Deploy on Render (recommended public hosting)

This repo includes a Render Blueprint (`render.yaml`).

1. Push this code to GitHub (e.g. `Nikks1065/Phone-Mail` on branch `main`).
2. Open [Render Blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance**.
3. Connect the GitHub repository and select the branch with `render.yaml`.
4. Apply the blueprint. Render will create a free Node web service with:
   - Build: `npm install --legacy-peer-deps && npm run build`
   - Start: `npm start`
   - Health check: `/api/health`
5. After deploy, open `https://<your-service>.onrender.com`.
6. Optional: in the Render dashboard → Environment, set Twilio keys and/or `DEMO_MODE=false`.

**Notes**
- Free Render instances sleep after idle traffic; the first request may take ~30–60s.
- Without a paid disk, `.data/` is ephemeral (seed regenerates on fresh instances).
- `APP_URL` is auto-filled from Render’s `RENDER_EXTERNAL_URL` when unset.
- Manual alternative (no Blueprint): New → Web Service → connect repo → same build/start commands → add env vars from `.env.example`.

---

## Features

| Area | Capability |
| --- | --- |
| Identity | Unique phone → `phone@EMAIL_DOMAIN`, aliases, country-code friendly normalization |
| Auth | OTP (hashed at rest, rate-limited), password fallback, `/register` portal, JWT sessions |
| Mobile UI | Language → ToS → Phone → OTP onboarding; search; All/Unread/Attachments/Favorites; Home/Drafts/Spam/Trash; FAB compose; chat + traditional compose; swipe-right to reply |
| Desktop UI | Gmail-style sidebar, list, reading pane, compose, reply, forward, restore, mark unread |
| Conversations | Canonical 1:1 threads; group threads for ≥2 recipients; locked recipients inside a thread |
| Messaging | Single-reply backend rule, drafts (save/edit/send), spam/trash/favorites, search, attachments |
| SMS | Twilio or simulated; fired after successful ingest; deduped per message id |
| IVR | Twilio TwiML webhooks + in-app dialer simulator |
| Ops | Docker Compose, health checks, backend test suite, demo seed accounts |

---

## Demo Accounts

| User | Phone | Email | Password |
| --- | --- | --- | --- |
| Nikhil Nitt | `9876543210` | `9876543210@phonemail.com` | `Password123!` |
| Sarah Chen | `9123456789` | `9123456789@phonemail.com` | `Password123!` |

In **demo mode** (`DEMO_MODE=true` or non-production), OTP request responses include `demoCode` for evaluators. Production responses never return OTP codes.

---

## Environment Variables

See `.env.example`. Important keys:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs session tokens |
| `DEMO_MODE` | When `true`, OTP may appear in API responses for local demos |
| `ADMIN_SECRET` | Optional header `x-admin-secret` for SMS log / seed reset tools |
| `SMS_PROVIDER` | `simulated` (default) or `twilio` |
| `TWILIO_*` | Live SMS / Voice credentials |
| `DATABASE_URL` | Optional Postgres URL |
| `EMAIL_DOMAIN` | Default `phonemail.com` |

---

## External Services

### OTP / SMS (Twilio)

1. Create a Twilio account and verify a phone number (trial accounts can only SMS verified numbers).
2. Set `SMS_PROVIDER=twilio` and fill `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
3. Free-tier / A2P messaging may require **pre-approved templates**. Custom “sender + subject” bodies are optional per instructor clarification — a template via `TWILIO_SMS_TEMPLATE` is supported (`{{sender}}`, `{{subject}}`).
4. Without Twilio credentials the app uses **simulated SMS** with an in-app audit log.

### IVR / Toll-free

1. Buy or trial a Twilio voice number (toll-free may require approval).
2. Point the Voice webhook to `POST {APP_URL}/api/ivr/incoming` and gather action to `/api/ivr/action`.
3. Until that is configured, use the **IVR Simulator** in the app header. Do not claim live IVR unless tested against Twilio.

### Inbound email

There is no built-in SMTP server. External mail providers should POST to:

`POST /api/emails/webhook/incoming`

Body: `{ "from", "to", "subject", "text", "html?", "attachments?" }`.

Use the **Inbound Email Simulator** in the UI for end-to-end demos.

### Domain / DNS

Point MX/webhook for your chosen ESP to the webhook above. PhoneMail itself generates addresses at `{digits}@{EMAIL_DOMAIN}`.

---

## Scripts

```bash
npm run dev      # fullstack Express + Vite middleware
npm start        # same entry (production serves dist/)
npm test         # backend assertion suite
npm run build    # Vite client build
npm run lint     # tsc --noEmit
```

---

## Project Structure

```
server.ts                 Express API + Vite/static mount
server/                   DB, auth, SMS, IVR, seed, tests
src/                      React UI (mobile + desktop + register portal)
docker-compose.yml        Postgres + app
REQUIREMENTS_REPORT.md    Buildathon requirement completion matrix
```

---

## Security Notes

- OTP codes are HMAC-hashed before persistence and invalidated after use.
- OTP request endpoint is rate-limited (5 / 10 minutes / phone).
- Passwords use bcrypt; sessions use JWT Bearer tokens.
- Seed reset and SMS logs require authentication or `x-admin-secret`.
- Never commit real Twilio / JWT secrets — use `.env` (gitignored).
