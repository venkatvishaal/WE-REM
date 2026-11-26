import { dbGet, dbRun, dbAll } from '../db/database';
import { fetchNewMessages } from './gmail.service';
import { parseEmail, upsertApplication, reparseStoredEmails, stripHtml } from './parser.service';
import { notifyStatusChange, notifyActionRequired, notifySyncComplete, notifyError, notifyJobEmail, notifyReconnectNeeded, dispatch } from './notification.service';
import { getSetting, setSetting } from './user.service';
import { candidatePortalUrl } from '../utils/workday-patterns';
import { generateId } from '../utils/crypto';

const BODY_LIMIT = 4000;
const running = new Set<string>(); // user IDs with a sync in progress

/** What we keep of an email: the first 4 KB of text plus any candidate-portal link (often only in the HTML). */
export function storedBody(bodyText: string, bodyHtml: string): string {
  const text = (bodyText || stripHtml(bodyHtml || '')).slice(0, BODY_LIMIT);
  const portal = candidatePortalUrl(bodyHtml || '');
  return portal && !text.includes(portal) ? `${text}\n${portal}` : text;
}

// ── Gmail sync for one user ────────────────────────────────────
export async function runGmailSync(userId: string, forceFull = false): Promise<{ emailsFetched: number; appsCreated: number; appsUpdated: number }> {
  const none = { emailsFetched: 0, appsCreated: 0, appsUpdated: 0 };
  if (running.has(userId)) return none;
  const user = await dbGet<{ gmail_tokens_enc: string | null; gmail_history_id: string | null }>(
    'SELECT gmail_tokens_enc, gmail_history_id FROM users WHERE id = ?', [userId]);
  if (!user?.gmail_tokens_enc) return none;

  running.add(userId);
  const syncId = generateId();
  const startedAt = new Date().toISOString();
  await dbRun(`INSERT INTO sync_log (id, user_id, sync_type, status, started_at) VALUES (?, ?, 'gmail', 'running', ?)`, [syncId, userId, startedAt]);
  await dbRun(`UPDATE users SET sync_status = 'syncing' WHERE id = ?`, [userId]);

  let emailsFetched = 0, emailsParsed = 0, appsCreated = 0, appsUpdated = 0;
  let finalStatus = 'idle';

  try {
    const sinceHistoryId = forceFull ? undefined : (user.gmail_history_id || undefined);
    const existingRows = await dbAll<{ gmail_message_id: string }>('SELECT gmail_message_id FROM email_messages WHERE user_id = ?', [userId]);
    const existingIds = new Set(existingRows.map((r) => r.gmail_message_id));

    const messages = await fetchNewMessages(userId, sinceHistoryId, 500, forceFull, existingIds);
    emailsFetched = messages.length;

    for (const msg of messages) {
      const existingEmail = await dbGet<{ id: string }>('SELECT id FROM email_messages WHERE user_id = ? AND gmail_message_id = ?', [userId, msg.id]);
      let emailMessageId: string;

      if (!existingEmail) {
        emailMessageId = generateId();
        await dbRun(
          `INSERT INTO email_messages (id, user_id, gmail_message_id, subject, sender, received_at, body_text, parsed)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT (user_id, gmail_message_id) DO NOTHING`,
          [emailMessageId, userId, msg.id, msg.subject, msg.sender, msg.receivedAt, storedBody(msg.bodyText, msg.bodyHtml)],
        );
      } else {
        emailMessageId = existingEmail.id;
      }

      try {
        const parsed = parseEmail(msg);
        if (!parsed) continue;
        emailsParsed++;
        const result = await upsertApplication(userId, parsed, emailMessageId);
        await dbRun('UPDATE email_messages SET parsed = 1, application_id = ? WHERE id = ? AND user_id = ?', [result.applicationId, emailMessageId, userId]);

        const app = await dbGet<any>('SELECT company_name, job_title FROM applications WHERE id = ? AND user_id = ?', [result.applicationId, userId]);
        if (result.isNew) appsCreated++;
        else {
          appsUpdated++;
          if (app && result.statusChanged && result.previousStatus) {
            await notifyStatusChange(userId, result.applicationId, app.company_name, app.job_title, result.previousStatus, parsed.status);
          }
        }
        if (!app) continue;

        // Phone alert for every newly fetched job email (reparse never reaches here)
        await notifyJobEmail(userId, app.company_name, app.job_title, parsed.eventType, msg.subject, msg.receivedAt);

        if (['assessment', 'document_request', 'interview'].includes(parsed.eventType)) {
          const action = parsed.eventType === 'interview' ? 'Interview scheduled' : parsed.eventType === 'assessment' ? 'Assessment pending' : 'Document requested';
          await notifyActionRequired(userId, result.applicationId, app.company_name, app.job_title, action);
        }
      } catch (err) {
        console.error(`[Monitor] Parse error for a message of user ${userId}:`, err);
      }
    }

    // Pick up any stored emails not processed yet (e.g. from a sync that failed mid-way)
    const reparseRes = await reparseStoredEmails(userId, true);
    appsCreated += reparseRes.appsCreated;
    appsUpdated += reparseRes.appsUpdated;

    const latestHistoryId = (messages[0] as any)?._historyId || '';
    if (latestHistoryId) await dbRun('UPDATE users SET gmail_history_id = ? WHERE id = ?', [latestHistoryId, userId]);

    const now = new Date().toISOString();
    await setSetting(userId, 'last_gmail_sync', now);
    await notifySyncComplete(userId, emailsFetched, appsCreated, appsUpdated);
    await dbRun(
      `UPDATE sync_log SET status = 'success', emails_fetched = ?, emails_parsed = ?, apps_created = ?, apps_updated = ?, completed_at = ? WHERE id = ?`,
      [emailsFetched, emailsParsed, appsCreated, appsUpdated, now, syncId],
    );
    console.log(`[Monitor] User ${userId}: ${emailsFetched} fetched, ${appsCreated} new, ${appsUpdated} updated`);
    return { emailsFetched, appsCreated, appsUpdated };
  } catch (err: any) {
    const syncError = String(err?.message || err);
    if (syncError.includes('invalid_grant')) {
      // Testing-mode tokens expire every 7 days; keep the user's data, ask them to reconnect
      finalStatus = 'reconnect_needed';
      await notifyReconnectNeeded(userId);
    } else if (/Quota exceeded|rateLimitExceeded|RESOURCE_EXHAUSTED/.test(syncError)) {
      const recent = await dbGet('SELECT id FROM notifications WHERE user_id = ? AND type = ? AND sent_at > ?',
        [userId, 'sync_quota', new Date(Date.now() - 15 * 60000).toISOString()]);
      if (!recent) await dispatch(userId, { type: 'sync_quota', title: 'Gmail rate limit reached', body: 'Gmail rate limit reached. Sync resumes automatically.', channels: ['in_app'] });
    } else {
      console.error(`[Monitor] Sync error for user ${userId}:`, syncError);
      await notifyError(userId, 'Gmail sync failed', syncError);
    }
    await dbRun(`UPDATE sync_log SET status = 'error', error = ?, completed_at = ? WHERE id = ?`, [syncError, new Date().toISOString(), syncId]);
    return none;
  } finally {
    running.delete(userId);
    await dbRun(`UPDATE users SET sync_status = ?, last_synced_at = ? WHERE id = ?`, [finalStatus, new Date().toISOString(), userId])
      .catch((err) => console.error('[Monitor] Could not save sync status:', err));
  }
}

