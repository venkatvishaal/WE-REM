import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import { initDb, closeDb } from './db/database';
import { getAuthUrl, exchangeCode, isAuthenticated, clearTokens } from './services/gmail.service';
import { runGmailSync, startMonitoring, stopMonitoring, getSyncStatus } from './services/monitor.service';
import { rebuildFromEmails } from './services/parser.service';

import applicationsRouter from './routes/applications';
import notificationsRouter from './routes/notifications';
import statsRouter from './routes/stats';
import settingsRouter from './routes/settings';
import portalRouter from './routes/portal';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Auth Routes ────────────────────────────────────────────────
app.get('/api/auth/gmail/url', (_req, res) => {
  res.json({ url: getAuthUrl() });
});

app.get('/api/auth/gmail/callback', async (req, res) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    res.status(400).send('<h2>Missing authorization code</h2>');
    return;
  }

  try {
    await exchangeCode(code);
    // After auth, start monitoring and redirect to frontend
    startMonitoring();
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth=success`);
  } catch (err: any) {
    console.error('[Auth] OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth=error&msg=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/auth/status', (_req, res) => {
  res.json({ authenticated: isAuthenticated() });
});

app.post('/api/auth/logout', (_req, res) => {
  clearTokens();
  res.json({ success: true });
});

// ── Monitor Routes ─────────────────────────────────────────────
app.post('/api/monitor/sync-now', async (req, res) => {
  if (!isAuthenticated()) {
    res.status(401).json({ error: 'Not authenticated with Gmail' });
    return;
  }
  const forceFull = req.query.full === 'true' || req.body?.full === true;
  runGmailSync(forceFull).catch(console.error);
  res.json({ message: 'Sync started', forceFull });
});

app.post('/api/monitor/reparse', async (_req, res) => {
  try {
    const result = await rebuildFromEmails();
    res.json({ message: 'Reparsing complete', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/monitor/status', (_req, res) => {
  res.json(getSyncStatus());
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/applications', applicationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/portal', portalRouter);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authenticated: isAuthenticated(),
  });
});

// ── Start server ───────────────────────────────────────────────
async function bootstrap() {
  // Initialize DB (async for sql.js WASM)
  await initDb();
  console.log('[Server] Database initialized');

  app.listen(PORT, () => {
    console.log(`[Server] Workday Tracker API running on http://localhost:${PORT}`);
    console.log(`[Server] Gmail OAuth callback: http://localhost:${PORT}/api/auth/gmail/callback`);

    // Start monitoring if already authenticated
    if (isAuthenticated()) {
      console.log('[Server] Gmail authenticated — starting monitoring');
      startMonitoring();
    } else {
      console.log('[Server] No Gmail auth found — visit the dashboard to connect your account');
    }
  });

  process.on('SIGTERM', () => { stopMonitoring(); closeDb(); process.exit(0); });
  process.on('SIGINT',  () => { stopMonitoring(); closeDb(); process.exit(0); });
}

bootstrap().catch(console.error);
