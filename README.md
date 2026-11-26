# WE-REM: A Unified Platform for Managing Applications for Job Seekers

**WE-REM** is a comprehensive, personal application management platform that tracks the status of **every job you apply to** across all platforms — Workday, Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, HackerRank, LinkedIn, direct company career sites, and more. It connects to your Gmail, automatically identifies application confirmations, assessments, interview invites, offers, and rejection notices, and maintains a unified, real-time timeline for every opportunity.

## Features

- **Gmail sync** — OAuth 2.0 (read-only + send-to-self), incremental sync every 15 minutes, no passwords stored
- **Smart parsing** — Detects company, role, requisition ID and event type from any ATS or no-reply sender, including rejections and "position filled" notices hidden in the email body
- **All platforms** — Workday, Greenhouse, Lever, Ashby, SmartRecruiters, iCIMS, Zoho Recruit, HirePro, HackerRank and plain company emails
- **Interviews** — Interview and assessment invites are tracked with their date and details
- **Response timing** — How long ago you applied, the exact date of each company reply, and how many days it took (including rejections)
- **Candidate portal checks** — Some companies never email a rejection; the tracker reads your status on Workday and SmartRecruiters candidate portals you've signed in to (you log in yourself once; passwords are never stored)
- **Telegram alerts** — A phone message for every new job email: received, assessment, interview, offer, rejection
- **Dashboard** — Stats, response rate, trend charts, pipeline and status breakdown
- **Full timeline** — Every email and portal change per application
- **Manual control** — Add applications, edit status, add notes

## Architecture

```
Gmail OAuth → Email sync → Parser → SQLite → REST API → React dashboard
                                      ↑                ↘ Telegram alerts
              Candidate portals (Playwright, your own session)
```

## Setup

### Prerequisites
- Node.js 20+
- A Google Cloud project with the Gmail API enabled (see below)

### 1. Install

```bash
cd backend && npm install
npx playwright install chromium   # only needed for candidate-portal checks
cd ../frontend && npm install
```

### 2. Configure

Copy `.env.example` to `backend/.env` and fill in:

| Variable | What it is |
|----------|------------|
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | Your Google OAuth client |
| `GMAIL_REDIRECT_URI` | `http://localhost:3001/api/auth/gmail/callback` |
| `TOKEN_ENCRYPTION_KEY` | Any random 32-character string |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional, for phone alerts (see below) |

Never commit `.env` — it is in `.gitignore`.

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **Connect Gmail Account**, and approve access. The first sync scans your past job emails.

## Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com) and enable the **Gmail API**
2. Configure the OAuth consent screen and add your Gmail address as a **test user**
3. Create an OAuth client (Web application) with redirect URI `http://localhost:3001/api/auth/gmail/callback`

> While the app is in **Testing** mode, Google expires the sign-in every 7 days — just reconnect Gmail in Settings.

## Telegram alerts (optional)

1. In Telegram, message **@BotFather**, send `/newbot`, and put the token in `TELEGRAM_BOT_TOKEN`
2. Open your new bot and press **Start**
3. Restart the backend, then in **Settings → Telegram alerts** click **Send test message**
4. Add the `TELEGRAM_CHAT_ID=…` it shows to `backend/.env`, restart, and turn the toggle on

Only emails from the last 48 hours trigger alerts, so a full re-sync never floods your phone.

## Candidate portal checks (optional)

In **Settings → Company portals**, click **Log in** next to a portal, sign in yourself in the window that opens, then close it. The tracker keeps only that browser session (in `backend/data/portal-browser`) and checks your application status every 6 hours. Supported: Workday "My Applications" and SmartRecruiters.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/gmail/url` | OAuth URL |
| GET | `/api/auth/status` | Gmail connection status |
| GET / POST | `/api/applications` | List (filter, sort, paginate) / add manually |
| GET / PATCH / DELETE | `/api/applications/:id` | One application |
| GET | `/api/applications/:id/timeline` | Timeline events |
| GET | `/api/stats` | Stats, response rate, responses by type |
| GET / PATCH | `/api/settings` | Settings |
| GET | `/api/notifications` | In-app notifications |
| POST | `/api/notifications/test-telegram` | Send a Telegram test message |
| GET | `/api/portal/status` | Candidate portal states |
| POST | `/api/portal/login` | Open a portal sign-in window |
| POST | `/api/portal/check-now` | Check all portals now |

## Data & privacy

Everything runs on your own machine. Nothing below is committed to git:

- `backend/data/tracker.db` — SQLite database of your applications and emails
- `backend/data/.tokens.enc` — Gmail tokens (AES-256-GCM encrypted)
- `backend/data/portal-browser/` — candidate portal browser session

## Status flow

```
applied → acknowledged → under_review → assessment → interview → offer
                                    ↘ rejected / position_filled / withdrawn
```
