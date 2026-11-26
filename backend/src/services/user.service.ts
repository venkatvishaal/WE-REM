import { dbGet, dbRun } from '../db/database';
import { generateId } from '../utils/crypto';

const DEFAULT_SETTINGS: Record<string, string> = {
  gmail_sync_enabled: 'true',
  portal_verify_enabled: 'false',
  notify_in_app: 'true',
  notify_desktop: 'true',
  notify_telegram: 'false',
  last_gmail_sync: '',
};

/** Finds or creates the user for a Google account; new users get the default settings. */
export async function upsertUser(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const existing = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [normalized]);
  const id = existing?.id || generateId();
  if (!existing) await dbRun('INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT (email) DO NOTHING', [id, normalized]);
  const user = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [normalized]);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await dbRun('INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [user!.id, key, value]);
  }
  return user!.id;
}

export async function getSetting(userId: string, key: string): Promise<string | undefined> {
  return (await dbGet<{ value: string }>('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, key]))?.value;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
  await dbRun(
    `INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, iso_now())
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [userId, key, value],
  );
}

/** Removes the user and, through ON DELETE CASCADE, every row that belongs to them. */
export async function deleteUser(userId: string): Promise<void> {
  await dbRun('DELETE FROM users WHERE id = ?', [userId]);
}
