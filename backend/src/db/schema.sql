-- ============================================================
-- Workday Application Tracker — SQLite Schema
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Applications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                       TEXT PRIMARY KEY,
  company_name             TEXT NOT NULL,
  job_title                TEXT NOT NULL,
  requisition_id           TEXT,
  portal_url               TEXT,
  portal_tenant            TEXT,
  status                   TEXT NOT NULL DEFAULT 'applied',
  -- FSM: applied | under_review | interview | assessment | offer | rejected | withdrawn
  portal_verification_mode TEXT NOT NULL DEFAULT 'email_only',
  -- rest | browser | email_only
  location                 TEXT,
  job_type                 TEXT,
  salary_range             TEXT,
  notes                    TEXT,
  applied_at               TEXT NOT NULL,
  last_activity_at         TEXT NOT NULL,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_name);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);

-- ── Timeline Events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timeline_events (
  id               TEXT PRIMARY KEY,
  application_id   TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  -- applied | acknowledged | interview | assessment | offer | rejected
  -- document_request | status_change | note | portal_verified | error
  source           TEXT NOT NULL DEFAULT 'email',
  -- email | portal_rest | portal_browser | manual
  title            TEXT NOT NULL,
  description      TEXT,
  metadata         TEXT, -- JSON blob
  occurred_at      TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_application ON timeline_events(application_id);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred_at ON timeline_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON timeline_events(event_type);

-- ── Raw Email Messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_messages (
  id               TEXT PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  application_id   TEXT REFERENCES applications(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  sender           TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  body_text        TEXT,
  body_html        TEXT,
  parsed           INTEGER NOT NULL DEFAULT 0,
  workday_related  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_gmail_id ON email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_application ON email_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_email_parsed ON email_messages(parsed);

-- ── Portal Snapshots ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_snapshots (
  id                  TEXT PRIMARY KEY,
  application_id      TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  snapshot_data       TEXT, -- JSON
  verification_mode   TEXT NOT NULL,
  status_detected     TEXT,
  error               TEXT,
  captured_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshot_application ON portal_snapshots(application_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY,
  application_id   TEXT REFERENCES applications(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,
  -- status_change | action_required | interview | offer | rejection | error | sync
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  channels         TEXT NOT NULL DEFAULT '["in_app"]', -- JSON array
  read             INTEGER NOT NULL DEFAULT 0,
  sent_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ── Settings (key-value store) ────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('gmail_sync_enabled',      'true'),
  ('portal_verify_enabled',   'false'),
  ('browser_verify_enabled',  'false'),
  ('notify_in_app',           'true'),
  ('notify_email',            'false'),
  ('notify_desktop',          'true'),
  ('notification_email_to',   ''),
  ('gmail_sync_interval',     '15'),
  ('portal_verify_interval',  '360'),
  ('last_gmail_sync',         ''),
  ('gmail_history_id',        ''),
  ('sync_status',             'idle');

-- ── Sync Log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id             TEXT PRIMARY KEY,
  sync_type      TEXT NOT NULL, -- gmail | portal | analytics
  status         TEXT NOT NULL, -- success | error | partial
  emails_fetched INTEGER DEFAULT 0,
  emails_parsed  INTEGER DEFAULT 0,
  apps_created   INTEGER DEFAULT 0,
  apps_updated   INTEGER DEFAULT 0,
  error          TEXT,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at   TEXT
);

-- ── Candidate portal login/check state (one row per portal host) ──
CREATE TABLE IF NOT EXISTS portal_hosts (
  host          TEXT PRIMARY KEY,
  state         TEXT NOT NULL DEFAULT 'unchecked', -- ok | needs_login | error | unchecked
  error         TEXT,
  last_checked  TEXT
);
