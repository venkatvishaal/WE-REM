import { Router, Request, Response } from 'express';
import { getPortalStatus, openPortalLogin, verifyAllApplications } from '../services/portal.service';

const router = Router();

// ── GET /api/portal/status ─────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json(getPortalStatus());
});

// ── POST /api/portal/login { host } — opens a visible browser for the user to sign in
router.post('/login', async (req: Request, res: Response) => {
  const host = String(req.body?.host || '');
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    res.status(400).json({ error: 'host is required' });
    return;
  }
  try {
    await openPortalLogin(host);
    res.json({ message: 'Login window opened. Sign in, then close the window.' });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

// ── POST /api/portal/check-now ─────────────────────────────────
router.post('/check-now', (_req: Request, res: Response) => {
  if (getPortalStatus().busy) {
    res.status(409).json({ error: 'A portal check or login window is already running' });
    return;
  }
  verifyAllApplications().catch((err) => console.error('[Portal] Check failed:', err));
  res.json({ message: 'Portal check started' });
});

export default router;
