import { google } from 'googleapis';
import { encrypt, decrypt } from '../utils/crypto';
import { dbGet, dbRun } from '../db/database';

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
}

function encryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 16) throw new Error('Set TOKEN_ENCRYPTION_KEY (at least 16 random characters) in .env');
  return key;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback',
  );
}

// Read-only Gmail plus the user's email address (to know who signed in)
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
];

// ── OAuth Flow ─────────────────────────────────────────────────
export function getAuthUrl(state: string): string {
  return getOAuth2Client().generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent', state });
}

/** Exchanges the OAuth code; returns the verified Google email and the tokens. */
export async function exchangeCode(code: string): Promise<{ email: string; tokens: GmailTokens }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error('Google did not return an ID token');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GMAIL_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) throw new Error('Google account email is not verified');
  if (!String(tokens.scope || '').includes('gmail.readonly')) throw new Error('Gmail read access was not granted. Sign in again and tick the Gmail box.');
  return { email: payload.email, tokens: tokens as GmailTokens };
}

// ── Token persistence (per user, encrypted in the users table) ──
export async function saveTokens(userId: string, tokens: GmailTokens): Promise<void> {
  await dbRun(
    `UPDATE users SET gmail_tokens_enc = ?, gmail_connected_at = iso_now(), sync_status = 'idle', reconnect_reminded = 0 WHERE id = ?`,
    [encrypt(JSON.stringify(tokens), encryptionKey()), userId],
  );
}

export async function loadTokens(userId: string): Promise<GmailTokens | null> {
  const row = await dbGet<{ gmail_tokens_enc: string | null }>('SELECT gmail_tokens_enc FROM users WHERE id = ?', [userId]);
  if (!row?.gmail_tokens_enc) return null;
  try {
    return JSON.parse(decrypt(row.gmail_tokens_enc, encryptionKey())) as GmailTokens;
  } catch {
    console.error('[Gmail] Failed to decrypt tokens for a user (TOKEN_ENCRYPTION_KEY changed?)');
    return null;
  }
}

/** Revokes Google access (best effort) and forgets the tokens and sync position. */
export async function disconnectGmail(userId: string): Promise<void> {
  const tokens = await loadTokens(userId);
  const token = tokens?.refresh_token || tokens?.access_token;
  if (token) await getOAuth2Client().revokeToken(token).catch((err) => console.warn('[Gmail] Token revoke failed:', err?.message));
  await dbRun(`UPDATE users SET gmail_tokens_enc = NULL, gmail_history_id = NULL, sync_status = 'idle' WHERE id = ?`, [userId]);
}

