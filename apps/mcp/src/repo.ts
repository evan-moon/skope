import { openDb, type SkopeDb, schema } from '@skope/db';
import type { Article, Profile, ScoredArticle, UserContext } from '@skope/domain';
import { contentKey, daysAgo } from '@skope/utils';
import type { AxisImpactTotals } from '@skope/watch';
import { and, gte, inArray, sql } from 'drizzle-orm';

const {
  profileAxes,
  profileMeta,
  articlesSeen,
  articleImpacts,
  briefAppearances,
  interactions,
  scanLog,
} = schema;

/**
 * The deterministic ledger boundary. Everything that mutates ~/.skope/skope.db lives here; tool
 * handlers compose these with the pure use-case functions. No LLM-generated text is persisted.
 */
export class Repo {
  private db: SkopeDb;

  constructor(db: SkopeDb = openDb()) {
    this.db = db;
  }

  loadProfile(): Profile | undefined {
    const axes = this.db.select().from(profileAxes).all();
    if (axes.length === 0) {
      return undefined;
    }
    const meta = this.db.select().from(profileMeta).all();
    const metaMap = new Map(meta.map((m) => [m.key, m.value]));
    const ctxRaw = metaMap.get('user_context');
    const userContext: UserContext = ctxRaw
      ? (JSON.parse(ctxRaw) as UserContext)
      : { location: '', languages: [] };
    const lastScanRaw = metaMap.get('last_scan');
    return {
      version: 'v2',
      userContext,
      lastScan: lastScanRaw ? Number(lastScanRaw) : undefined,
      axes: axes.map((a) => ({
        id: a.id,
        label: a.label,
        weight: a.weight,
        keywords: JSON.parse(a.keywords) as string[],
        reachAnchors: JSON.parse(a.reachAnchors) as string[],
        source: a.source ?? undefined,
      })),
    };
  }

  saveProfile(profile: Profile): void {
    this.db.delete(profileAxes).run();
    for (const a of profile.axes) {
      this.db
        .insert(profileAxes)
        .values({
          id: a.id,
          label: a.label,
          weight: a.weight,
          keywords: JSON.stringify(a.keywords),
          reachAnchors: JSON.stringify(a.reachAnchors ?? []),
          source: a.source ?? null,
        })
        .run();
    }
    this.setMeta('user_context', JSON.stringify(profile.userContext));
    if (profile.lastScan !== undefined) {
      this.setMeta('last_scan', String(profile.lastScan));
    }
  }

