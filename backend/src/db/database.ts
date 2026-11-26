import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve('.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

function resolveDbPath(): string {
  if (process.env.DB_PATH && fs.existsSync(path.resolve(process.env.DB_PATH))) {
    return path.resolve(process.env.DB_PATH);
  }
  const localDb = path.resolve('./data/tracker.db');
  if (fs.existsSync(localDb)) return localDb;
  const backendDb = path.resolve(__dirname, '../../data/tracker.db');
  if (fs.existsSync(backendDb)) return backendDb;
  return localDb;
}

const DB_PATH = resolveDbPath();
const SCHEMA_PATH = fs.existsSync(path.resolve(__dirname, 'schema.sql'))
  ? path.resolve(__dirname, 'schema.sql')
  : path.resolve(__dirname, '../../src/db/schema.sql');

// Ensure data directory
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let _sql: SqlJsStatic | null = null;
let _db: Database | null = null;

// Flush interval (every 30s) to persist in-memory DB to disk
let _flushInterval: NodeJS.Timeout | null = null;

export async function initDb(): Promise<Database> {
  if (_db) return _db;

  _sql = await initSqlJs();

  // Load existing DB from disk, or create new
  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH);
    _db = new _sql.Database(data);
    console.log(`[DB] Loaded from: ${DB_PATH}`);
  } else {
    _db = new _sql.Database();
    console.log(`[DB] Created new database: ${DB_PATH}`);
  }

  // Run schema (CREATE TABLE IF NOT EXISTS — idempotent)
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  _db.run(schema);

  // Column migrations (sql.js has no ADD COLUMN IF NOT EXISTS; "duplicate column" means already applied)
  for (const col of ['first_response_at TEXT', 'last_response_type TEXT', 'last_response_at TEXT']) {
    try { _db.run(`ALTER TABLE applications ADD COLUMN ${col}`); } catch { /* already exists */ }
  }

  // Persist to disk immediately after schema init
  persistDb();

  // Flush every 30 seconds
  _flushInterval = setInterval(persistDb, 30000);

  return _db;
}

export function persistDb(): void {
  if (!_db) return;
  try {
    const data = _db.export();
    // Write-then-rename so a crash or dev-server restart mid-write can't truncate the DB
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, DB_PATH);
  } catch (err) {
    console.error('[DB] Failed to persist:', err);
  }
}

export function getDb(): Database {
  if (!_db) throw new Error('[DB] Database not initialized. Call initDb() first.');
  return _db;
}

export function closeDb(): void {
  if (_flushInterval) clearInterval(_flushInterval);
  if (_db) {
    persistDb();
    _db.close();
    _db = null;
    console.log('[DB] Closed and flushed to disk');
  }
}

// ── Convenience helpers ──────────────────────────────────────────
export function dbRun(sql: string, params: any[] = []): void {
  getDb().run(sql, params);
  // Persist after writes
  persistDb();
}

export function dbGet<T = Record<string, unknown>>(
  sql: string,
  params: any[] = [],
): T | undefined {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const hasRow = stmt.step();
  if (!hasRow) { stmt.free(); return undefined; }
  const row = stmt.getAsObject() as T;
  stmt.free();
  return row;
}

export function dbAll<T = Record<string, unknown>>(
  sql: string,
  params: any[] = [],
): T[] {
  const results: T[] = [];
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// If run directly
if (require.main === module) {
  initDb().then(() => {
    console.log('[DB] Schema initialized successfully');
    closeDb();
  });
}
