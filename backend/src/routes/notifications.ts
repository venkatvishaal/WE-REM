import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database';
import { ah, uid } from '../middleware/auth';
import { createTelegramLink, disconnectTelegram, sendTelegramTest } from '../services/notification.service';

const router = Router();

router.get('/', ah(async (req: Request, res: Response) => {
  const { unread_only, limit = '50' } = req.query as Record<string, string>;
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const unread = unread_only === 'true' ? 'AND n.read = 0' : '';

  const notifications = await dbAll(
    `SELECT n.*, a.company_name, a.job_title FROM notifications n
     LEFT JOIN applications a ON a.id = n.application_id
     WHERE n.user_id = ? ${unread} ORDER BY n.sent_at DESC LIMIT ?`,
    [uid(req), limitNum],
  );
  const unreadCount = (await dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0', [uid(req)]))?.count ?? 0;
  res.json({ data: notifications, unreadCount });
}));

// ── Telegram: link this account to the user's Telegram chat ────
router.post('/telegram/link', ah(async (req: Request, res: Response) => {
  try {
    res.json({ url: await createTelegramLink(uid(req)) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}));

router.post('/telegram/disconnect', ah(async (req: Request, res: Response) => {
  await disconnectTelegram(uid(req));
  res.json({ success: true });
}));

router.post('/test-telegram', ah(async (req: Request, res: Response) => {
  if (await sendTelegramTest(uid(req))) res.json({ message: 'Test message sent.' });
  else res.status(400).json({ error: 'Connect Telegram first, then try again.' });
}));

router.patch('/read-all', ah(async (req: Request, res: Response) => {
  await dbRun('UPDATE notifications SET read = 1 WHERE user_id = ?', [uid(req)]);
  res.json({ success: true });
}));

router.patch('/:id/read', ah(async (req: Request, res: Response) => {
  await dbRun('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, uid(req)]);
  res.json({ success: true });
}));

router.delete('/:id', ah(async (req: Request, res: Response) => {
  await dbRun('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, uid(req)]);
  res.json({ success: true });
}));

router.delete('/', ah(async (req: Request, res: Response) => {
  await dbRun('DELETE FROM notifications WHERE user_id = ? AND read = 1', [uid(req)]);
  res.json({ success: true });
}));

// SSE stream for desktop push (this user's unread notifications only)
router.get('/stream', (req: Request, res: Response) => {
  const userId = uid(req);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);
  // shortcut: polls the DB every 30s per open tab; fine for ~100 users, switch to LISTEN/NOTIFY if it grows
  const poll = setInterval(() => {
    dbAll(`SELECT * FROM notifications WHERE user_id = ? AND read = 0 AND channels LIKE '%desktop%' ORDER BY sent_at DESC LIMIT 5`, [userId])
      .then((pending) => { if (pending.length > 0) res.write(`data: ${JSON.stringify(pending)}\n\n`); })
      .catch(() => {});
  }, 30000);

  req.on('close', () => { clearInterval(heartbeat); clearInterval(poll); });
});

export default router;
