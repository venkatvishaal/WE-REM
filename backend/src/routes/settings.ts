import { Router, Request, Response } from 'express';
import { dbAll } from '../db/database';
import { ah, uid } from '../middleware/auth';
import { setSetting } from '../services/user.service';

const router = Router();

const READABLE = ['gmail_sync_enabled', 'portal_verify_enabled', 'notify_in_app', 'notify_desktop', 'notify_telegram', 'last_gmail_sync'];
const WRITABLE = ['gmail_sync_enabled', 'portal_verify_enabled', 'notify_in_app', 'notify_desktop', 'notify_telegram'];

router.get('/', ah(async (req: Request, res: Response) => {
  const rows = await dbAll<{ key: string; value: string }>('SELECT key, value FROM settings WHERE user_id = ?', [uid(req)]);
  res.json(Object.fromEntries(rows.filter((r) => READABLE.includes(r.key)).map((r) => [r.key, r.value])));
}));

router.patch('/', ah(async (req: Request, res: Response) => {
  const updated: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!WRITABLE.includes(key)) continue;
    await setSetting(uid(req), key, String(value));
    updated[key] = String(value);
  }
  res.json({ updated });
}));

export default router;
