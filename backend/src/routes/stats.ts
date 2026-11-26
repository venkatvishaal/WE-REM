import { Router, Request, Response } from 'express';
import { getStats, getTrends, getTopCompanies, getRecentActivity } from '../services/analytics.service';

const router = Router();

// ── GET /api/stats ────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  res.json(getStats());
});

// ── GET /api/stats/trends?days=30 ────────────────────────────
router.get('/trends', (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(7, parseInt((req.query.days as string) || '30')));
  res.json(getTrends(days));
});

// ── GET /api/stats/companies ──────────────────────────────────
router.get('/companies', (_req: Request, res: Response) => {
  res.json(getTopCompanies(15));
});

// ── GET /api/stats/activity ───────────────────────────────────
router.get('/activity', (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(5, parseInt((req.query.limit as string) || '20')));
  res.json(getRecentActivity(limit));
});

export default router;
