import * as cron from 'node-cron';
import { dbGet, dbRun, dbAll, persistDb } from '../db/database';
import { fetchNewMessages, isAuthenticated, clearTokens } from './gmail.service';
import { parseEmail, upsertApplication, reparseStoredEmails } from './parser.service';
import { verifyAllApplications } from './portal.service';
import { notifyStatusChange, notifyActionRequired, notifySyncComplete, notifyError, notifyJobEmail } from './notification.service';
import { generateId } from '../utils/crypto';

let gmailCronJob: cron.ScheduledTask | null = null;
let portalCronJob: cron.ScheduledTask | null = null;
let syncRunning = false;

// ── Gmail Sync ─────────────────────────────────────────────────
export async function runGmailSync(forceFull = false): Promise<{ emailsFetched: number; appsCreated: number; appsUpdated: number }> {
  if (syncRunning) {
    console.log('[Monitor] Already running, skipping');
    return { emailsFetched: 0, appsCreated: 0, appsUpdated: 0 };
  }
  if (!isAuthenticated()) {
    console.log('[Monitor] Not authenticated');
    return { emailsFetched: 0, appsCreated: 0, appsUpdated: 0 };
  }

  syncRunning = true;
  const syncId = generateId();
  const startedAt = new Date().toISOString();

  dbRun(`INSERT INTO sync_log (id, sync_type, status, started_at) VALUES (?, 'gmail', 'running', ?)`, [syncId, startedAt]);
  dbRun(`UPDATE settings SET value = 'syncing', updated_at = ? WHERE key = 'sync_status'`, [startedAt]);

  let emailsFetched = 0, emailsParsed = 0, appsCreated = 0, appsUpdated = 0;
  let syncError: string | null = null;

  try {
    const historyIdRow = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['gmail_history_id']);
    const sinceHistoryId = forceFull ? undefined : (historyIdRow?.value || undefined);

    // Get all message IDs already stored in local DB to avoid wasting API quota re-downloading them
    const existingRows = dbAll<{ gmail_message_id: string }>('SELECT gmail_message_id FROM email_messages');
    const existingIds = new Set(existingRows.map((r) => r.gmail_message_id));

    console.log(`[Monitor] Fetching job application messages (mode: ${forceFull ? 'full scrape' : sinceHistoryId ? `historyId ${sinceHistoryId}` : 'full search'})...`);
    const messages = await fetchNewMessages(sinceHistoryId, 500, forceFull, existingIds);
    emailsFetched = messages.length;
    console.log(`[Monitor] Fetched ${emailsFetched} messages from Gmail`);

    for (const msg of messages) {
      const existingEmail = dbGet('SELECT id FROM email_messages WHERE gmail_message_id = ?', [msg.id]);
      let emailMessageId: string;

      if (!existingEmail) {
        emailMessageId = generateId();
        dbRun(
          `INSERT INTO email_messages (id, gmail_message_id, subject, sender, received_at, body_text, body_html, parsed)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            emailMessageId,
            msg.id,
            msg.subject,
            msg.sender,
            msg.receivedAt,
            msg.bodyText?.slice(0, 50000) || '',
            msg.bodyHtml?.slice(0, 100000) || '',
          ],
        );
      } else {
        emailMessageId = (existingEmail as any).id;
      }

      try {
        const parsed = parseEmail(msg);
        if (parsed) {
          emailsParsed++;
          const result = upsertApplication(parsed, emailMessageId);

          dbRun('UPDATE email_messages SET parsed = 1, application_id = ? WHERE id = ?', [result.applicationId, emailMessageId]);

          if (result.isNew) {
            appsCreated++;
          } else {
            appsUpdated++;
            if (result.statusChanged && result.previousStatus) {
              const app = dbGet<any>('SELECT company_name, job_title FROM applications WHERE id = ?', [result.applicationId]);
              if (app) await notifyStatusChange(result.applicationId, app.company_name, app.job_title, result.previousStatus, parsed.status);
            }
          }

          // Phone alert for every newly fetched job email (reparse never reaches here)
          const alertApp = dbGet<any>('SELECT company_name, job_title FROM applications WHERE id = ?', [result.applicationId]);
          if (alertApp) await notifyJobEmail(alertApp.company_name, alertApp.job_title, parsed.eventType, msg.subject, msg.receivedAt);

          if (['assessment', 'document_request', 'interview'].includes(parsed.eventType)) {
            const app = dbGet<any>('SELECT company_name, job_title FROM applications WHERE id = ?', [result.applicationId]);
            if (app) {
              await notifyActionRequired(
                result.applicationId,
                app.company_name,
                app.job_title,
                parsed.eventType === 'interview'
                  ? 'Interview scheduled'
                  : parsed.eventType === 'assessment'
                  ? 'Assessment pending'
                  : 'Document requested',
              );
            }
          }
        }
      } catch (err) {
        console.error(`[Monitor] Parse error for message ${msg.id}:`, err);
      }
    }

    // Pick up any stored emails not processed yet (e.g. from a sync that failed mid-way)
    try {
      const reparseRes = await reparseStoredEmails(true);
      appsCreated += reparseRes.appsCreated;
      appsUpdated += reparseRes.appsUpdated;
      console.log(`[Monitor] Reparsed stored DB emails: ${reparseRes.parsed}/${reparseRes.total} parsed (${reparseRes.appsCreated} new, ${reparseRes.appsUpdated} updated)`);
    } catch (err) {
      console.warn('[Monitor] Reparse stored emails note:', err);
    }

    // Save history ID
    const latestHistoryId = (messages[0] as any)?._historyId || '';
    if (latestHistoryId) {
      dbRun(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'gmail_history_id'`, [latestHistoryId, new Date().toISOString()]);
    }

    const now = new Date().toISOString();
    dbRun(`UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_gmail_sync'`, [now, now]);
    await notifySyncComplete(emailsFetched, appsCreated, appsUpdated);
    dbRun(
      `UPDATE sync_log SET status = 'success', emails_fetched = ?, emails_parsed = ?, apps_created = ?, apps_updated = ?, completed_at = ? WHERE id = ?`,
      [emailsFetched, emailsParsed, appsCreated, appsUpdated, now, syncId],
    );

    console.log(`[Monitor] Sync complete: ${emailsFetched} fetched, ${emailsParsed} parsed, ${appsCreated} new apps, ${appsUpdated} updated apps`);
    return { emailsFetched, appsCreated, appsUpdated };
  } catch (err: any) {
    syncError = err?.message || String(err);
    if (syncError && syncError.includes('invalid_grant')) {
      console.warn('[Monitor] Gmail OAuth refresh token expired (invalid_grant). Clearing expired credentials and stopping sync loop.');
      clearTokens();
      stopMonitoring();
      await notifyError(
        'Gmail session expired',
        'Your Google OAuth authorization has expired. Please go to Settings and click "Connect Gmail" to re-authenticate.',
      );
    } else if (
      syncError &&
      (syncError.includes('Quota exceeded') ||
        syncError.includes('rateLimitExceeded') ||
        syncError.includes('RESOURCE_EXHAUSTED'))
    ) {
      console.warn('[Monitor] Gmail API per-minute rate limit hit. Waiting for quota window to reset.');
      const recentQuotaNotif = dbGet('SELECT id FROM notifications WHERE type = ? AND sent_at > datetime("now", "-15 minutes")', ['sync_quota']);
      if (!recentQuotaNotif) {
        dbRun(
          `INSERT INTO notifications (id, type, title, body, channels, read, sent_at)
           VALUES (?, 'sync_quota', 'Gmail rate limit reached', 'Gmail per-minute query rate limit reached. Background sync will automatically resume once the window resets.', '["in_app"]', 0, datetime("now"))`,
          [generateId()],
        );
      }
    } else {
      console.error('[Monitor] Sync error:', err);
      await notifyError('Gmail sync failed', syncError || undefined);
    }
    dbRun(`UPDATE sync_log SET status = 'error', error = ?, completed_at = ? WHERE id = ?`, [syncError, new Date().toISOString(), syncId]);
    return { emailsFetched: 0, appsCreated: 0, appsUpdated: 0 };
  } finally {
    syncRunning = false;
    dbRun(`UPDATE settings SET value = 'idle', updated_at = ? WHERE key = 'sync_status'`, [new Date().toISOString()]);
    persistDb();
  }
}

