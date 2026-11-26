# 📊 Workday Application Tracker

A personal job-application tracking system that automatically monitors your Workday-powered job applications via Gmail.

## Features

- **📧 Gmail Integration** — OAuth 2.0 sync, incremental history API, no passwords stored
- **🔍 Smart Parsing** — Extracts company, role, requisition ID, and event type from emails
- **🌐 Portal Verification** — Graceful fallback: REST API → Playwright browser → email-only
- **📊 Dashboard** — Stats, trend charts, activity feed, status breakdown
- **🔔 Notifications** — In-app, email-to-self, and desktop browser push
- **📋 Full Timeline** — Every email event and portal verification tracked per application
- **✏️ Manual Control** — Add applications manually, edit status, add notes

## Architecture

```
Gmail OAuth → Email Ingestion → Parser → Portal Verification → SQLite → REST API → React Dashboard
```

Portal verification fallback chain:
1. Workday public REST (`/wday/cxs/...`)
2. Playwright headless browser (opt-in)
3. Email-only mode (always available)

## Setup

### Prerequisites
- Node.js 20+
- npm

### 1. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` (already done — credentials pre-filled):

```bash
# The following are already set in .env:
GMAIL_CLIENT_ID=778309906020-...
GMAIL_CLIENT_SECRET=GOCSPX-...
GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback
```

> **Important**: Add `http://localhost:3001/api/auth/gmail/callback` to your Google Cloud project's **Authorized redirect URIs** if not already done.

### 3. Start servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. Connect Gmail

1. Click **Connect Gmail Account** on the auth screen
2. Authorize the app in the Google OAuth flow
3. You'll be redirected back — syncing starts automatically

## Google Cloud Setup

If you need to configure your Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Gmail API**
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized redirect URI: `http://localhost:3001/api/auth/gmail/callback`
5. Add your email as a test user under OAuth consent screen

## Optional: Browser Verification

To enable Playwright-based portal verification:

```bash
# Install Playwright (one-time, ~150MB)
cd backend
npx playwright install chromium

# Set in .env
ENABLE_BROWSER_VERIFICATION=true
```

Then enable "Browser Verification" in Settings.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/gmail/url` | Get OAuth URL |
| GET | `/api/auth/gmail/callback` | OAuth callback |
| GET | `/api/auth/status` | Auth status |
| POST | `/api/auth/logout` | Disconnect Gmail |
| GET | `/api/applications` | List applications (paginated) |
| POST | `/api/applications` | Create manually |
| PATCH | `/api/applications/:id` | Update |
| DELETE | `/api/applications/:id` | Delete |
| GET | `/api/applications/:id/timeline` | Timeline events |
| POST | `/api/applications/:id/notes` | Add note |
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/read-all` | Mark all read |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/stats/trends?days=30` | Time-series data |
| PATCH | `/api/settings` | Update settings |
| POST | `/api/monitor/sync-now` | Manual sync trigger |
| GET | `/api/monitor/status` | Sync health |

## Data Storage

- **Database**: `backend/data/tracker.db` (SQLite, WAL mode)
- **Gmail tokens**: `backend/data/.tokens.enc` (AES-256-GCM encrypted)
- **No cloud dependencies** — everything runs locally

## Status State Machine

```
applied → acknowledged → under_review → interview → offer
                                      ↘ assessment ↗
                                      ↘ rejected
                                      ↘ withdrawn
```
