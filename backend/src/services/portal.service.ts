// Logged-in candidate-portal status checks (Workday "My Applications", SmartRecruiters).
// The user signs in themselves in a visible browser window; we only keep that browser
// profile's session cookies (data/portal-browser) and never see or type passwords.
import * as path from 'path';
import type { BrowserContext, Page } from 'playwright';
import { dbAll, dbGet, dbRun } from '../db/database';
import { generateId } from '../utils/crypto';
import { canTransitionStatus } from '../utils/workday-patterns';
import { responseOf } from './parser.service';

const PROFILE_DIR = path.resolve(__dirname, '../../data/portal-browser');
const OPEN_STATUSES = `status NOT IN ('rejected', 'withdrawn', 'offer', 'position_filled')`;

let busy: 'checking' | 'login' | null = null;

// ── Status text → tracker status ───────────────────────────────
// Order matters: "not offered" must hit rejected before "offer".
const PORTAL_STATUS_PATTERNS: Array<[RegExp, string | null]> = [
  [/not selected|no longer (?:under|being) consider|not (?:been )?offered|declined|unsuccessful|rejected|not moving forward/i, 'rejected'],
  [/position (?:has been )?filled|job (?:is |has been )?closed|requisition closed|posting closed/i, 'position_filled'],
  [/\bclosed\b/i, 'rejected'],
  [/\boffer\b/i, 'offer'],
  [/interview/i, 'interview'],
  [/in consideration|under review|in review|reviewing|screening/i, 'under_review'],
  [/submitted|application received|\bapplied\b/i, null], // no change
];

/** Maps a portal's status text. undefined = no status found, null = "submitted" (no news). */
export function portalStatusFromText(text: string): string | null | undefined {
  for (const [re, status] of PORTAL_STATUS_PATTERNS) if (re.test(text)) return status;
  return undefined;
}

interface PortalApp { id: string; job_title: string; requisition_id: string | null; status: string; portal_url: string }

/** Finds each application's row on the page (by requisition ID, then title) and reads the status after it. */
export function matchStatusesOnPage(pageText: string, apps: PortalApp[]): Map<string, { status: string | null; raw: string }> {
  const text = pageText.replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const found = new Map<string, { status: string | null; raw: string }>();
  for (const app of apps) {
    const keys = [app.requisition_id, app.job_title !== 'Position Applied' ? app.job_title : null]
      .filter((k): k is string => !!k && k.length >= 3)
      .map((k) => k.toLowerCase());
    for (const key of keys) {
      const idx = lower.indexOf(key);
      if (idx < 0) continue;
      const raw = text.slice(idx, idx + 250); // one card: title, ref id, status, date
      const status = portalStatusFromText(raw.slice(key.length));
      if (status !== undefined) { found.set(app.id, { status, raw }); break; }
    }
  }
  // Single application on this portal: the only status on the page is its status
  if (found.size === 0 && apps.length === 1) {
    const listStart = lower.search(/my applications|candidate home/);
    if (listStart >= 0) {
      const raw = text.slice(listStart, listStart + 600);
      const status = portalStatusFromText(raw.replace(/my applications|candidate home/gi, ''));
      if (status !== undefined) found.set(apps[0].id, { status, raw });
    }
  }
  return found;
}

// ── Browser ────────────────────────────────────────────────────
async function openProfile(headless: boolean): Promise<BrowserContext> {
  const { chromium } = await import('playwright');
  return chromium.launchPersistentContext(PROFILE_DIR, { headless, viewport: { width: 1280, height: 900 } });
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}

async function setHostState(host: string, state: string, error: string | null = null): Promise<void> {
  await dbRun(
    `INSERT INTO portal_hosts (host, state, error, last_checked) VALUES (?, ?, ?, ?)
     ON CONFLICT(host) DO UPDATE SET state = excluded.state, error = excluded.error, last_checked = excluded.last_checked`,
    [host, state, error, new Date().toISOString()],
  );
}

async function readPortalPage(page: Page, url: string): Promise<{ state: 'ok' | 'needs_login' | 'error'; text?: string; error?: string }> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  let text = await page.evaluate(() => (globalThis as any).document.body.innerText as string);

  const onLoginPage = /\/login\b/i.test(page.url()) ||
    (await page.locator('input[type="password"]').count()) > 0 ||
    /captcha|are you a robot/i.test(text);
  if (onLoginPage && !/my applications/i.test(text)) return { state: 'needs_login' };
  if (!/my applications|candidate home|applications/i.test(text)) return { state: 'error', error: 'Page layout not recognised' };

  // Rejected applications usually sit under the "Inactive" tab
  const inactive = page.getByText('Inactive', { exact: true }).first();
  if (await inactive.count()) {
    await inactive.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    text += '\n' + (await page.evaluate(() => (globalThis as any).document.body.innerText as string));
  }
  return { state: 'ok', text };
}

