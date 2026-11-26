import { dbGet, dbRun, dbAll } from '../db/database';
import { generateId } from '../utils/crypto';
import { sendEmail } from './gmail.service';

export type NotificationType = 'status_change' | 'action_required' | 'interview' | 'offer' | 'rejection' | 'error' | 'sync';

export interface NotificationPayload {
  applicationId?: string;
  type: NotificationType;
  title: string;
  body: string;
  channels?: string[];
}

function getEnabledChannels(): string[] {
  const channels: string[] = [];
  const getSetting = (key: string) => (dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]))?.value;
  if (getSetting('notify_in_app') !== 'false') channels.push('in_app');
  if (getSetting('notify_email') === 'true') channels.push('email');
  if (getSetting('notify_desktop') !== 'false') channels.push('desktop');
  return channels.length > 0 ? channels : ['in_app'];
}

export async function dispatch(payload: NotificationPayload): Promise<void> {
  const channels = payload.channels || getEnabledChannels();
  const now = new Date().toISOString();

  dbRun(
    `INSERT INTO notifications (id, application_id, type, title, body, channels, read, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [generateId(), payload.applicationId || null, payload.type, payload.title, payload.body, JSON.stringify(channels), now],
  );

  if (channels.includes('email')) {
    const emailTo = dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['notification_email_to'])?.value;
    if (emailTo) {
      try { await sendEmail(emailTo, `[Workday Tracker] ${payload.title}`, buildEmailHtml(payload)); }
      catch (err) { console.error('[Notification] Email send failed:', err); }
    }
  }
}

function buildEmailHtml(payload: NotificationPayload): string {
  const typeColors: Record<string, string> = {
    status_change: '#6366f1', interview: '#22c55e', offer: '#f59e0b',
    rejection: '#ef4444', action_required: '#f97316', error: '#94a3b8', sync: '#6366f1',
  };
  const color = typeColors[payload.type] || '#6366f1';
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f0f17;color:#e2e8f0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #2d2d44;">
    <div style="background:${color};padding:16px 24px;"><h1 style="margin:0;font-size:18px;color:white;">Workday Tracker</h1></div>
    <div style="padding:24px;"><h2 style="margin:0 0 12px;font-size:20px;color:#f1f5f9;">${payload.title}</h2>
    <p style="margin:0;color:#94a3b8;line-height:1.6;">${payload.body}</p></div>
  </div></body></html>`;
}

export async function notifyStatusChange(applicationId: string, companyName: string, jobTitle: string, previousStatus: string, newStatus: string): Promise<void> {
  const labels: Record<string, string> = {
    applied: 'Applied', acknowledged: 'Acknowledged', under_review: 'Under Review',
    interview: 'Interview', assessment: 'Assessment', offer: 'Offer 🎉', rejected: 'Rejected', withdrawn: 'Withdrawn',
  };
  const type: NotificationType = newStatus === 'interview' ? 'interview' : newStatus === 'offer' ? 'offer' : newStatus === 'rejected' ? 'rejection' : 'status_change';
  await dispatch({ applicationId, type, title: `${companyName} — ${labels[newStatus] || newStatus}`, body: `Your ${jobTitle} application moved: ${labels[previousStatus] || previousStatus} → ${labels[newStatus] || newStatus}.` });
}

export async function notifyActionRequired(applicationId: string, companyName: string, jobTitle: string, action: string): Promise<void> {
  await dispatch({ applicationId, type: 'action_required', title: `Action Required — ${companyName}`, body: `${action} for your ${jobTitle} application.` });
}

export async function notifySyncComplete(emailsFetched: number, appsCreated: number, appsUpdated: number): Promise<void> {
  if (emailsFetched === 0) return;
  await dispatch({ type: 'sync', title: 'Gmail Sync Complete', body: `Fetched ${emailsFetched} emails. Created ${appsCreated} new applications, updated ${appsUpdated}.`, channels: ['in_app'] });
}

export async function notifyError(message: string, detail?: string): Promise<void> {
  await dispatch({ type: 'error', title: 'Sync Error', body: detail ? `${message}: ${detail}` : message, channels: ['in_app'] });
}

// ── Telegram alerts ────────────────────────────────────────────
const TELEGRAM_API = 'https://api.telegram.org/bot';

async function telegramCall(method: string, body?: object): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Add TELEGRAM_BOT_TOKEN to backend/.env and restart the backend');
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description || res.status}`); // never includes the token
  return json.result;
}

/** Sends to TELEGRAM_CHAT_ID (or `chatId`). Never throws, so a failed alert can't break a Gmail sync. */
export async function sendTelegram(text: string, chatId = process.env.TELEGRAM_CHAT_ID): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    await telegramCall('sendMessage', { chat_id: chatId, text });
    return true;
  } catch (err: any) {
    console.error('[Notification] Telegram send failed:', err.message);
    return false;
  }
}

/** Setup helper: chat ID of the latest message the user sent to the bot. */
export async function findTelegramChatId(): Promise<string | undefined> {
  const updates: any[] = await telegramCall('getUpdates');
  const last = [...updates].reverse().find((u) => u.message?.chat?.id);
  return last ? String(last.message.chat.id) : undefined;
}

const ALERT_LABELS: Record<string, [string, string]> = {
  rejected: ['❌', 'Rejected'], position_filled: ['❌', 'Position closed'], interview: ['🎤', 'Interview'],
  assessment: ['📝', 'Assessment'], offer: ['🎉', 'Offer'], acknowledged: ['✅', 'Application received'],
  document_request: ['📎', 'Action needed'], status_change: ['🔄', 'Update'],
};

export function jobAlertText(company: string, jobTitle: string, eventType: string, subject: string, receivedAt: string): string {
  const [emoji, label] = ALERT_LABELS[eventType] || ALERT_LABELS.status_change;
  const date = new Date(receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const subj = subject.length > 120 ? `${subject.slice(0, 117)}…` : subject;
  return [`${emoji} ${company} — ${label}`, jobTitle !== 'Position Applied' ? jobTitle : '', `"${subj}"`, date]
    .filter(Boolean)
    .join('\n');
}

// shortcut: only emails from the last 48h alert, so full re-syncs / long catch-ups don't flood the phone; raise if syncs ever lag longer
const ALERT_MAX_AGE_MS = 48 * 3600 * 1000;

export function shouldAlert(receivedAt: string, now = Date.now()): boolean {
  return now - Date.parse(receivedAt) <= ALERT_MAX_AGE_MS;
}

export async function notifyJobEmail(company: string, jobTitle: string, eventType: string, subject: string, receivedAt: string): Promise<void> {
  if (!shouldAlert(receivedAt)) return;
  if (dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['notify_telegram'])?.value !== 'true') return;
  await sendTelegram(jobAlertText(company, jobTitle, eventType, subject, receivedAt));
}

export function getUnreadCount(): number {
  return (dbGet<{ count: number }>('SELECT COUNT(*) as count FROM notifications WHERE read = 0'))?.count ?? 0;
}

export function markAllRead(): void {
  dbRun('UPDATE notifications SET read = 1', []);
}
