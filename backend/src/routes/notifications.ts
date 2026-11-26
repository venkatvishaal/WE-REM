import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database';
import { sendTelegram, findTelegramChatId } from '../services/notification.service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { unread_only, limit = '50' } = req.query as Record<string, string>;
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const where = unread_only === 'true' ? 'WHERE n.read = 0' : '';

  const notifications = dbAll(
    `SELECT n.*, a.company_name, a.job_title FROM notifications n
     LEFT JOIN applications a ON a.id = n.application_id
     ${where} ORDER BY n.sent_at DESC LIMIT ?`,
    [limitNum],
  );

  const unreadCount = (dbGet<{ count: number }>('SELECT COUNT(*) as count FROM notifications WHERE read = 0'))?.count ?? 0;
  res.json({ data: notifications, unreadCount: Number(unreadCount) });
});

// ── POST /api/notifications/test-telegram — also finds the chat ID on first setup
router.post('/test-telegram', async (_req: Request, res: Response) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(400).json({ error: 'Add TELEGRAM_BOT_TOKEN to backend/.env and restart the backend.' });
    return;
  }
  try {
    let chatId = process.env.TELEGRAM_CHAT_ID;
    let hint = '';
    if (!chatId) {
      chatId = await findTelegramChatId(); // throws a readable error when the token is missing/invalid
      if (!chatId) {
        res.status(400).json({ error: 'Open your bot in Telegram and press Start (or send it any message), then try again.' });
        return;
      }
      hint = ` Now add TELEGRAM_CHAT_ID=${chatId} to backend/.env and restart the backend.`;
    }
    const ok = await sendTelegram('Job Tracker alerts are working', chatId);
    if (!ok) {
      res.status(502).json({ error: 'Telegram did not accept the message. Check the backend log.' });
      return;
    }
    res.json({ message: `Test message sent.${hint}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/read-all', (_req: Request, res: Response) => {
  dbRun('UPDATE notifications SET read = 1', []);
  res.json({ success: true });
});

router.patch('/:id/read', (req: Request, res: Response) => {
  dbRun('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  dbRun('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

router.delete('/', (_req: Request, res: Response) => {
  dbRun('DELETE FROM notifications WHERE read = 1', []);
  res.json({ success: true });
});

// SSE stream for desktop push
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);
  const poll = setInterval(() => {
    const pending = dbAll(`SELECT * FROM notifications WHERE read = 0 AND channels LIKE '%desktop%' ORDER BY sent_at DESC LIMIT 5`);
    if (pending.length > 0) res.write(`data: ${JSON.stringify(pending)}\n\n`);
  }, 5000);

  req.on('close', () => { clearInterval(heartbeat); clearInterval(poll); });
});

export default router;
