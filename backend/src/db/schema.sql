-- ============================================================
-- Job Application Tracker — Postgres schema (multi-user)
-- Timestamps are ISO-8601 UTC strings (TEXT), so string comparison = time order.
-- ============================================================

CREATE OR REPLACE FUNCTION iso_now() RETURNS TEXT LANGUAGE SQL AS
  $$ SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- ── Users (one per Google account) ────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  gmail_tokens_enc    TEXT,           -- AES-256-GCM, NULL = Gmail disconnected
  gmail_history_id    TEXT,
  gmail_connected_at  TEXT,
  telegram_chat_id    TEXT,
  telegram_link_code  TEXT UNIQUE,
  last_synced_at      TEXT,
  sync_status         TEXT NOT NULL DEFAULT 'idle', -- idle | syncing | reconnect_needed
  reconnect_reminded  INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT iso_now()
);

-- ── Applications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name             TEXT NOT NULL,
  job_title                TEXT NOT NULL,
  requisition_id           TEXT,
  portal_url               TEXT,
  portal_tenant            TEXT,
  status                   TEXT NOT NULL DEFAULT 'applied',
  portal_verification_mode TEXT NOT NULL DEFAULT 'email_only',
  location                 TEXT,
  job_type                 TEXT,
  salary_range             TEXT,
  notes                    TEXT,
  applied_at               TEXT NOT NULL,
  last_activity_at         TEXT NOT NULL,
  first_response_at        TEXT,
  last_response_type       TEXT,
  last_response_at         TEXT,
  created_at               TEXT NOT NULL DEFAULT iso_now(),
  updated_at               TEXT NOT NULL DEFAULT iso_now()
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(user_id, lower(company_name));

-- ── Timeline Events (scoped through their application) ────────
CREATE TABLE IF NOT EXISTS timeline_events (
  id               TEXT PRIMARY KEY,
  application_id   TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'email', -- email | portal | manual
  title            TEXT NOT NULL,
  description      TEXT,
  metadata         TEXT, -- JSON blob
  occurred_at      TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT iso_now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_application ON timeline_events(application_id, occurred_at);

-- ── Stored job emails (text capped at 4 KB, no HTML) ──────────
CREATE TABLE IF NOT EXISTS email_messages (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  application_id   TEXT REFERENCES applications(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  sender           TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  body_text        TEXT,
  parsed           INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT iso_now(),
  UNIQUE (user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_unparsed ON email_messages(user_id, parsed);

-- ── Portal snapshots (local portal checks only) ───────────────
CREATE TABLE IF NOT EXISTS portal_snapshots (
  id                  TEXT PRIMARY KEY,
  application_id      TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  snapshot_data       TEXT,
  verification_mode   TEXT NOT NULL,
  status_detected     TEXT,
  error               TEXT,
  captured_at         TEXT NOT NULL DEFAULT iso_now()
);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id   TEXT REFERENCES applications(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  channels         TEXT NOT NULL DEFAULT '["in_app"]',
  read             INTEGER NOT NULL DEFAULT 0,
  sent_at          TEXT NOT NULL DEFAULT iso_now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, sent_at);

-- ── Settings (per user key-value store) ───────────────────────
CREATE TABLE IF NOT EXISTS settings (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT iso_now(),
  PRIMARY KEY (user_id, key)
);

-- ── Sync Log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_type      TEXT NOT NULL,
  status         TEXT NOT NULL,
  emails_fetched INTEGER DEFAULT 0,
  emails_parsed  INTEGER DEFAULT 0,
  apps_created   INTEGER DEFAULT 0,
  apps_updated   INTEGER DEFAULT 0,
  error          TEXT,
  started_at     TEXT NOT NULL DEFAULT iso_now(),
  completed_at   TEXT
);

-- ── Candidate portal login/check state (local portal checks only) ──
CREATE TABLE IF NOT EXISTS portal_hosts (
  host          TEXT PRIMARY KEY,
  state         TEXT NOT NULL DEFAULT 'unchecked',
  error         TEXT,
  last_checked  TEXT
);
