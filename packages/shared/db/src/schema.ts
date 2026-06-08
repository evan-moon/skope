import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The interest profile axes. Single source of truth for the profile (SQLite, not a YAML file —
 * YAML is only an import/export format). Weights are kept normalized to sum to 1.0 on write.
 */
export const profileAxes = sqliteTable('profile_axes', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  weight: real('weight').notNull(),
  /** JSON-encoded string[] of keyword anchors. */
  keywords: text('keywords').notNull().default('[]'),
  /** Optional federation origin, e.g. "mcp://firma/portfolio". Informational only. */
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

/** Singleton-ish key/value for user_context + last_scan. */
export const profileMeta = sqliteTable('profile_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Every discovered article, deduped by url_hash. The atomic unit of the deterministic ledger. */
export const articlesSeen = sqliteTable('articles_seen', {
  urlHash: text('url_hash').primaryKey(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  snippet: text('snippet'),
  source: text('source').notNull(),
  tier: integer('tier').notNull(),
  /** Secondary content dedup key = hash(source + title); null for short/generic titles. */
  contentHash: text('content_hash'),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).default(
    sql`(unixepoch() * 1000)`,
  ),
});

/**
 * N:M article↔axis impact mapping. Source of the 14-day Effective-N distribution and of the
 * stored ReachabilitySeed (match_seed JSON). LLM narrative is never stored here.
 */
export const articleImpacts = sqliteTable('article_impacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  urlHash: text('url_hash')
    .notNull()
    .references(() => articlesSeen.urlHash),
  // No FK to profile_axes: the virtual 'geo' reachability axis is not a user-defined axis.
  axisId: text('axis_id').notNull(),
  score: real('score').notNull(),
  /** JSON-encoded ReachabilitySeed: { entity, matchType, strength }. */
  matchSeed: text('match_seed'),
});

/** Feedback ledger: read/mute. Drives deterministic exclusion from future briefs. */
export const interactions = sqliteTable('interactions', {
  urlHash: text('url_hash').primaryKey(),
  /** 'read' | 'mute'. */
  action: text('action').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

/** Audit log of scans, for incremental windows and cost accounting. */
export const scanLog = sqliteTable('scan_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scannedAt: integer('scanned_at', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  queryCount: integer('query_count').notNull(),
  articleCount: integer('article_count').notNull(),
});
