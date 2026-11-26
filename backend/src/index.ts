import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import * as crypto from 'crypto';

import { initDb, closeDb, dbGet } from './db/database';
import { getAuthUrl, exchangeCode, saveTokens, disconnectGmail } from './services/gmail.service';
import { runGmailSync, startMonitoring, stopMonitoring, getSyncStatus } from './services/monitor.service';
import { rebuildFromEmails } from './services/parser.service';
import { upsertUser, deleteUser } from './services/user.service';
import { handleTelegramUpdate } from './services/notification.service';
import { requireUser, uid, ah, startSession, endSession, readCookie, setCookie } from './middleware/auth';

import applicationsRouter from './routes/applications';
import notificationsRouter from './routes/notifications';
import statsRouter from './routes/stats';
import settingsRouter from './routes/settings';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const OAUTH_STATE_COOKIE = 'oauth_state';

app.set('trust proxy', 1); // Render terminates HTTPS in front of the app
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// ── Public routes ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sign in (and reconnect) with Google. The state cookie blocks login-CSRF.
app.get('/api/auth/gmail/url', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  setCookie(res, OAUTH_STATE_COOKIE, state, 10 * 60 * 1000);
  res.json({ url: getAuthUrl(state) });
});

app.get('/api/auth/gmail/callback', ah(async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expected = readCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
  if (error || !code || !state || state !== expected) {
    res.redirect(`${FRONTEND_URL}/?auth=error&msg=${encodeURIComponent(error || 'Sign-in was cancelled or expired. Try again.')}`);
    return;
  }
  try {
    const { email, tokens } = await exchangeCode(code);
    const userId = await upsertUser(email);
    await saveTokens(userId, tokens);
    startSession(res, userId);
    res.redirect(`${FRONTEND_URL}/?auth=success`);
    runGmailSync(userId).catch(console.error); // first sync right away
  } catch (err: any) {
    console.error('[Auth] OAuth callback error:', err?.message);
    res.redirect(`${FRONTEND_URL}/?auth=error&msg=${encodeURIComponent(err?.message || 'Sign-in failed')}`);
  }
}));

app.post('/api/auth/logout', (_req, res) => {
  endSession(res);
  res.json({ success: true });
});

// Telegram calls this when someone messages the bot; the secret header proves it is Telegram
app.post('/api/telegram/webhook', ah(async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
    res.sendStatus(403);
    return;
  }
  await handleTelegramUpdate(req.body).catch((err) => console.error('[Telegram] Webhook error:', err?.message));
  res.sendStatus(200);
}));

// ── Signed-in routes ───────────────────────────────────────────
app.use('/api', requireUser);

app.get('/api/auth/status', ah(async (req, res) => {
  const user = await dbGet<any>(
    'SELECT email, gmail_tokens_enc IS NOT NULL AS gmail_connected, sync_status, telegram_chat_id IS NOT NULL AS telegram_connected FROM users WHERE id = ?',
    [uid(req)],
  );
  res.json({
    authenticated: true,
    email: user.email,
    gmailConnected: user.gmail_connected,
    reconnectNeeded: user.sync_status === 'reconnect_needed',
    telegramConnected: user.telegram_connected,
    portalChecks: process.env.ENABLE_PORTAL_CHECKS === 'true',
  });
}));

app.post('/api/account/disconnect-gmail', ah(async (req, res) => {
  await disconnectGmail(uid(req));
  res.json({ success: true });
}));

app.delete('/api/account', ah(async (req, res) => {
  await disconnectGmail(uid(req)); // revoke Google access before forgetting the token
  await deleteUser(uid(req));
  endSession(res);
  res.json({ success: true });
}));

app.post('/api/monitor/sync-now', ah(async (req, res) => {
  const forceFull = req.query.full === 'true' || req.body?.full === true;
  runGmailSync(uid(req), forceFull).catch(console.error);
  res.json({ message: 'Sync started', forceFull });
}));

app.post('/api/monitor/reparse', ah(async (req, res) => {
  try {
    res.json({ message: 'Reparsing complete', ...(await rebuildFromEmails(uid(req))) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}));

app.get('/api/monitor/status', ah(async (req, res) => {
  res.json(await getSyncStatus(uid(req)));
}));

app.use('/api/applications', applicationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
if (process.env.ENABLE_PORTAL_CHECKS === 'true') {
  app.use('/api/portal', require('./routes/portal').default);
}

// ── Built frontend (production: one service, one domain) ───────
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

// Async route errors (Express 4 doesn't catch rejected promises on its own)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Error:', err?.message || err);
  res.status(500).json({ error: 'Something went wrong' });
});

// ── Start server ───────────────────────────────────────────────
async function bootstrap() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Server] Job Tracker API on http://localhost:${PORT}`);
    startMonitoring();
  });
  const shutdown = () => { stopMonitoring(); closeDb().finally(() => process.exit(0)); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;

// Self-checks import the app without starting the server
if (process.env.NO_SERVER !== "1") bootstrap().catch((err) => { console.error(err); process.exit(1); });
