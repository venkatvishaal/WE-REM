# WE-REM: A Unified Platform for Managing Applications for Job Seekers

**WE-REM** is a comprehensive, personal application management platform that tracks the status of **every job you apply to** across all platforms — Workday, Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, HackerRank, LinkedIn, direct company career sites, and more. It connects to your Gmail, automatically identifies application confirmations, assessments, interview invites, offers, and rejection notices, and maintains a unified, real-time timeline for every opportunity.

## Features

- **Gmail sync**: Sign in with Google (read-only Gmail access), incremental sync every 15 minutes, no passwords stored
- **Multi-user**: Each person signs in with their own Google account and sees only their own applications
- **Smart parsing**: Detects company, role, requisition ID and event type from any ATS or no-reply sender, including rejections and "position filled" notices hidden in the email body
- **All platforms**: Workday, Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, Zoho Recruit, HirePro, HackerRank and plain company emails
- **Interviews**: Interview and assessment invites are tracked with their date and details
- **Response timing**: How long ago you applied, the exact date of each company reply, and how many days it took (including rejections)
- **Telegram alerts**: A phone message for every new job email; each user connects their own Telegram with one click
- **Privacy controls**: Privacy page, Disconnect Gmail, and Delete my data (removes everything at once)
- **Dashboard**: Stats, response rate, trend charts, pipeline and status breakdown
- **Full timeline**: Every email and status change per application
- **Manual control**: Add applications, edit status, add notes
- **Candidate portal checks** (self-hosted only): Reads your status on Workday and SmartRecruiters portals you've signed in to

## Architecture

```
Google sign-in → per-user Gmail sync (one user every 10 s) → Parser → Postgres (Neon) → REST API → React dashboard
                                                                                     ↘ Telegram alerts (one shared bot)
```

- One Node service serves both the API and the built React app (one domain, HTTP-only session cookie).
- `DATABASE_URL` set → Postgres (Neon in production). Empty → an embedded Postgres (PGlite) in `backend/data/pglite`, so local use needs no database setup.
- Each email is stored as subject, sender, date and the first 4 KB of text (about 2 MB per active user).

## Run locally

Needs Node.js 20+ and a Google Cloud OAuth client (see below).

```bash
cd backend && npm install
cd ../frontend && npm install
```

Copy `.env.example` to `backend/.env` and fill in `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` and `SESSION_SECRET` (long random strings). Then:

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **Sign in with Google**.

Coming from the old single-user version (`backend/data/tracker.db`)? Move your data once:

```bash
cd backend && npx ts-node --transpile-only src/scripts/migrate-to-postgres.ts
```

It reads your Gmail address from the old saved sign-in, copies everything under that account, and leaves `tracker.db` untouched. Set `DATABASE_URL` first to migrate straight into Neon.

## Deploy for up to 100 users (about $7/month)

| Part | Service | Cost |
|---|---|---|
| App (API + frontend) | Render **Starter** web service (the free plan sleeps, which stops syncing) | $7/mo |
| Database | Neon Postgres, free tier (0.5 GB) | $0 |
| Google sign-in | OAuth consent screen in **Testing** mode, up to 100 test users | $0 |
| Alerts | Your Telegram bot | $0 |

1. **Neon:** create a project and copy its connection string (`postgresql://…?sslmode=require`).
2. **Render:** New → Blueprint → pick this repo. `render.yaml` sets the build and start commands. Fill in the secrets it asks for. Keep the same `TOKEN_ENCRYPTION_KEY` you use locally if you migrated data.
3. **Google Cloud → Clients → your OAuth client:** add `https://<your-app>.onrender.com/api/auth/gmail/callback` as an authorized redirect URI.
4. **Google Cloud → Branding:** set the privacy policy link to `https://<your-app>.onrender.com/privacy`.
5. **Google Cloud → Data access:** keep only `gmail.readonly`, `openid` and `userinfo.email` (remove `gmail.send`).
6. **Telegram webhook** (once): open `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.onrender.com/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>` in a browser.
7. **Your data:** run the migration script locally with `DATABASE_URL` set to the Neon string.

### Adding users

1. Ask for their Gmail address and add it under **Google Cloud → Audience → Test users** (100 max).
2. Send them the link. They click **Sign in with Google**, click **Advanced → Continue** on the "Google hasn't verified this app" screen, and allow read-only Gmail access.
3. Optional: they click **Settings → Connect Telegram** and press **Start**.
4. Google ends Testing-mode access every 7 days. The app shows a **Reconnect Gmail** banner and sends a Telegram reminder; one click fixes it.

## Telegram alerts

Create a bot with **@BotFather** (`/newbot`) and set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`. Each user clicks **Settings → Connect Telegram**, which opens the bot with a one-time code; pressing **Start** links their chat. Only emails from the last 48 hours trigger alerts, so a full re-sync never floods anyone's phone.

## Candidate portal checks (self-hosted only)

Set `ENABLE_PORTAL_CHECKS=true` and run `npx playwright install chromium` in `backend`. In **Settings → Company portals**, click **Log in** next to a portal, sign in yourself in the window that opens, then close it. Only that browser session is kept (in `backend/data/portal-browser`). Never enable this on the hosted server: it would hold other people's portal sessions.

## Checks

```bash
cd backend
npx ts-node --transpile-only src/services/parser.selfcheck.ts    # parsing and matching
npx ts-node --transpile-only src/services/tenancy.selfcheck.ts   # users can't see each other's data
```

Both run on an in-memory database and never touch your data or the network.

## API

All routes except auth, health and the Telegram webhook need a signed-in session.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/gmail/url` | Google sign-in URL |
| GET | `/api/auth/gmail/callback` | Google redirect; creates the user and session |
| GET | `/api/auth/status` | Signed-in user, Gmail and Telegram state |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/account/disconnect-gmail` | Revoke Gmail access |
| DELETE | `/api/account` | Delete the account and all its data |
| GET / POST | `/api/applications` | List (filter, sort, paginate) / add manually |
| GET / PATCH / DELETE | `/api/applications/:id` | One application |
| GET | `/api/applications/:id/timeline` | Timeline events |
| GET | `/api/stats` | Stats, response rate, responses by type |
| GET / PATCH | `/api/settings` | Your settings |
| GET | `/api/notifications` | In-app notifications |
| POST | `/api/notifications/telegram/link` | One-time Telegram link |
| POST | `/api/notifications/test-telegram` | Send a Telegram test message |
| POST | `/api/telegram/webhook` | Telegram updates (secret header required) |
| POST | `/api/monitor/sync-now` | Sync your Gmail now |

## Data & privacy

Nothing below is committed to git (`.gitignore`):

- `.env`: all secrets
- `backend/data/`: local database, old `tracker.db`, portal browser session

Users can read what is stored on the **Privacy** page, and remove it all with **Delete my data**.

## Status flow

```
applied → acknowledged → under_review → assessment → interview → offer
                                    ↘ rejected / position_filled / withdrawn
```