  private setMeta(key: string, value: string): void {
    this.db
      .insert(profileMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: profileMeta.key, set: { value } })
      .run();
  }

  /**
   * Persist every fetched article to the ledger (dedup by url_hash), regardless of reachability.
   * Needed so the brief's "world" layer can surface top global headlines that have no path to the
   * user — they must exist in articles_seen even though they get no article_impacts row.
   */
  recordArticles(articles: Article[]): void {
    for (const a of articles) {
      this.db
        .insert(articlesSeen)
        .values({
          urlHash: a.urlHash,
          url: a.url,
          title: a.title,
          snippet: a.snippet ?? null,
          source: a.source,
          tier: a.tier,
          contentHash: contentKey(a.source, a.title),
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  /** Persist per-axis impact seeds for the reachability-scored (radar) articles. */
  recordScored(scored: ScoredArticle[]): void {
    for (const a of scored) {
      for (const hit of a.impact.hits) {
        const seed = a.impact.seeds.find((s) => s.axisId === hit.axisId);
        this.db
          .insert(articleImpacts)
          .values({
            urlHash: a.urlHash,
            axisId: hit.axisId,
            score: hit.contribution,
            matchSeed: seed
              ? JSON.stringify({
                  entity: seed.entity,
                  matchType: seed.matchType,
                  strength: seed.strength,
                })
              : null,
          })
          .run();
      }
    }
  }

  /**
   * Of the given hashes, which already exist in the ledger. "Once scanned, the world doesn't change":
   * re-ingesting a seen article must be a no-op so impacts never double-count and Effective-N stays
   * honest. Callers skip known hashes before scoring/recording.
   */
  knownHashes(hashes: string[]): Set<string> {
    if (hashes.length === 0) {
      return new Set();
    }
    const rows = this.db
      .select({ h: articlesSeen.urlHash })
      .from(articlesSeen)
      .where(inArray(articlesSeen.urlHash, hashes))
      .all();
    return new Set(rows.map((r) => r.h));
  }

  /**
   * Of the given content keys, which already exist in the ledger within `windowDays`. Secondary
   * dedup: catches the same story arriving under URL-parameter variants. Time-bounded so a recurring
   * generic-but-long title doesn't merge across unrelated days.
   */
  knownContent(keys: (string | null)[], windowDays = 7): Set<string> {
    const real = keys.filter((k): k is string => k !== null && k.length > 0);
    if (real.length === 0) {
      return new Set();
    }
    const since = new Date(daysAgo(windowDays));
    const rows = this.db
      .select({ c: articlesSeen.contentHash })
      .from(articlesSeen)
      .where(and(inArray(articlesSeen.contentHash, real), gte(articlesSeen.firstSeenAt, since)))
      .all();
    return new Set(rows.map((r) => r.c).filter((c): c is string => c !== null));
  }

  /** URL hashes already read or muted — the deterministic exclusion set for future briefs. */
  exclusionSet(): Set<string> {
    const rows = this.db.select({ urlHash: interactions.urlHash }).from(interactions).all();
    return new Set(rows.map((r) => r.urlHash));
  }

  /** Per-axis cumulative impact over the rolling window, for Effective-N. */
  axisTotals(windowDays = 14): AxisImpactTotals[] {
    const since = new Date(daysAgo(windowDays));
    const rows = this.db
      .select({ axisId: articleImpacts.axisId, total: sql<number>`sum(${articleImpacts.score})` })
      .from(articleImpacts)
      .innerJoin(articlesSeen, sql`${articleImpacts.urlHash} = ${articlesSeen.urlHash}`)
      .where(gte(articlesSeen.firstSeenAt, since))
      .groupBy(articleImpacts.axisId)
      .all();
    return rows.map((r) => ({ axisId: r.axisId, total: Number(r.total ?? 0) }));
  }

  /**
   * Stamp `now` as the last-shown time for the given articles. Called by get_brief AFTER it has read
   * the prior stamps, so a brief never penalizes its own current render — only the next one. "Shown",
   * not "read": this never enters the deterministic ledger or Effective-N.
   */
  recordAppearances(urlHashes: string[], when: number = Date.now()): void {
    const shownAt = new Date(when);
    for (const urlHash of urlHashes) {
      this.db
        .insert(briefAppearances)
        .values({ urlHash, shownAt })
        .onConflictDoUpdate({ target: briefAppearances.urlHash, set: { shownAt } })
        .run();
    }
  }

  /** url_hash → epoch-ms last shown in a brief, for the read-time freshness decay. */
  lastShownMap(): Map<string, number> {
    const rows = this.db.select().from(briefAppearances).all();
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.shownAt) {
        map.set(r.urlHash, r.shownAt.getTime());
      }
    }
    return map;
  }

  markRead(urlHashes: string[]): void {
    for (const urlHash of urlHashes) {
      this.db
        .insert(interactions)
        .values({ urlHash, action: 'read' })
        .onConflictDoUpdate({ target: interactions.urlHash, set: { action: 'read' } })
        .run();
    }
  }

  /**
   * Reconstruct recently-seen scored articles from the ledger (articles_seen ⋈ article_impacts),
   * excluding read/muted. Used by get_brief to assemble without re-fetching the web.
   */
  recentScored(windowHours = 24, excluded: ReadonlySet<string> = new Set()): ScoredArticle[] {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const articles = this.db
      .select()
      .from(articlesSeen)
      .where(gte(articlesSeen.firstSeenAt, since))
      .all();
    const impacts = this.db.select().from(articleImpacts).all();
    const byHash = new Map<string, typeof impacts>();
    for (const imp of impacts) {
      const list = byHash.get(imp.urlHash) ?? [];
      list.push(imp);
      byHash.set(imp.urlHash, list);
    }

    const scored: ScoredArticle[] = [];
    for (const a of articles) {
      if (excluded.has(a.urlHash)) {
        continue;
      }
      const rows = byHash.get(a.urlHash) ?? [];
      if (rows.length === 0) {
        continue;
      }
      const hits = rows.map((r) => ({ axisId: r.axisId, contribution: r.score }));
      const seeds = rows
        .filter((r) => r.matchSeed)
        .map((r) => {
          const s = JSON.parse(r.matchSeed as string) as {
            entity: string;
            matchType: 'keyword' | 'reach' | 'situational' | 'entity' | 'geo' | 'sector';
            strength: number;
          };
          return {
            axisId: r.axisId,
            entity: s.entity,
            matchType: s.matchType,
            strength: s.strength,
          };
        });
      scored.push({
        urlHash: a.urlHash,
        url: a.url,
        title: a.title,
        snippet: a.snippet ?? undefined,
        source: a.source,
        tier: a.tier as 0 | 1 | 2 | 3,
        publishedAt: a.publishedAt ? a.publishedAt.getTime() : undefined,
        impact: {
          total: Math.min(
            1,
            hits.reduce((acc, h) => acc + h.contribution, 0),
          ),
          hits,
          seeds,
        },
      });
    }
    return scored.sort((x, y) => y.impact.total - x.impact.total);
  }

  /**
   * Recent Tier-1 global headlines for the brief's "world" layer — the bubble *outside* the user's
   * radar. Excludes anything already in the radar set, so the two layers stay distinct: world is the
   * big stories with no path to the user, shown anyway so the world outside is never hidden.
   */
  recentWorld(windowHours = 24, limit = 5, excluded: ReadonlySet<string> = new Set()): Article[] {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const rows = this.db
      .select()
      .from(articlesSeen)
      .where(and(gte(articlesSeen.firstSeenAt, since), sql`${articlesSeen.tier} = 1`))
      .all()
      .filter((a) => !excluded.has(a.urlHash))
      .slice(0, limit);
    return rows.map((a) => ({
      urlHash: a.urlHash,
      url: a.url,
      title: a.title,
      snippet: a.snippet ?? undefined,
      source: a.source,
      tier: a.tier as 0 | 1 | 2 | 3,
      publishedAt: a.publishedAt ? a.publishedAt.getTime() : undefined,
    }));
  }

  recordScan(queryCount: number, articleCount: number): void {
    this.db.insert(scanLog).values({ queryCount, articleCount }).run();
  }

  updateLastScan(when: number): void {
    this.setMeta('last_scan', String(when));
  }
}