// ── Authenticated Gmail Client ─────────────────────────────────
export async function getAuthenticatedClient(userId: string) {
  const tokens = await loadTokens(userId);
  if (!tokens) throw new Error('Not authenticated — no tokens found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens as any);
  // Google only returns a new access token on refresh; keep the refresh token
  oauth2Client.on('tokens', (newTokens) => {
    saveTokens(userId, { ...tokens, ...newTokens } as GmailTokens).catch((err) => console.error('[Gmail] Token save failed:', err));
  });
  return oauth2Client;
}

// ── Message Fetching ───────────────────────────────────────────
export interface RawGmailMessage {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  receivedAt: string;
  bodyText: string;
  bodyHtml: string;
  labelIds: string[];
}

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractParts(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';

  function walk(part: any): void {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { text, html };
}

function getHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

// ── Comprehensive Universal Query for ALL Job Applications ─────
export const ALL_APPLICATIONS_GMAIL_QUERY = [
  '"thank you for applying"',
  '"thanks for applying"',
  '"thank you for your application"',
  '"thanks for your application"',
  '"thank you for your interest in"',
  '"application received"',
  '"application submitted"',
  '"application confirmation"',
  '"we received your application"',
  '"we have received your application"',
  '"your application to"',
  '"your application for"',
  '"applied for the position"',
  '"applied to"',
  '"interview invitation"',
  '"invitation to interview"',
  '"coding assessment"',
  '"online assessment"',
  '"assessment invitation"',
  '"regret to inform"',
  '"not to move forward"',
  '"not moving forward"',
  '"move forward with other candidates"',
  '"did not select you"',
  '"your candidacy"',
  '"regarding your application"',
  '"update on your application"',
  '"application status"',
  '"your application with"',
  'subject:interview',
  '"shortlisted"',
  '"your interview"',
  '"ai interview"',
  '"thanks for taking"',
  'from:greenhouse.io',
  'from:greenhouse-mail.io',
  'from:lever.co',
  'from:hire.lever.co',
  'from:smartrecruiters.com',
  'from:ashbyhq.com',
  'from:workday.com',
  'from:myworkdayjobs.com',
  'from:myworkday.com',
  'from:icims.com',
  'from:jobvite.com',
  'from:bamboohr.com',
  'from:workablemail.com',
  'from:taleo.net',
  'from:brassring.com',
  'from:ripplematch.com',
  'from:joinhandshake.com',
  'from:jobs-noreply@linkedin.com',
].join(' OR ');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getMessageWithRetry(gmail: any, id: string, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      return res.data;
    } catch (err: any) {
      const isQuota =
        err?.status === 429 ||
        err?.message?.includes('Quota exceeded') ||
        err?.message?.includes('rateLimitExceeded') ||
        err?.message?.includes('User Rate Limit Exceeded');

      if (isQuota && attempt < retries) {
        const waitMs = (attempt + 1) * 2000;
        console.warn(`[Gmail] Rate limit hit for message ${id}. Waiting ${waitMs}ms before retry...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

export async function fetchNewMessages(
  userId: string,
  sinceHistoryId?: string,
  maxResults = 500,
  forceFullSearch = false,
  skipIds?: Set<string>,
): Promise<RawGmailMessage[]> {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  let messageIds: string[] = [];

  if (sinceHistoryId && !forceFullSearch) {
    // Use history API for incremental sync
    try {
      const histRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: sinceHistoryId,
        historyTypes: ['messageAdded'],
        maxResults: 300,
      });

      const history = histRes.data.history || [];
      for (const h of history) {
        for (const ma of h.messagesAdded || []) {
          if (ma.message?.id) messageIds.push(ma.message.id);
        }
      }
    } catch {
      console.warn('[Gmail] History ID expired, falling back to full search');
      sinceHistoryId = undefined;
    }
  }

  if (!sinceHistoryId || forceFullSearch) {
    // Search across all job applications in the last 365 days
    const after = Math.floor(Date.now() / 1000) - 365 * 24 * 3600;
    const query = `(${ALL_APPLICATIONS_GMAIL_QUERY}) after:${after}`;

    let pageToken: string | undefined = undefined;
    do {
      const remaining = maxResults - messageIds.length;
      if (remaining <= 0) break;

      const listRes: any = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(100, remaining),
        pageToken,
      });

      const ids: string[] = (listRes.data.messages || []).map((m: any) => m.id!).filter(Boolean);
      messageIds.push(...ids);
      pageToken = listRes.data.nextPageToken || undefined;
    } while (pageToken && messageIds.length < maxResults);

    // Deduplicate message IDs
    messageIds = [...new Set(messageIds)];
  }

  // Filter out messages that are already saved in the local database
  const idsToFetch = skipIds ? messageIds.filter((id) => !skipIds.has(id)) : messageIds;
  console.log(`[Gmail] Found ${messageIds.length} candidate emails (${messageIds.length - idsToFetch.length} already stored, ${idsToFetch.length} new to fetch)`);

  // Fetch full details with gentle batching and rate limiting
  const messages: RawGmailMessage[] = [];
  const batchSize = 5;

  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    let fetched: PromiseSettledResult<any>[] = [];

    try {
      fetched = await Promise.allSettled(
        batch.map((id) => getMessageWithRetry(gmail, id)),
      );
    } catch (batchErr: any) {
      console.warn('[Gmail] Batch error:', batchErr.message);
      break;
    }

    let hitQuota = false;

    for (const result of fetched) {
      if (result.status !== 'fulfilled') {
        const reason = (result as any).reason;
        if (
          reason?.status === 429 ||
          reason?.message?.includes('Quota exceeded') ||
          reason?.message?.includes('rateLimitExceeded')
        ) {
          hitQuota = true;
        }
        continue;
      }
      const msg = result.value;
      if (!msg?.payload) continue;

      const headers = msg.payload.headers || [];
      const { text, html } = extractParts(msg.payload);

      messages.push({
        id: msg.id!,
        threadId: msg.threadId!,
        subject: getHeader(headers, 'subject'),
        sender: getHeader(headers, 'from'),
        receivedAt: new Date(Number(msg.internalDate)).toISOString(),
        bodyText: text,
        bodyHtml: html,
        labelIds: msg.labelIds || [],
      });
    }

    if (hitQuota) {
      console.warn('[Gmail] Hit per-minute quota limit. Pausing fetch and saving parsed messages.');
      break;
    }

    // Gentle 250ms pause between batches to respect rate limits
    if (i + batchSize < idsToFetch.length) {
      await sleep(250);
    }
  }

  // Get latest historyId for next sync
  let newHistoryId = '';
  try {
    const profileRes = await gmail.users.getProfile({ userId: 'me' });
    newHistoryId = profileRes.data.historyId || '';
  } catch (err) {
    console.warn('[Gmail] Failed to fetch latest historyId:', err);
  }

  return messages.map((m) => ({ ...m, _historyId: newHistoryId } as any));
}
