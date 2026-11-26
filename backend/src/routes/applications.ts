import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database';
import { generateId } from '../utils/crypto';
import { ah, uid } from '../middleware/auth';

const router = Router();

const days = (later: string, earlier = 'a.applied_at') =>
  `CASE WHEN ${later} IS NULL THEN NULL ELSE GREATEST(0, ${later}::timestamptz::date - ${earlier}::timestamptz::date) END`;

// Latest interview email per application; kept even if the application is later rejected
const APP_SELECT = `SELECT a.*,
  (SELECT occurred_at FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview' ORDER BY occurred_at DESC LIMIT 1) AS interview_at,
  (SELECT COALESCE(description, title) FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview' ORDER BY occurred_at DESC LIMIT 1) AS interview_note,
  (SELECT COUNT(*) FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview') AS interview_count,
  ${days('a.first_response_at')} AS days_to_first_response,
  ${days('a.last_response_at')} AS days_to_last_response,
  ${days('now()')} AS days_since_applied,
  (SELECT source FROM timeline_events t WHERE t.application_id = a.id AND t.occurred_at = a.last_response_at LIMIT 1) AS last_response_source
  FROM applications a`;

/** The application if it belongs to this user. */
const ownApp = (req: Request) =>
  dbGet<Record<string, any>>('SELECT * FROM applications WHERE id = ? AND user_id = ?', [req.params.id, uid(req)]);

// ── GET /api/applications ──────────────────────────────────────
router.get('/', ah(async (req: Request, res: Response) => {
  const { status, company, search, sort = 'last_activity_at', order = 'desc', page = '1', limit = '20' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ['a.user_id = ?'];
  const params: unknown[] = [uid(req)];

  if (status === 'interviewed') {
    conditions.push(`EXISTS (SELECT 1 FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview')`);
  } else if (status && status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (company) {
    conditions.push('a.company_name ILIKE ?');
    params.push(`%${company}%`);
  }
  if (search) {
    conditions.push('(a.company_name ILIKE ? OR a.job_title ILIKE ? OR a.requisition_id ILIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const allowedSorts = ['last_activity_at', 'applied_at', 'company_name', 'job_title', 'status', 'interview_at', 'last_response_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'last_activity_at';
  const safeOrder = order === 'asc' ? 'ASC NULLS FIRST' : 'DESC NULLS LAST';

  const total = (await dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM applications a ${where}`, params))?.count ?? 0;
  const applications = await dbAll(`${APP_SELECT} ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`, [...params, limitNum, offset]);

  res.json({ data: applications, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
}));

// ── GET /api/applications/:id ──────────────────────────────────
router.get('/:id', ah(async (req: Request, res: Response) => {
  const app = await dbGet(`${APP_SELECT} WHERE a.id = ? AND a.user_id = ?`, [req.params.id, uid(req)]);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json(app);
}));

// ── POST /api/applications ─────────────────────────────────────
router.post('/', ah(async (req: Request, res: Response) => {
  const { company_name, job_title, requisition_id, portal_url, portal_tenant, status = 'applied', location, job_type, salary_range, notes, applied_at } = req.body;

  if (!company_name || !job_title) {
    res.status(400).json({ error: 'company_name and job_title are required' });
    return;
  }

  const id = generateId();
  const now = new Date().toISOString();
  const appliedDate = applied_at ? new Date(applied_at).toISOString() : now;

  await dbRun(
    `INSERT INTO applications
      (id, user_id, company_name, job_title, requisition_id, portal_url, portal_tenant,
       status, location, job_type, salary_range, notes, applied_at, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, uid(req), company_name, job_title, requisition_id || null, portal_url || null,
     portal_tenant || null, status, location || null, job_type || null,
     salary_range || null, notes || null, appliedDate, appliedDate, now, now],
  );

  await dbRun(
    `INSERT INTO timeline_events (id, application_id, event_type, source, title, occurred_at)
     VALUES (?, ?, 'applied', 'manual', 'Application Submitted', ?)`,
    [generateId(), id, appliedDate],
  );

  res.status(201).json(await dbGet('SELECT * FROM applications WHERE id = ? AND user_id = ?', [id, uid(req)]));
}));

// ── PATCH /api/applications/:id ────────────────────────────────
router.patch('/:id', ah(async (req: Request, res: Response) => {
  const existing = await ownApp(req);
  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const allowedFields = ['company_name', 'job_title', 'requisition_id', 'portal_url', 'portal_tenant', 'status', 'location', 'job_type', 'salary_range', 'notes'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (setClauses.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const now = new Date().toISOString();
  setClauses.push('updated_at = ?', 'last_activity_at = ?');
  values.push(now, now, req.params.id, uid(req));
  await dbRun(`UPDATE applications SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`, values);

  if (req.body.status && req.body.status !== existing.status) {
    await dbRun(
      `INSERT INTO timeline_events (id, application_id, event_type, source, title, description, occurred_at)
       VALUES (?, ?, 'status_change', 'manual', 'Status Updated', ?, ?)`,
      [generateId(), req.params.id, `Status changed from ${existing.status} to ${req.body.status}`, now],
    );
  }

  res.json(await dbGet(`${APP_SELECT} WHERE a.id = ? AND a.user_id = ?`, [req.params.id, uid(req)]));
}));

// ── DELETE /api/applications/:id ───────────────────────────────
router.delete('/:id', ah(async (req: Request, res: Response) => {
  if (!(await ownApp(req))) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  await dbRun('DELETE FROM applications WHERE id = ? AND user_id = ?', [req.params.id, uid(req)]);
  res.json({ success: true });
}));

// ── GET /api/applications/:id/timeline ────────────────────────
router.get('/:id/timeline', ah(async (req: Request, res: Response) => {
  const events = await dbAll(
    `SELECT t.* FROM timeline_events t JOIN applications a ON a.id = t.application_id
     WHERE t.application_id = ? AND a.user_id = ? ORDER BY t.occurred_at ASC`,
    [req.params.id, uid(req)],
  );
  res.json(events);
}));

// ── POST /api/applications/:id/notes ──────────────────────────
router.post('/:id/notes', ah(async (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  if (!(await ownApp(req))) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const now = new Date().toISOString();
  const eventId = generateId();
  await dbRun(
    `INSERT INTO timeline_events (id, application_id, event_type, source, title, description, occurred_at)
     VALUES (?, ?, 'note', 'manual', 'Note Added', ?, ?)`,
    [eventId, req.params.id, content, now],
  );
  await dbRun(`UPDATE applications SET last_activity_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`, [now, now, req.params.id, uid(req)]);

  res.status(201).json(await dbGet('SELECT * FROM timeline_events WHERE id = ?', [eventId]));
}));

export default router;