// ── Portal Verification ────────────────────────────────────────
async function runPortalVerification(): Promise<void> {
  const enabled = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['portal_verify_enabled'])?.value === 'true';
  if (!enabled) return;
  console.log('[Monitor] Running portal verification...');
  try {
    await verifyAllApplications();
  } catch (err) {
    console.error('[Monitor] Portal verification error:', err);
  }
}

// ── Start/Stop ─────────────────────────────────────────────────
export function startMonitoring(): void {
  stopMonitoring(); // re-auth calls this again; don't stack cron jobs
  const gmailCron = process.env.GMAIL_SYNC_CRON || '*/15 * * * *';
  const portalCron = process.env.PORTAL_VERIFY_CRON || '0 */6 * * *';

  gmailCronJob = cron.schedule(gmailCron, () => runGmailSync().catch(console.error));
  portalCronJob = cron.schedule(portalCron, () => runPortalVerification().catch(console.error));

  console.log(`[Monitor] Gmail cron: ${gmailCron}, Portal cron: ${portalCron}`);

  // Initial sync after 3s
  setTimeout(() => runGmailSync().catch(console.error), 3000);
}

export function stopMonitoring(): void {
  gmailCronJob?.stop();
  portalCronJob?.stop();
  console.log('[Monitor] Stopped');
}

export function getSyncStatus() {
  const lastSync = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['last_gmail_sync'])?.value || null;
  const syncStatus = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['sync_status'])?.value || 'idle';
  return {
    isRunning: syncStatus === 'syncing',
    lastSync,
    lastError: null as string | null,
    gmailCron: process.env.GMAIL_SYNC_CRON || '*/15 * * * *',
    nextRun: null as string | null,
  };
}
