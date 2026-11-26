// Self-check: one signed-in user can never read, change or delete another user's data.
// Run: npx ts-node --transpile-only src/services/tenancy.selfcheck.ts
import * as assert from 'assert';
import type { AddressInfo } from 'net';

process.env.DATABASE_URL = ''; // never touch a real database (an empty value also stops dotenv filling it)
process.env.NO_SERVER = '1';
process.env.SESSION_SECRET = 'selfcheck-session-secret-0123456789abcdef';
process.env.TELEGRAM_WEBHOOK_SECRET = 'selfcheck-webhook-secret';
process.env.TELEGRAM_BOT_TOKEN = ''; // dotenv won't override a set variable, so no real Telegram calls
process.env.TOKEN_ENCRYPTION_KEY = 'selfcheck-token-key-0123456789';

/* eslint-disable @typescript-eslint/no-var-requires */
const jwt = require('jsonwebtoken');
const { initDb, dbAll, dbRun, closeDb } = require('../db/database');
const { upsertUser } = require('./user.service');
const app = require('../index').default;

(async () => {
  await initDb('memory://');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const A = await upsertUser('alice@example.com');
  const B = await upsertUser('bob@example.com');
  assert.notStrictEqual(A, B);
  assert.strictEqual(await upsertUser('Alice@Example.com'), A, 'same Google account = same user');

  const cookie = (id: string) => `session=${jwt.sign({ sub: id }, process.env.SESSION_SECRET, { expiresIn: '1h' })}`;
  const call = async (as: string | null, method: string, path: string, body?: object) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(as ? { cookie: cookie(as) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) as any };
  };

  // Not signed in / forged session / bad webhook secret
  assert.strictEqual((await call(null, 'GET', '/api/applications')).status, 401);
  const forged = await fetch(`${base}/api/applications`, { headers: { cookie: `session=${jwt.sign({ sub: A }, 'wrong-secret')}` } });
  assert.strictEqual(forged.status, 401, 'session signed with another key is rejected');
  assert.strictEqual((await fetch(`${base}/api/telegram/webhook`, { method: 'POST' })).status, 403);
  assert.strictEqual((await call(null, 'GET', '/api/health')).status, 200);

  // Each user adds an application
  const aApp = (await call(A, 'POST', '/api/applications', { company_name: 'AliceCo', job_title: 'Engineer' })).json;
  const bApp = (await call(B, 'POST', '/api/applications', { company_name: 'BobCo', job_title: 'Analyst' })).json;
  assert.ok(aApp.id && bApp.id);
  await dbRun(`INSERT INTO notifications (id, user_id, type, title, body) VALUES ('nb', ?, 'sync', 'Bob note', 'x')`, [B]);
  await dbRun(`INSERT INTO email_messages (id, user_id, gmail_message_id, subject, sender, received_at) VALUES ('eb', ?, 'g1', 's', 'f', '2026-01-01T00:00:00Z')`, [B]);

  // A sees only A's data
  const list = (await call(A, 'GET', '/api/applications')).json;
  assert.deepStrictEqual(list.data.map((x: any) => x.company_name), ['AliceCo']);
  assert.strictEqual((await call(A, 'GET', `/api/applications?search=Bob`)).json.data.length, 0);
  assert.strictEqual((await call(A, 'GET', `/api/applications/${bApp.id}`)).status, 404);
  assert.deepStrictEqual((await call(A, 'GET', `/api/applications/${bApp.id}/timeline`)).json, []);
  assert.strictEqual((await call(A, 'PATCH', `/api/applications/${bApp.id}`, { status: 'rejected' })).status, 404);
  assert.strictEqual((await call(A, 'POST', `/api/applications/${bApp.id}/notes`, { content: 'hi' })).status, 404);
  assert.strictEqual((await call(A, 'DELETE', `/api/applications/${bApp.id}`)).status, 404);
  assert.strictEqual((await call(A, 'GET', '/api/stats')).json.total, 1);
  assert.ok((await call(A, 'GET', '/api/stats/companies')).json.every((c: any) => c.company === 'AliceCo'));
  assert.ok((await call(A, 'GET', '/api/stats/activity')).json.every((e: any) => e.company_name === 'AliceCo'));
  assert.strictEqual((await call(A, 'GET', '/api/notifications')).json.data.length, 0);
  await call(A, 'PATCH', '/api/notifications/nb/read');
  await call(A, 'DELETE', '/api/notifications/nb');
  assert.strictEqual((await dbAll(`SELECT read FROM notifications WHERE id = 'nb'`))[0]?.read, 0, "A can't touch B's notification");
  await call(A, 'PATCH', '/api/settings', { notify_telegram: 'true', not_allowed: 'x' });
  assert.strictEqual((await call(B, 'GET', '/api/settings')).json.notify_telegram, 'false', "A's settings don't leak to B");

  // B's application is untouched
  const bNow = (await call(B, 'GET', `/api/applications/${bApp.id}`)).json;
  assert.strictEqual(bNow.status, 'applied');
  assert.strictEqual(bNow.days_since_applied, 0);

  // Sync scheduler: only connected, due users; reconnect_needed users are skipped
  const { nextUserToSync, storedBody } = require('./monitor.service');
  assert.strictEqual(await nextUserToSync(), undefined, 'no one has Gmail connected yet');
  await dbRun(`UPDATE users SET gmail_tokens_enc = 'x' WHERE id IN (?, ?)`, [A, B]);
  await dbRun(`UPDATE users SET last_synced_at = ? WHERE id = ?`, [new Date().toISOString(), A]);
  assert.strictEqual(await nextUserToSync(), B, 'B never synced, A just did');
  await dbRun(`UPDATE users SET sync_status = 'reconnect_needed' WHERE id = ?`, [B]);
  assert.strictEqual(await nextUserToSync(), undefined, 'expired Gmail access is not retried');
  assert.strictEqual(await nextUserToSync(Date.now() + 16 * 60000), A, 'A is due again after 15 min');
  assert.ok(storedBody('x'.repeat(9000), '').length === 4000, 'stored email text is capped at 4 KB');
  assert.ok(storedBody('Thanks', '<a href="https://acme.wd1.myworkdayjobs.com/en-US/Ext/userHome">').endsWith('https://acme.wd1.myworkdayjobs.com/Ext/userHome'), 'portal link kept from HTML');

  // Telegram linking: a one-time code ties a chat to exactly one user
  const { handleTelegramUpdate } = require('./notification.service');
  await dbRun(`UPDATE users SET telegram_link_code = ? WHERE id = ?`, ['a'.repeat(32), B]);
  await handleTelegramUpdate({ message: { text: `/start ${'b'.repeat(32)}`, chat: { id: 111 } } });
  await handleTelegramUpdate({ message: { text: `/start ${'a'.repeat(32)}`, chat: { id: 222 } } });
  const tg = (await dbAll(`SELECT telegram_chat_id, telegram_link_code FROM users WHERE id = ?`, [B]))[0];
  assert.deepStrictEqual(tg, { telegram_chat_id: '222', telegram_link_code: null }, 'code links once, then is cleared');
  assert.strictEqual((await call(B, 'GET', '/api/settings')).json.notify_telegram, 'true');

  // Delete A's account -> every row of A gone, B intact, A's session dead
  assert.strictEqual((await call(A, 'DELETE', '/api/account')).status, 200);
  for (const table of ['applications', 'email_messages', 'notifications', 'settings', 'sync_log']) {
    assert.strictEqual((await dbAll(`SELECT 1 FROM ${table} WHERE user_id = ?`, [A])).length, 0, `${table} cleared for A`);
  }
  assert.strictEqual((await dbAll(`SELECT 1 FROM timeline_events WHERE application_id = ?`, [aApp.id])).length, 0);
  assert.strictEqual((await call(A, 'GET', '/api/applications')).status, 401, 'deleted user is signed out');
  assert.strictEqual((await call(B, 'GET', '/api/applications')).json.data.length, 1);
  assert.strictEqual((await dbAll(`SELECT 1 FROM email_messages WHERE user_id = ?`, [B])).length, 1);

  server.close();
  await closeDb();
  console.log('tenancy self-check: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
