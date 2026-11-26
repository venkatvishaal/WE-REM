import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../db/database';
import { generateId } from '../utils/crypto';

const router = Router();

// Latest interview email per application; kept even if the application is later rejected
const APP_SELECT = `SELECT a.*,
  (SELECT occurred_at FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview' ORDER BY occurred_at DESC LIMIT 1) AS interview_at,
  (SELECT COALESCE(description, title) FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview' ORDER BY occurred_at DESC LIMIT 1) AS interview_note,
  (SELECT COUNT(*) FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview') AS interview_count,
  CAST(MAX(0, julianday(date(a.first_response_at)) - julianday(date(a.applied_at))) AS INTEGER) AS days_to_first_response,
  CAST(MAX(0, julianday(date(a.last_response_at)) - julianday(date(a.applied_at))) AS INTEGER) AS days_to_last_response,
  CAST(MAX(0, julianday('now') - julianday(date(a.applied_at))) AS INTEGER) AS days_since_applied,
  (SELECT source FROM timeline_events t WHERE t.application_id = a.id AND t.occurred_at = a.last_response_at LIMIT 1) AS last_response_source
  FROM applications a`;

// ── GET /api/applications ──────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const {
    status,
    company,
    search,
    sort = 'last_activity_at',
    order = 'desc',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status === 'interviewed') {
    conditions.push(`EXISTS (SELECT 1 FROM timeline_events t WHERE t.application_id = a.id AND t.event_type = 'interview')`);
  } else if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (company) {
    conditions.push('company_name LIKE ?');
    params.push(`%${company}%`);
  }
  if (search) {
    conditions.push('(company_name LIKE ? OR job_title LIKE ? OR requisition_id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSorts = ['last_activity_at', 'applied_at', 'company_name', 'job_title', 'status', 'interview_at', 'last_response_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'last_activity_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const totalRow = dbGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications a ${where}`,
    params,
  );

  const applications = dbAll(
    `${APP_SELECT} ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  res.json({
    data: applications,
    pagination: {
      total: totalRow?.count ?? 0,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(((totalRow?.count as number) ?? 0) / limitNum),
    },
  });
});

// ── GET /api/applications/:id ──────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const app = dbGet(`${APP_SELECT} WHERE a.id = ?`, [req.params.id]);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json(app);
});

// ── POST /api/applications ─────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const {
    company_name,
    job_title,
    requisition_id,
    portal_url,
    portal_tenant,
    status = 'applied',
    location,
    job_type,
    salary_range,
    notes,
    applied_at,
  } = req.body;

  if (!company_name || !job_title) {
    res.status(400).json({ error: 'company_name and job_title are required' });
    return;
  }

  const id = generateId();
  const now = new Date().toISOString();
  const appliedDate = applied_at || now;

  dbRun(
    `INSERT INTO applications
      (id, company_name, job_title, requisition_id, portal_url, portal_tenant,
       status, location, job_type, salary_range, notes, applied_at, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, company_name, job_title, requisition_id || null, portal_url || null,
     portal_tenant || null, status, location || null, job_type || null,
     salary_range || null, notes || null, appliedDate, appliedDate, now, now],
  );

  // Add initial timeline event
  dbRun(
    `INSERT INTO timeline_events (id, application_id, event_type, source, title, occurred_at)
     VALUES (?, ?, 'applied', 'manual', 'Application Submitted', ?)`,
    [generateId(), id, appliedDate],
  );

  const created = dbGet('SELECT * FROM applications WHERE id = ?', [id]);
  res.status(201).json(created);
});

// ── PATCH /api/applications/:id ────────────────────────────────
router.patch('/:id', (req: Request, res: Response) => {
  const existing = dbGet<Record<string, unknown>>('SELECT * FROM applications WHERE id = ?', [req.params.id]);
  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const allowedFields = [
    'company_name', 'job_title', 'requisition_id', 'portal_url', 'portal_tenant',
    'status', 'location', 'job_type', 'salary_range', 'notes',
  ];

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
  values.push(now, now, req.params.id);

  dbRun(`UPDATE applications SET ${setClauses.join(', ')} WHERE id = ?`, values);

  // Record status change in timeline
  if (req.body.status && req.body.status !== existing.status) {
    dbRun(
      `INSERT INTO timeline_events (id, application_id, event_type, source, title, description, occurred_at)
       VALUES (?, ?, 'status_change', 'manual', 'Status Updated', ?, ?)`,
      [generateId(), req.params.id, `Status changed from ${existing.status} to ${req.body.status}`, now],
    );
  }

  const updated = dbGet(`${APP_SELECT} WHERE a.id = ?`, [req.params.id]);
  res.json(updated);
});

// ── DELETE /api/applications/:id ───────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const existing = dbGet('SELECT id FROM applications WHERE id = ?', [req.params.id]);
  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  dbRun('DELETE FROM applications WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── GET /api/applications/:id/timeline ────────────────────────
router.get('/:id/timeline', (req: Request, res: Response) => {
  const events = dbAll(
    `SELECT * FROM timeline_events WHERE application_id = ? ORDER BY occurred_at ASC`,
    [req.params.id],
  );
  res.json(events);
});

// ── POST /api/applications/:id/notes ──────────────────────────
router.post('/:id/notes', (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const now = new Date().toISOString();
  const eventId = generateId();

  dbRun(
    `INSERT INTO timeline_events (id, application_id, event_type, source, title, description, occurred_at)
     VALUES (?, ?, 'note', 'manual', 'Note Added', ?, ?)`,
    [eventId, req.params.id, content, now],
  );

  dbRun(
    `UPDATE applications SET last_activity_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, req.params.id],
  );

  const event = dbGet('SELECT * FROM timeline_events WHERE id = ?', [eventId]);
  res.status(201).json(event);
});

export default router;
