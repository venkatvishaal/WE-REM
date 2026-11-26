import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Pool, types } from 'pg';

const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve('.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const SCHEMA_PATH = fs.existsSync(path.resolve(__dirname, 'schema.sql'))
  ? path.resolve(__dirname, 'schema.sql')
  : path.resolve(__dirname, '../../src/db/schema.sql');

// COUNT(*) is bigint and AVG is numeric; pg returns both as strings by default
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

interface Driver {
  query(sql: string, params: any[]): Promise<{ rows: any[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

let _driver: Driver | null = null;

/** Neon (or any Postgres) when DATABASE_URL is set; otherwise an embedded PGlite database on disk. */
export async function initDb(dataDir = process.env.PGLITE_DIR || path.resolve(__dirname, '../../data/pglite')): Promise<void> {
  if (_driver) return;

  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    pool.on('connect', (c) => { c.query(`SET TIME ZONE 'UTC'`).catch(() => {}); });
    _driver = {
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
    console.log('[DB] Connected to Postgres (DATABASE_URL)');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = dataDir === 'memory://' ? new PGlite() : new PGlite(dataDir);
    await db.exec(`SET TIME ZONE 'UTC'`);
    _driver = {
      query: async (sql, params) => {
        const r = await db.query(sql, params);
        // PGlite returns int8 as BigInt; match the pg driver's numbers
        return { rows: r.rows.map((row: any) => { for (const k in row) if (typeof row[k] === 'bigint') row[k] = Number(row[k]); return row; }) };
      },
      exec: (sql) => db.exec(sql),
      close: () => db.close(),
    };
    console.log(`[DB] Embedded PGlite at ${dataDir}`);
  }

  await _driver.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
}

export async function closeDb(): Promise<void> {
  await _driver?.close();
  _driver = null;
}

function driver(): Driver {
  if (!_driver) throw new Error('[DB] Database not initialized. Call initDb() first.');
  return _driver;
}

/** Turns SQLite-style `?` placeholders into Postgres `$1, $2…`, skipping quoted strings. */
export function toPgParams(sql: string): string {
  let n = 0, out = '', quoted = false;
  for (const ch of sql) {
    if (ch === "'") quoted = !quoted;
    out += ch === '?' && !quoted ? `$${++n}` : ch;
  }
  return out;
}

// ── Convenience helpers ──────────────────────────────────────────
export async function dbRun(sql: string, params: any[] = []): Promise<void> {
  await driver().query(toPgParams(sql), params);
}

export async function dbGet<T = Record<string, unknown>>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await driver().query(toPgParams(sql), params)).rows[0] as T | undefined;
}

export async function dbAll<T = Record<string, unknown>>(sql: string, params: any[] = []): Promise<T[]> {
  return (await driver().query(toPgParams(sql), params)).rows as T[];
}
