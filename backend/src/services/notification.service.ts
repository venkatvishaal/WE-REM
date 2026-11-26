import * as crypto from 'crypto';
import { dbGet, dbRun } from '../db/database';
import { generateId } from '../utils/crypto';
import { getSetting, setSetting } from './user.service';

export type NotificationType = 'status_change' | 'action_required' | 'interview' | 'offer' | 'rejection' | 'error' | 'sync' | 'sync_quota';

export interface NotificationPayload {
  applicationId?: string;
  type: NotificationType;
  title: string;
  body: string;
  channels?: string[];
}

async function getEnabledChannels(userId: string): Promise<string[]> {
  const channels: string[] = [];
  if ((await getSetting(userId, 'notify_in_app')) !== 'false') channels.push('in_app');
  if ((await getSetting(userId, 'notify_desktop')) !== 'false') channels.push('desktop');
  return channels.length > 0 ? channels : ['in_app'];
}

export async function dispatch(userId: string, payload: NotificationPayload): Promise<void> {
  const channels = payload.channels || (await getEnabledChannels(userId));
  await dbRun(
    `INSERT INTO notifications (id, user_id, application_id, type, title, body, channels, read, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [generateId(), userId, payload.applicationId || null, payload.type, payload.title, payload.body, JSON.stringify(channels), new Date().toISOString()],
  );
}

export async function notifyStatusChange(userId: string, applicationId: string, companyName: string, jobTitle: string, previousStatus: string, newStatus: string): Promise<void> {
  const labels: Record<string, string> = {
    applied: 'Applied', acknowledged: 'Acknowledged', under_review: 'Under Review',
    interview: 'Interview', assessment: 'Assessment', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn',
  };
  const type: NotificationType = newStatus === 'interview' ? 'interview' : newStatus === 'offer' ? 'offer' : newStatus === 'rejected' ? 'rejection' : 'status_change';
  await dispatch(userId, { applicationId, type, title: `${companyName} — ${labels[newStatus] || newStatus}`, body: `Your ${jobTitle} application moved: ${labels[previousStatus] || previousStatus} → ${labels[newStatus] || newStatus}.` });
}

export async function notifyActionRequired(userId: string, applicationId: string, companyName: string, jobTitle: string, action: string): Promise<void> {
  await dispatch(userId, { applicationId, type: 'action_required', title: `Action Required — ${companyName}`, body: `${action} for your ${jobTitle} application.` });
}

export async function notifySyncComplete(userId: string, emailsFetched: number, appsCreated: number, appsUpdated: number): Promise<void> {
  if (emailsFetched === 0) return;
  await dispatch(userId, { type: 'sync', title: 'Gmail Sync Complete', body: `Fetched ${emailsFetched} emails. Created ${appsCreated} new applications, updated ${appsUpdated}.`, channels: ['in_app'] });
}

export async function notifyError(userId: string, message: string, detail?: string): Promise<void> {
  await dispatch(userId, { type: 'error', title: 'Sync Error', body: detail ? `${message}: ${detail}` : message, channels: ['in_app'] });
}

// ── Telegram alerts (one shared bot; each user links their own chat) ──
const TELEGRAM_API = 'https://api.telegram.org/bot';

async function telegramCall(method: string, body?: object): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram alerts are not set up on this server (TELEGRAM_BOT_TOKEN missing)');
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

/** Never throws, so a failed alert can't break a Gmail sync. */
export async function sendTelegram(text: string, chatId: string | null | undefined): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    await telegramCall('sendMessage', { chat_id: chatId, text });
    return true;
  } catch (err: any) {
    console.error('[Notification] Telegram send failed:', err.message);
    return false;
  }
}

async function userChatId(userId: string): Promise<string | null> {
  return (await dbGet<{ telegram_chat_id: string | null }>('SELECT telegram_chat_id FROM users WHERE id = ?', [userId]))?.telegram_chat_id ?? null;
}

/** Returns a t.me deep link carrying a one-time code that ties the user's Telegram chat to their account. */
export async function createTelegramLink(userId: string): Promise<string> {
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!process.env.TELEGRAM_BOT_TOKEN || !bot) throw new Error('Telegram alerts are not set up on this server');
  const code = crypto.randomBytes(16).toString('hex');
  await dbRun('UPDATE users SET telegram_link_code = ? WHERE id = ?', [code, userId]);
  return `https://t.me/${bot}?start=${code}`;
}

/** Handles a Telegram webhook update: "/start <code>" links that chat to the user who made the code. */
export async function handleTelegramUpdate(update: any): Promise<void> {
  const text: string = update?.message?.text || '';
  const chatId = update?.message?.chat?.id;
  const m = text.match(/^\/start\s+([a-f0-9]{32})$/);
  if (!m || !chatId) return;
  const user = await dbGet<{ id: string }>('SELECT id FROM users WHERE telegram_link_code = ?', [m[1]]);
  if (!user) {
    await sendTelegram('This link has expired. Open Settings in Job Tracker and click Connect Telegram again.', String(chatId));
    return;
  }
  await dbRun('UPDATE users SET telegram_chat_id = ?, telegram_link_code = NULL WHERE id = ?', [String(chatId), user.id]);
  await setSetting(user.id, 'notify_telegram', 'true');
  await sendTelegram('Job Tracker alerts are connected. You will get a message for every new job email.', String(chatId));
}

export async function disconnectTelegram(userId: string): Promise<void> {
  await dbRun('UPDATE users SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE id = ?', [userId]);
  await setSetting(userId, 'notify_telegram', 'false');
}

export async function sendTelegramTest(userId: string): Promise<boolean> {
  return sendTelegram('Job Tracker alerts are working', await userChatId(userId));
}

const ALERT_LABELS: Record<string, string> = {
  rejected: 'Rejected', position_filled: 'Position closed', interview: 'Interview',
  assessment: 'Assessment', offer: 'Offer', acknowledged: 'Application received',
  document_request: 'Action needed', status_change: 'Update',
};

export function jobAlertText(company: string, jobTitle: string, eventType: string, subject: string, receivedAt: string): string {
  const label = ALERT_LABELS[eventType] || ALERT_LABELS.status_change;
  const date = new Date(receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const subj = subject.length > 120 ? `${subject.slice(0, 117)}…` : subject;
  return [`[${label.toUpperCase()}] ${company}`, jobTitle !== 'Position Applied' ? jobTitle : '', `"${subj}"`, date]
    .filter(Boolean)
    .join('\n');
}

// shortcut: only emails from the last 48h alert, so full re-syncs / long catch-ups don't flood the phone; raise if syncs ever lag longer
const ALERT_MAX_AGE_MS = 48 * 3600 * 1000;

export function shouldAlert(receivedAt: string, now = Date.now()): boolean {
  return now - Date.parse(receivedAt) <= ALERT_MAX_AGE_MS;
}

export async function notifyJobEmail(userId: string, company: string, jobTitle: string, eventType: string, subject: string, receivedAt: string): Promise<void> {
  if (!shouldAlert(receivedAt)) return;
  if ((await getSetting(userId, 'notify_telegram')) !== 'true') return;
  await sendTelegram(jobAlertText(company, jobTitle, eventType, subject, receivedAt), await userChatId(userId));
}

/** Gmail access expired (Testing mode does this every 7 days): one in-app note and one Telegram nudge per expiry. */
export async function notifyReconnectNeeded(userId: string): Promise<void> {
  const user = await dbGet<{ reconnect_reminded: number; telegram_chat_id: string | null }>(
    'SELECT reconnect_reminded, telegram_chat_id FROM users WHERE id = ?', [userId]);
  if (!user || user.reconnect_reminded) return;
  await dbRun('UPDATE users SET reconnect_reminded = 1 WHERE id = ?', [userId]);
  await dispatch(userId, { type: 'error', title: 'Reconnect Gmail', body: 'Google ended Job Tracker\'s Gmail access (this happens every 7 days during testing). Open Job Tracker and click Reconnect Gmail.', channels: ['in_app'] });
  await sendTelegram('Job Tracker lost Gmail access (Google resets it every 7 days during testing). Open the app and click Reconnect Gmail to keep tracking.', user.telegram_chat_id);
}
