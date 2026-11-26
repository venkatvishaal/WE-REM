import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database';

const router = Router();

const PUBLIC_SETTINGS = [
  'gmail_sync_enabled', 'portal_verify_enabled', 'browser_verify_enabled',
  'notify_in_app', 'notify_email', 'notify_desktop', 'notification_email_to', 'notify_telegram',
  'gmail_sync_interval', 'portal_verify_interval', 'last_gmail_sync', 'sync_status',
];

router.get('/', (_req: Request, res: Response) => {
  const settings: Record<string, string> = {};
  for (const key of PUBLIC_SETTINGS) {
    const row = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (row) settings[key] = row.value;
  }
  res.json(settings);
});

router.patch('/', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const updated: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.body)) {
    if (!PUBLIC_SETTINGS.includes(key)) continue;
    const strValue = String(value);
    dbRun(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, strValue, now],
    );
    updated[key] = strValue;
  }

  res.json({ updated });
});

export default router;