// ── Round-robin scheduler ──────────────────────────────────────
// shortcut: one process syncs one user every 10s (~360 users per 15-min round at most); past ~300 users move to a job queue
const TICK_MS = 10_000;
const SYNC_EVERY_MS = Number(process.env.GMAIL_SYNC_MINUTES || 15) * 60_000;
let timer: NodeJS.Timeout | null = null;

/** The connected user whose last sync is oldest, if it is due. */
export async function nextUserToSync(now = Date.now()): Promise<string | undefined> {
  const due = new Date(now - SYNC_EVERY_MS).toISOString();
  const row = await dbGet<{ id: string }>(
    `SELECT u.id FROM users u
     WHERE u.gmail_tokens_enc IS NOT NULL AND u.sync_status <> 'reconnect_needed'
       AND (u.last_synced_at IS NULL OR u.last_synced_at < ?)
       AND NOT EXISTS (SELECT 1 FROM settings s WHERE s.user_id = u.id AND s.key = 'gmail_sync_enabled' AND s.value = 'false')
     ORDER BY u.last_synced_at ASC NULLS FIRST LIMIT 1`,
    [due],
  );
  return row?.id;
}

async function tick(): Promise<void> {
  const userId = await nextUserToSync();
  if (!userId) return;
  await runGmailSync(userId);
  if (process.env.ENABLE_PORTAL_CHECKS === 'true' && (await getSetting(userId, 'portal_verify_enabled')) === 'true') {
    const { verifyAllApplications } = await import('./portal.service');
    await verifyAllApplications(userId).catch((err) => console.error('[Monitor] Portal check error:', err));
  }
}

export function startMonitoring(): void {
  if (timer) return;
  let busy = false;
  timer = setInterval(() => {
    if (busy) return;
    busy = true;
    tick().catch((err) => console.error('[Monitor] Tick failed:', err)).finally(() => { busy = false; });
  }, TICK_MS);
  console.log(`[Monitor] Syncing each connected user every ${SYNC_EVERY_MS / 60000} min, one user per ${TICK_MS / 1000}s`);
}

export function stopMonitoring(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function getSyncStatus(userId: string) {
  const user = await dbGet<{ sync_status: string; gmail_tokens_enc: string | null }>('SELECT sync_status, gmail_tokens_enc FROM users WHERE id = ?', [userId]);
  return {
    isRunning: running.has(userId),
    lastSync: (await getSetting(userId, 'last_gmail_sync')) || null,
    gmailConnected: !!user?.gmail_tokens_enc,
    reconnectNeeded: user?.sync_status === 'reconnect_needed',
    lastError: null as string | null,
    syncEveryMinutes: SYNC_EVERY_MS / 60000,
  };
}
