import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

/** Default ledger location, shared by the CLI and the MCP server. SKOPE_DB_PATH overrides (test/CI). */
export function defaultDbPath(): string {
  return process.env.SKOPE_DB_PATH ?? join(homedir(), '.skope', 'skope.db');
}

export type SkopeDb = ReturnType<typeof drizzle<typeof schema>>;

/** Open (and lazily create the parent dir for) the local ledger. */
export function openDb(path: string = defaultDbPath()): SkopeDb {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  ensureSchema(sqlite);
  return drizzle(sqlite, { schema });
}

/**
 * Create the ledger tables on first open. Lightweight bootstrap (CREATE TABLE IF NOT EXISTS) in lieu
 * of a migration toolchain — the schema is small and append-only at this stage.
 */
function ensureSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profile_axes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      weight REAL NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS profile_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles_seen (
      url_hash TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT,
      source TEXT NOT NULL,
      tier INTEGER NOT NULL,
      content_hash TEXT,
      published_at INTEGER,
      first_seen_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS article_impacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url_hash TEXT NOT NULL REFERENCES articles_seen(url_hash),
      axis_id TEXT NOT NULL,
      score REAL NOT NULL,
      match_seed TEXT
    );
    CREATE TABLE IF NOT EXISTS interactions (
      url_hash TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      timestamp INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanned_at INTEGER DEFAULT (unixepoch() * 1000),
      query_count INTEGER NOT NULL,
      article_count INTEGER NOT NULL
    );
  `);
}
