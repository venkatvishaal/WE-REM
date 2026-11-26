import { dbAll, dbGet } from '../db/database';

export interface ApplicationStats {
  total: number;
  byStatus: Record<string, number>;
  activeCount: number;
  interviewCount: number;
  offerCount: number;
  rejectionCount: number;
  responseRate: number;
  avgDaysToResponse: number;
  responsesByType: Record<'accepted' | 'moved_forward' | 'interview' | 'rejected' | 'none', number>;
  thisWeek: number;
  thisMonth: number;
}

export interface TrendPoint {
  date: string;
  applied: number;
  interviews: number;
  offers: number;
  rejections: number;
}

export function getStats(): ApplicationStats {
  const total = (dbGet<{ count: number }>('SELECT COUNT(*) as count FROM applications'))?.count ?? 0;

  const byStatusRows = dbAll<{ status: string; count: number }>(
    'SELECT status, COUNT(*) as count FROM applications GROUP BY status',
  );

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) byStatus[row.status] = Number(row.count);

  const activeCount = (byStatus['applied'] || 0) + (byStatus['acknowledged'] || 0) +
    (byStatus['under_review'] || 0) + (byStatus['interview'] || 0) + (byStatus['assessment'] || 0);
  const interviewCount = byStatus['interview'] || 0;
  const offerCount = byStatus['offer'] || 0;
  const rejectionCount = byStatus['rejected'] || 0;
  // A "response" is a real company reply (not an automated acknowledgement)
  const responsesByType = { accepted: 0, moved_forward: 0, interview: 0, rejected: 0, none: 0 };
  for (const row of dbAll<{ t: string | null; count: number }>(
    'SELECT last_response_type AS t, COUNT(*) AS count FROM applications GROUP BY last_response_type',
  )) {
    responsesByType[(row.t || 'none') as keyof typeof responsesByType] = Number(row.count);
  }
  const responded = Number(total) - responsesByType.none;
  const responseRate = total > 0 ? Math.round((responded / Number(total)) * 100) : 0;

  const avgDaysRow = dbGet<{ avg: number }>(`
    SELECT AVG(MAX(0, julianday(first_response_at) - julianday(applied_at))) as avg
    FROM applications WHERE first_response_at IS NOT NULL
  `);
  const avgDaysToResponse = Math.round((avgDaysRow?.avg as number) ?? 0);

  const thisWeek = (dbGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications WHERE applied_at >= datetime('now', '-7 days')`,
  ))?.count ?? 0;

  const thisMonth = (dbGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications WHERE applied_at >= datetime('now', '-30 days')`,
  ))?.count ?? 0;

  return { total: Number(total), byStatus, activeCount, interviewCount, offerCount, rejectionCount, responseRate, avgDaysToResponse, responsesByType, thisWeek: Number(thisWeek), thisMonth: Number(thisMonth) };
}

export function getTrends(days = 30): TrendPoint[] {
  const trends: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const applied = Number((dbGet<{ count: number }>('SELECT COUNT(*) as count FROM applications WHERE DATE(applied_at) = ?', [dateStr]))?.count ?? 0);
    const interviews = Number((dbGet<{ count: number }>(`SELECT COUNT(*) as count FROM timeline_events WHERE event_type = 'interview' AND DATE(occurred_at) = ?`, [dateStr]))?.count ?? 0);
    const offers = Number((dbGet<{ count: number }>(`SELECT COUNT(*) as count FROM timeline_events WHERE event_type = 'offer' AND DATE(occurred_at) = ?`, [dateStr]))?.count ?? 0);
    const rejections = Number((dbGet<{ count: number }>(`SELECT COUNT(*) as count FROM timeline_events WHERE event_type = 'rejected' AND DATE(occurred_at) = ?`, [dateStr]))?.count ?? 0);

    trends.push({ date: dateStr, applied, interviews, offers, rejections });
  }
  return trends;
}

export function getTopCompanies(limit = 10) {
  return dbAll<{ company: string; count: number; latestStatus: string }>(
    `SELECT company_name as company, COUNT(*) as count, MAX(status) as latestStatus
     FROM applications GROUP BY company_name ORDER BY count DESC LIMIT ?`,
    [limit],
  );
}

export function getRecentActivity(limit = 20): unknown[] {
  return dbAll(
    `SELECT te.*, a.company_name, a.job_title
     FROM timeline_events te JOIN applications a ON a.id = te.application_id
     ORDER BY te.occurred_at DESC LIMIT ?`,
    [limit],
  );
}
