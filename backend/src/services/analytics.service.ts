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

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

export async function getStats(userId: string): Promise<ApplicationStats> {
  const byStatus: Record<string, number> = {};
  for (const row of await dbAll<{ status: string; count: number }>(
    'SELECT status, COUNT(*) AS count FROM applications WHERE user_id = ? GROUP BY status', [userId])) {
    byStatus[row.status] = row.count;
  }
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const activeCount = (byStatus['applied'] || 0) + (byStatus['acknowledged'] || 0) +
    (byStatus['under_review'] || 0) + (byStatus['interview'] || 0) + (byStatus['assessment'] || 0);

  // A "response" is a real company reply (not an automated acknowledgement)
  const responsesByType = { accepted: 0, moved_forward: 0, interview: 0, rejected: 0, none: 0 };
  for (const row of await dbAll<{ t: string | null; count: number }>(
    'SELECT last_response_type AS t, COUNT(*) AS count FROM applications WHERE user_id = ? GROUP BY last_response_type', [userId])) {
    responsesByType[(row.t || 'none') as keyof typeof responsesByType] = row.count;
  }
  const responded = total - responsesByType.none;

  const row = await dbGet<{ avg: number | null; week: number; month: number }>(
    `SELECT
       AVG(CASE WHEN first_response_at IS NOT NULL
                THEN GREATEST(0, EXTRACT(EPOCH FROM (first_response_at::timestamptz - applied_at::timestamptz)) / 86400) END) AS avg,
       COUNT(*) FILTER (WHERE applied_at >= ?) AS week,
       COUNT(*) FILTER (WHERE applied_at >= ?) AS month
     FROM applications WHERE user_id = ?`,
    [daysAgo(7), daysAgo(30), userId],
  );

  return {
    total, byStatus, activeCount,
    interviewCount: byStatus['interview'] || 0,
    offerCount: byStatus['offer'] || 0,
    rejectionCount: byStatus['rejected'] || 0,
    responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
    avgDaysToResponse: Math.round(Number(row?.avg) || 0),
    responsesByType,
    thisWeek: row?.week ?? 0,
    thisMonth: row?.month ?? 0,
  };
}

export async function getTrends(userId: string, days = 30): Promise<TrendPoint[]> {
  const since = daysAgo(days).slice(0, 10);
  const applied = await dbAll<{ d: string; n: number }>(
    `SELECT substr(applied_at, 1, 10) AS d, COUNT(*) AS n FROM applications
     WHERE user_id = ? AND applied_at >= ? GROUP BY d`, [userId, since]);
  const events = await dbAll<{ d: string; event_type: string; n: number }>(
    `SELECT substr(t.occurred_at, 1, 10) AS d, t.event_type, COUNT(*) AS n
     FROM timeline_events t JOIN applications a ON a.id = t.application_id
     WHERE a.user_id = ? AND t.occurred_at >= ? AND t.event_type IN ('interview', 'offer', 'rejected')
     GROUP BY d, t.event_type`, [userId, since]);

  const appliedBy = new Map(applied.map((r) => [r.d, r.n]));
  const eventBy = new Map(events.map((r) => [`${r.d}|${r.event_type}`, r.n]));
  const trends: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const d = date.toISOString().slice(0, 10);
    trends.push({
      date: d,
      applied: appliedBy.get(d) || 0,
      interviews: eventBy.get(`${d}|interview`) || 0,
      offers: eventBy.get(`${d}|offer`) || 0,
      rejections: eventBy.get(`${d}|rejected`) || 0,
    });
  }
  return trends;
}

export function getTopCompanies(userId: string, limit = 10) {
  return dbAll<{ company: string; count: number; latestStatus: string }>(
    `SELECT company_name AS company, COUNT(*) AS count, MAX(status) AS "latestStatus"
     FROM applications WHERE user_id = ? GROUP BY company_name ORDER BY count DESC LIMIT ?`,
    [userId, limit],
  );
}

export function getRecentActivity(userId: string, limit = 20): Promise<unknown[]> {
  return dbAll(
    `SELECT te.*, a.company_name, a.job_title
     FROM timeline_events te JOIN applications a ON a.id = te.application_id
     WHERE a.user_id = ? ORDER BY te.occurred_at DESC LIMIT ?`,
    [userId, limit],
  );
}
