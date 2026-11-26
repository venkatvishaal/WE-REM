// One-time move of the old single-user SQLite data (data/tracker.db + data/.tokens.enc) into the
// new multi-user database (DATABASE_URL, or local PGlite when unset), under one Google account.
// Run: npx ts-node --transpile-only src/scripts/migrate-to-postgres.ts you@gmail.com
import * as fs from 'fs';
import * as path from 'path';
import initSqlJs from 'sql.js';
import { initDb, dbAll, dbRun, closeDb } from '../db/database';
import { upsertUser, setSetting } from '../services/user.service';
import { storedBody } from '../services/monitor.service';
import { decrypt, encrypt } from '../utils/crypto';

const DATA = path.resolve(__dirname, '../../data');
const OLD_DB = path.join(DATA, 'tracker.db');
const OLD_TOKENS = path.join(DATA, '.tokens.enc');

/** The Gmail address the old saved sign-in belongs to (asks Gmail itself). */
async function emailFromOldTokens(plainTokens: string): Promise<string> {
  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials(JSON.parse(plainTokens));
  const profile = await google.gmail({ version: 'v1', auth }).users.getProfile({ userId: 'me' });
  if (!profile.data.emailAddress) throw new Error('Gmail returned no email address');
  return profile.data.emailAddress;
}

function oldTokensPlain(): string | null {
  if (!fs.existsSync(OLD_TOKENS)) return null;
  const blob = fs.readFileSync(OLD_TOKENS, 'utf-8');
  const keys = [process.env.TOKEN_ENCRYPTION_KEY, process.env.ENCRYPTION_KEY, 'change_this_to_a_random_32char_secret!!', 'default-insecure-key-change-me!!'];
  return keys.filter(Boolean).map((k) => { try { return decrypt(blob, k as string); } catch { return null; } }).find(Boolean) || null;
}

async function main() {
  const plainTokens = oldTokensPlain();
  const email = process.argv[2] || (plainTokens ? await emailFromOldTokens(plainTokens) : '');
  if (!email || !email.includes('@')) throw new Error('Usage: migrate-to-postgres.ts [you@gmail.com] (email is read from the old Gmail sign-in when omitted)');
  if (!fs.existsSync(OLD_DB)) throw new Error(`No old database at ${OLD_DB}`);

  const SQL = await initSqlJs();
  const old = new SQL.Database(fs.readFileSync(OLD_DB));
  const rows = (sql: string): any[] => {
    const res = old.exec(sql)[0];
    return res ? res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]]))) : [];
  };

  await initDb();
  const userId = await upsertUser(email);
  const existing = await dbAll('SELECT 1 FROM applications WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) throw new Error(`${email} already has applications in the new database; not migrating twice`);

  const columnsOf = async (table: string) =>
    new Set((await dbAll<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = ?`, [table])).map((r) => r.column_name));

  /** Copies rows column-by-column (only columns both schemas have), adding user_id where the new table has it. */
  async function copy(table: string, list: any[], extra: (r: any) => Record<string, unknown> = () => ({})) {
    const cols = await columnsOf(table);
    for (const r of list) {
      const row: Record<string, unknown> = { ...r, ...extra(r) };
      if (cols.has('user_id')) row.user_id = userId;
      const keys = Object.keys(row).filter((k) => cols.has(k));
      await dbRun(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON CONFLICT DO NOTHING`,
        keys.map((k) => row[k]),
      );
    }
    console.log(`  ${table}: ${list.length}`);
  }

  console.log(`Migrating ${OLD_DB} -> ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'local PGlite'} as ${email}`);
  await copy('applications', rows('SELECT * FROM applications'));
  await copy('timeline_events', rows('SELECT * FROM timeline_events'));
  await copy('email_messages', rows('SELECT * FROM email_messages'), (r) => ({ body_text: storedBody(r.body_text || '', r.body_html || '') }));
  await copy('notifications', rows('SELECT * FROM notifications'));
  await copy('portal_snapshots', rows('SELECT * FROM portal_snapshots'));
  await copy('portal_hosts', rows('SELECT * FROM portal_hosts'));

  // Per-user settings and sync position
  const settings = Object.fromEntries(rows('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
  for (const key of ['gmail_sync_enabled', 'portal_verify_enabled', 'notify_in_app', 'notify_desktop', 'notify_telegram', 'last_gmail_sync']) {
    if (settings[key] !== undefined) await setSetting(userId, key, String(settings[key]));
  }
  await dbRun('UPDATE users SET gmail_history_id = ?, telegram_chat_id = ? WHERE id = ?',
    [settings.gmail_history_id || null, process.env.TELEGRAM_CHAT_ID || null, userId]);

  // Gmail tokens: re-encrypt with TOKEN_ENCRYPTION_KEY so you don't have to sign in again
  if (plainTokens && process.env.TOKEN_ENCRYPTION_KEY) {
    await dbRun(`UPDATE users SET gmail_tokens_enc = ?, gmail_connected_at = iso_now() WHERE id = ?`, [encrypt(plainTokens, process.env.TOKEN_ENCRYPTION_KEY), userId]);
    console.log('  Gmail tokens: moved');
  } else console.log('  Gmail tokens: not moved, sign in again');

  old.close();
  await closeDb();
  console.log('Done. The old data/tracker.db is left untouched.');
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
