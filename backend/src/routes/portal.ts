import { Router, Request, Response } from 'express';
import { getPortalStatus, openPortalLogin, verifyAllApplications } from '../services/portal.service';
import { ah, uid } from '../middleware/auth';

// Mounted only when ENABLE_PORTAL_CHECKS=true (your own machine; never on the hosted server)
const router = Router();

router.get('/status', ah(async (req: Request, res: Response) => {
  res.json(await getPortalStatus(uid(req)));
}));

// POST /api/portal/login { host } — opens a visible browser for the user to sign in
router.post('/login', ah(async (req: Request, res: Response) => {
  const host = String(req.body?.host || '');
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    res.status(400).json({ error: 'host is required' });
    return;
  }
  try {
    await openPortalLogin(uid(req), host);
    res.json({ message: 'Login window opened. Sign in, then close the window.' });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
}));

router.post('/check-now', ah(async (req: Request, res: Response) => {
  if ((await getPortalStatus(uid(req))).busy) {
    res.status(409).json({ error: 'A portal check or login window is already running' });
    return;
  }
  verifyAllApplications(uid(req)).catch((err) => console.error('[Portal] Check failed:', err));
  res.json({ message: 'Portal check started' });
}));

export default router;
