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
  migrateSchema(sqlite);
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
      reach_anchors TEXT NOT NULL DEFAULT '[]',
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
    CREATE TABLE IF NOT EXISTS brief_appearances (
      url_hash TEXT PRIMARY KEY,
      shown_at INTEGER DEFAULT (unixepoch() * 1000)
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

/**
 * Reconcile an existing ledger with the current schema. ensureSchema only runs CREATE TABLE IF NOT
 * EXISTS, so a db created by an older skope is frozen at its original shape — these idempotent steps
 * fix the drift CREATE TABLE can't: an added column and a dropped foreign key. Safe to run on every
 * open (each guard is a no-op once applied), in lieu of a full migration toolchain.
 */
function migrateSchema(sqlite: Database.Database): void {
  // articles_seen.content_hash backs the secondary (source+title) dedup key. Older ledgers lack it.
  const cols = sqlite.prepare('PRAGMA table_info(articles_seen)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'content_hash')) {
    sqlite.exec('ALTER TABLE articles_seen ADD COLUMN content_hash TEXT');
  }

  // profile_axes.reach_anchors holds the causal-upstream anchors. Older ledgers predate the column;
  // the NOT NULL DEFAULT '[]' makes existing rows round-trip as "direct keywords only".
  const axisCols = sqlite.prepare('PRAGMA table_info(profile_axes)').all() as { name: string }[];
  if (!axisCols.some((c) => c.name === 'reach_anchors')) {
    sqlite.exec("ALTER TABLE profile_axes ADD COLUMN reach_anchors TEXT NOT NULL DEFAULT '[]'");
  }

  // article_impacts.axis_id once carried a FK to profile_axes(id). Scoring now emits a virtual 'geo'
  // axis with no profile row, so the stale FK rejects every geo impact ("FOREIGN KEY constraint
  // failed"). Rebuild the table without the constraint, preserving rows.
  const fks = sqlite.prepare('PRAGMA foreign_key_list(article_impacts)').all() as {
    table: string;
  }[];
  if (fks.some((fk) => fk.table === 'profile_axes')) {
    const fkPrev = sqlite.pragma('foreign_keys', { simple: true });
    sqlite.pragma('foreign_keys = OFF'); // a no-op inside a txn, so toggle before BEGIN
    sqlite.exec(`
      BEGIN;
      CREATE TABLE article_impacts__migrate (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_hash TEXT NOT NULL REFERENCES articles_seen(url_hash),
        axis_id TEXT NOT NULL,
        score REAL NOT NULL,
        match_seed TEXT
      );
      INSERT INTO article_impacts__migrate (id, url_hash, axis_id, score, match_seed)
        SELECT id, url_hash, axis_id, score, match_seed FROM article_impacts;
      DROP TABLE article_impacts;
      ALTER TABLE article_impacts__migrate RENAME TO article_impacts;
      COMMIT;
    `);
    sqlite.pragma(`foreign_keys = ${fkPrev ? 'ON' : 'OFF'}`);
  }
}
