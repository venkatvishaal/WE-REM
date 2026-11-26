import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { encrypt, decrypt } from '../utils/crypto';

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
}

function resolveTokenFile(): string {
  if (process.env.TOKEN_FILE && fs.existsSync(path.resolve(process.env.TOKEN_FILE))) {
    return path.resolve(process.env.TOKEN_FILE);
  }
  const localData = path.resolve('./data/.tokens.enc');
  if (fs.existsSync(localData)) return localData;
  const backendData = path.resolve(__dirname, '../../data/.tokens.enc');
  if (fs.existsSync(backendData)) return backendData;
  return localData;
}

function getEncryptionKeys(): string[] {
  const keys: string[] = [];
  if (process.env.TOKEN_ENCRYPTION_KEY) keys.push(process.env.TOKEN_ENCRYPTION_KEY);
  if (process.env.ENCRYPTION_KEY) keys.push(process.env.ENCRYPTION_KEY);
  keys.push('change_this_to_a_random_32char_secret!!');
  keys.push('default-insecure-key-change-me!!');
  return [...new Set(keys)];
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/gmail/callback',
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

// ── OAuth Flow ─────────────────────────────────────────────────
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCode(code: string): Promise<GmailTokens> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  saveTokens(tokens as GmailTokens);
  return tokens as GmailTokens;
}

// ── Token Persistence ──────────────────────────────────────────
function saveTokens(tokens: GmailTokens): void {
  const tokenFile = resolveTokenFile();
  const dir = path.dirname(tokenFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const primaryKey = getEncryptionKeys()[0];
  const encrypted = encrypt(JSON.stringify(tokens), primaryKey);
  fs.writeFileSync(tokenFile, encrypted, 'utf-8');
  console.log('[Gmail] Tokens saved (encrypted)');
}

export function loadTokens(): GmailTokens | null {
  const tokenFile = resolveTokenFile();
  if (!fs.existsSync(tokenFile)) return null;

  try {
    const encrypted = fs.readFileSync(tokenFile, 'utf-8');
    const keys = getEncryptionKeys();

    for (const key of keys) {
      try {
        const decrypted = decrypt(encrypted, key);
        return JSON.parse(decrypted) as GmailTokens;
      } catch {
        // try next key
      }
    }
    console.error('[Gmail] Failed to decrypt tokens with available keys');
    return null;
  } catch (err) {
    console.error('[Gmail] Failed to load tokens:', err);
    return null;
  }
}

export function clearTokens(): void {
  const tokenFile = resolveTokenFile();
  if (fs.existsSync(tokenFile)) {
    try { fs.unlinkSync(tokenFile); } catch {}
    console.log('[Gmail] Tokens cleared');
  }
  const local = path.resolve('./data/.tokens.enc');
  if (fs.existsSync(local)) try { fs.unlinkSync(local); } catch {}
  const backend = path.resolve(__dirname, '../../data/.tokens.enc');
  if (fs.existsSync(backend)) try { fs.unlinkSync(backend); } catch {}
}

export function isAuthenticated(): boolean {
  return loadTokens() !== null;
}

// ── Authenticated Gmail Client ─────────────────────────────────
export function getAuthenticatedClient() {
  const tokens = loadTokens();
  if (!tokens) throw new Error('Not authenticated — no tokens found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens as any);

  // Auto-refresh & persist new tokens
  oauth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    saveTokens(merged as GmailTokens);
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
  sinceHistoryId?: string,
  maxResults = 500,
  forceFullSearch = false,
  skipIds?: Set<string>,
): Promise<RawGmailMessage[]> {
  const auth = getAuthenticatedClient();
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

export async function getLatestHistoryId(): Promise<string> {
  const auth = getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.getProfile({ userId: 'me' });
  return res.data.historyId || '';
}

export async function sendEmail(to: string, subject: string, bodyHtml: string): Promise<void> {
  const auth = getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const profileRes = await gmail.users.getProfile({ userId: 'me' });
  const from = profileRes.data.emailAddress || '';

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    bodyHtml,
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
}
