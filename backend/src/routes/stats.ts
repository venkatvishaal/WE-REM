import { Router, Request, Response } from 'express';
import { getStats, getTrends, getTopCompanies, getRecentActivity } from '../services/analytics.service';
import { ah, uid } from '../middleware/auth';

const router = Router();

router.get('/', ah(async (req: Request, res: Response) => {
  res.json(await getStats(uid(req)));
}));

router.get('/trends', ah(async (req: Request, res: Response) => {
  const days = Math.min(365, Math.max(7, parseInt((req.query.days as string) || '30') || 30));
  res.json(await getTrends(uid(req), days));
}));

router.get('/companies', ah(async (req: Request, res: Response) => {
  res.json(await getTopCompanies(uid(req), 15));
}));

router.get('/activity', ah(async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(5, parseInt((req.query.limit as string) || '20') || 20));
  res.json(await getRecentActivity(uid(req), limit));
}));

export default router;