// ── Record a detected status ───────────────────────────────────
async function recordPortalStatus(app: PortalApp, detected: string, raw: string): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO portal_snapshots (id, application_id, snapshot_data, verification_mode, status_detected, captured_at)
     VALUES (?, ?, ?, 'browser', ?, ?)`,
    [generateId(), app.id, JSON.stringify({ raw: raw.slice(0, 300) }), detected, now],
  );
  if (detected === app.status || !canTransitionStatus(app.status, detected)) return;

  const eventType = detected === 'under_review' ? 'status_change' : detected;
  await dbRun(`UPDATE applications SET status = ?, last_activity_at = ?, updated_at = ?, portal_verification_mode = 'browser' WHERE id = ?`,
    [detected, now, now, app.id]);
  await dbRun(
    `INSERT INTO timeline_events (id, application_id, event_type, source, title, description, metadata, occurred_at)
     VALUES (?, ?, ?, 'portal', ?, ?, ?, ?)`,
    [generateId(), app.id, eventType, `Portal: ${detected.replace(/_/g, ' ')}`, `Portal shows: ${raw.slice(0, 160)}`,
      JSON.stringify({ status_to: detected }), now],
  );
  // The portal shows no decision date, so the response date is when we first saw it
  const response = responseOf({ eventType, statusHint: detected });
  if (response) {
    await dbRun(
      `UPDATE applications SET first_response_at = COALESCE(first_response_at, ?), last_response_type = ?, last_response_at = ? WHERE id = ?`,
      [now, response, now, app.id],
    );
  }
}

const PORTAL_URL_FILTER = `(portal_url LIKE 'https://%/userHome' OR portal_url LIKE 'https://jobs.smartrecruiters.com/my-applications/%')`;

// ── Public API (portal checks run on the operator's own machine only; see ENABLE_PORTAL_CHECKS) ──
export async function getPortalStatus(userId: string) {
  const rows = await dbAll<{ host: string; apps: number; open_apps: number; company: string; url: string }>(
    `SELECT split_part(portal_url, '/', 3) AS host,
            COUNT(*) AS apps, SUM(CASE WHEN ${OPEN_STATUSES} THEN 1 ELSE 0 END) AS open_apps,
            CASE WHEN bool_or(portal_url LIKE 'https://jobs.smartrecruiters.com/%') THEN 'SmartRecruiters (' || COUNT(DISTINCT company_name) || ' companies)'
                 ELSE MIN(company_name) END AS company,
            MIN(portal_url) AS url
     FROM applications
     WHERE user_id = ? AND ${PORTAL_URL_FILTER}
     GROUP BY 1 ORDER BY company`,
    [userId],
  );
  const states = new Map((await dbAll<any>('SELECT * FROM portal_hosts')).map((r) => [r.host, r]));
  return {
    busy,
    portals: rows.map((r) => ({ ...r, state: states.get(r.host)?.state || 'unchecked', error: states.get(r.host)?.error || null, last_checked: states.get(r.host)?.last_checked || null })),
  };
}

/** Opens a visible browser on the portal so the user can sign in; the session is kept when they close it. */
export async function openPortalLogin(userId: string, host: string): Promise<void> {
  if (busy) throw new Error(busy === 'login' ? 'A portal login window is already open' : 'A portal check is running');
  const app = await dbGet<{ portal_url: string }>(`SELECT portal_url FROM applications WHERE user_id = ? AND portal_url LIKE ? LIMIT 1`, [userId, `https://${host}/%`]);
  if (!app) throw new Error('Unknown portal');
  busy = 'login';
  try {
    const ctx = await openProfile(false);
    ctx.on('close', () => { busy = null; setHostState(host, 'unchecked').catch(() => {}); });
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto(app.portal_url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  } catch (err) {
    busy = null;
    throw err;
  }
}

export async function verifyAllApplications(userId: string): Promise<{ checked: number; updated: number }> {
  if (busy) return { checked: 0, updated: 0 };
  busy = 'checking';
  let checked = 0, updated = 0, ctx: BrowserContext | null = null;
  try {
    const apps = await dbAll<PortalApp>(
      `SELECT id, job_title, requisition_id, status, portal_url FROM applications
       WHERE user_id = ? AND ${OPEN_STATUSES} AND ${PORTAL_URL_FILTER}`,
      [userId],
    );
    const byUrl = new Map<string, PortalApp[]>();
    for (const a of apps) {
      // Workday: one userHome lists every application on that tenant; SmartRecruiters: one page per application
      byUrl.set(a.portal_url, [...(byUrl.get(a.portal_url) || []), a]);
    }
    console.log(`[Portal] Checking ${apps.length} open applications on ${byUrl.size} portal pages...`);
    if (byUrl.size === 0) return { checked, updated };

    ctx = await openProfile(true);
    const page = ctx.pages()[0] || (await ctx.newPage());
    for (const [url, group] of byUrl) {
      const host = hostOf(url);
      try {
        const result = await readPortalPage(page, url);
        await setHostState(host, result.state, result.error || null);
        if (result.state !== 'ok' || !result.text) continue;
        checked += group.length;
        for (const [appId, { status, raw }] of matchStatusesOnPage(result.text, group)) {
          const app = group.find((a) => a.id === appId)!;
          if (status && status !== app.status && canTransitionStatus(app.status, status)) updated++;
          if (status) await recordPortalStatus(app, status, raw);
        }
      } catch (err: any) {
        await setHostState(host, 'error', String(err?.message || err).slice(0, 200));
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`[Portal] Done: ${checked} checked, ${updated} updated`);
    return { checked, updated };
  } finally {
    await ctx?.close().catch(() => {});
    busy = null;
  }
}
