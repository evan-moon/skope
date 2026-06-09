#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildSituationalContext, createSearchProvider, normalizeArticles } from '@skope/adapters';
import { assembleBrief, dropStaleSituational } from '@skope/brief';
import { scoreBatch } from '@skope/discovery';
import type { Article, Axis, Profile, RawArticle, SearchQuery } from '@skope/domain';
import { normalizeAxes, profileGaps } from '@skope/profile';
import { contentKey, urlHash } from '@skope/utils';
import { z } from 'zod';
import { getTavilyKey, SERVER_INSTRUCTIONS, SKOPE_VERSION } from './config.ts';
import { Repo } from './repo.ts';

const repo = new Repo();
const server = new McpServer(
  { name: 'skope', version: SKOPE_VERSION },
  { instructions: SERVER_INSTRUCTIONS },
);

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});
const err = (message: string) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  isError: true,
});

const axisSchema = z.object({
  id: z.string(),
  label: z.string(),
  weight: z.number(),
  keywords: z.array(z.string()).default([]).describe('Direct anchors — what this axis is about.'),
  reachAnchors: z
    .array(z.string())
    .default([])
    .describe(
      'Causal-upstream anchors that reach this axis without naming it (e.g. for a TSLA axis: ' +
        '"Fed rate", "USD/KRW", "BYD", "lithium"). Broadens the lens; scored below direct keywords.',
    ),
  source: z.string().optional(),
});

/** Reject hallucinated/empty entries; LLM-supplied URLs must be real http(s) links. */
const ingestArticleSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  snippet: z.string().optional(),
  source: z.string().min(1).describe('Publisher domain or name, e.g. "reuters.com".'),
  // Lenient: structure strict, content forgiving. A malformed date must not reject the whole batch —
  // the handler best-effort parses and drops it if unparseable, keeping the article.
  published_at: z
    .string()
    .optional()
    .describe('A date string, ISO-8601 preferred. Best-effort parsed.'),
});

/**
 * The shared deterministic pipeline both collection paths funnel into: rule-score reachability,
 * drop already-seen, persist to the ledger, advance last_scan. Identical regardless of whether the
 * articles came from the LLM (ingest_news) or Tavily (scan_news).
 */
function ingest(
  profile: Profile,
  articles: Article[],
  queryCount: number,
  currentLocation?: string,
) {
  // Skip articles already in the ledger — re-ingest is idempotent, so impacts never double-count
  // and the Effective-N watcher stays honest. Two-key dedup: url hash, plus a content key
  // (source+title) that catches the same story re-arriving under URL-parameter variants.
  const known = repo.knownHashes(articles.map((a) => a.urlHash));
  const knownC = repo.knownContent(articles.map((a) => contentKey(a.source, a.title)));
  const seenC = new Set<string>();
  const fresh = articles.filter((a) => {
    if (known.has(a.urlHash)) {
      return false;
    }
    const ck = contentKey(a.source, a.title);
    if (ck && (knownC.has(ck) || seenC.has(ck))) {
      return false;
    }
    if (ck) {
      seenC.add(ck);
    }
    return true;
  });
  repo.recordArticles(fresh);
  const scored = scoreBatch(
    fresh,
    profile.axes,
    repo.exclusionSet(),
    profile.userContext.location,
    buildSituationalContext(profile.userContext, currentLocation),
  );
  repo.recordScored(scored);
  const now = Date.now();
  repo.recordScan(queryCount, fresh.length);
  repo.updateLastScan(now);
  return {
    received: articles.length,
    new: fresh.length,
    entered_radar: scored.length,
    top: scored
      .slice(0, 5)
      .map((a) => ({ title: a.title, source: a.source, impact: a.impact.total })),
  };
}

server.tool(
  'show_profile',
  'Return the current interest profile: axes (id, label, normalized weight, keywords, reachAnchors, ' +
    'federation source), user context, last scan time, and a `gaps` report (needsOnboarding / ' +
    'lensNarrow / per-axis keyword+anchor counts + federated flag). Use `gaps` to decide whether to ' +
    'run the onboarding/refresh playbook. Empty means the profile needs setup via update_profile.',
  {},
  async () => {
    const profile = repo.loadProfile();
    if (!profile) {
      return ok({
        configured: false,
        hint: 'No profile yet. Call update_profile with axes + user_context.',
      });
    }
    return ok({ ...profile, gaps: profileGaps(profile) });
  },
);

server.tool(
  'update_profile',
  'Upsert the interest profile. Pass axes (weights auto-normalize to sum 1.0, max 6 axes) and/or ' +
    'user_context. This is the federation entry point: read another tool (firma/memex) yourself and ' +
    'feed the result here — skope never calls them.',
  {
    axes: z.array(axisSchema).optional().describe('Full axis set to replace the current one.'),
    user_context: z
      .object({
        location: z.string(),
        languages: z.array(z.string()).default(['en']),
        country: z
          .string()
          .optional()
          .describe(
            'ISO 3166-1 alpha-2 of the CURRENT situation (e.g. "NZ"). Drives Tier-2 + region.',
          ),
        region: z
          .string()
          .optional()
          .describe('Bloc token for the situational lattice, e.g. "APAC".'),
      })
      .optional()
      .describe(
        'Where/how the user lives NOW. Drives geographic + situational reachability and Tier-2 ' +
          'sources. Keep it fresh from conversation/memex — current location can differ from home.',
      ),
  },
  async ({ axes, user_context }) => {
    const current = repo.loadProfile();
    let nextAxes: Axis[];
    try {
      nextAxes = axes ? normalizeAxes(axes as Axis[]) : (current?.axes ?? []);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    const userContext = user_context ?? current?.userContext ?? { location: '', languages: ['en'] };
    if (nextAxes.length === 0) {
      return err('A profile needs at least one axis.');
    }
    repo.saveProfile({ version: 'v2', userContext, axes: nextAxes, lastScan: current?.lastScan });
    return ok(repo.loadProfile());
  },
);

server.tool(
  'ingest_news',
  'PRIMARY collection path — no API key. YOU search the web yourself (your own web-search tool), ' +
    "then hand the results here. Generate queries from BOTH each axis's keywords (direct) AND its " +
    'reachAnchors (causal-upstream) — the anchors are what broadens the lens beyond the literal ' +
    "profile terms. Prefer the user's Tier-1/2 trusted outlets and articles newer than last_scan. " +
    'skope canonicalizes URLs, ' +
    'derives the trust tier from each source, dedups by URL hash, rule-scores reachability against ' +
    'the profile, and persists to the ledger. Returns how many entered the radar.',
  {
    articles: z.array(ingestArticleSchema).min(1).describe('Web-search results you collected.'),
    query_context: z.string().optional().describe('What you searched for (audit only).'),
    current_location: z
      .string()
      .optional()
      .describe(
        'Where the user physically is NOW if it differs from their durable home (e.g. "Auckland, ' +
          'New Zealand" while traveling). Transient — not saved to the profile; just unions into the ' +
          'situational region for THIS batch so local news surfaces while away.',
      ),
  },
  async ({ articles, current_location }) => {
    const profile = repo.loadProfile();
    if (!profile) {
      return err('No profile. Call update_profile first.');
    }
    const topics = profile.axes.flatMap((a) => [a.id, ...a.keywords, ...(a.reachAnchors ?? [])]);
    const raw: RawArticle[] = articles.map((a) => ({
      url: a.url,
      title: a.title,
      snippet: a.snippet,
      source: a.source,
      publishedAt: a.published_at ? Date.parse(a.published_at) || undefined : undefined,
    }));
    const normalized = normalizeArticles(raw, { location: profile.userContext.location, topics });
    return ok(ingest(profile, normalized, articles.length, current_location));
  },
);

server.tool(
  'scan_news',
  'FALLBACK collection path — requires a Tavily API key. Use only when you have no web-search tool ' +
    'of your own, or you want skope to enforce the trusted-domain whitelist and the 5-call budget. ' +
    'skope calls Tavily with your queries, injects the Tier-1/2 whitelist, then runs the same ' +
    'dedup/score/persist pipeline as ingest_news.',
  {
    queries: z.array(z.string()).min(1).describe('Search queries, one per intent. Capped at 5.'),
    time_range: z.string().optional().describe('Window hint: 1d / 1w / 1m / 1y. Defaults to 1w.'),
    current_location: z
      .string()
      .optional()
      .describe('Transient current location if away from home; unions into situational region.'),
  },
  async ({ queries, time_range, current_location }) => {
    const profile = repo.loadProfile();
    if (!profile) {
      return err('No profile. Call update_profile first.');
    }
    const apiKey = getTavilyKey();
    if (!apiKey) {
      return err(
        'No Tavily key. Use ingest_news instead, or set SKOPE_TAVILY_API_KEY / ' +
          '~/.skope/config.json { "tavily_api_key": "..." }.',
      );
    }
    const topics = profile.axes.flatMap((a) => [a.id, ...a.keywords, ...(a.reachAnchors ?? [])]);
    const provider = createSearchProvider({
      apiKey,
      location: profile.userContext.location,
      topics,
    });
    const searchQueries: SearchQuery[] = queries
      .slice(0, 5)
      .map((q) => ({ query: q, timeRange: time_range ?? '1w' }));
    const articles = await provider.search(searchQueries);
    return ok(ingest(profile, articles, searchQueries.length, current_location));
  },
);

server.tool(
  'get_brief',
  'Assemble the two-layer brief from the ledger (no web fetch): [radar] reachability-scored news ' +
    'toward the user + [world] top global headlines (shown regardless of relevance) + the ' +
    'Effective-N concentration meter. Render the causal-chain narrative yourself from each ' +
    "article's impact.seeds; synthesize the prose as a REPORT. Go deep, not shallow — a bare " +
    '"this reaches you" line is not enough: (1) group related radar items into a single thesis ' +
    'rather than listing them; (2) for the top reachability clusters, pull the relevant federated ' +
    'drill-down — firma (show_concentration / show_risk / simulate_scenario) for asset items, memex ' +
    'for career/knowledge — and quantify the exposure with real numbers: position sizes, ' +
    'correlations, concentration (compare firma portfolio Effective-N vs skope news Effective-N), ' +
    'cross-factor tensions; (3) end each cluster with a so-what / what-to-watch. The radar ' +
    'auto-rotates — articles shown in a recent brief are demoted (not dropped) so each brief ' +
    'surfaces newer items. Run ingest_news first if the ledger is stale.',
  {},
  async () => {
    const profile = repo.loadProfile();
    if (!profile) {
      return err('No profile. Call update_profile first.');
    }
    const excluded = repo.exclusionSet();
    // Expire situational items tied to a region the user has left — the broad band tracks NOW, and
    // the ledger never re-scores. Region/category sets come from the same builder scoring uses.
    const sit = buildSituationalContext(profile.userContext);
    const currentRegions = new Set(sit.regionTokens.map((r) => r.token));
    const systemicIds = new Set(sit.systemic.map((c) => c.id));
    const scored = dropStaleSituational(
      repo.recentScored(24, excluded),
      currentRegions,
      systemicIds,
    );
    const radarHashes = new Set(scored.map((a) => a.urlHash));
    const world = repo.recentWorld(24, 5, radarHashes);
    const axisTotals = repo.axisTotals(14);
    // Read prior appearances BEFORE assembling so the freshness decay demotes already-shown items;
    // record this render's radar AFTER, so a brief never penalizes itself — only the next one.
    const lastShownAt = repo.lastShownMap();
    const brief = assembleBrief({ scored, world, axisTotals, lastShownAt });
    repo.recordAppearances(brief.radar.map((a) => a.urlHash));
    return ok(brief);
  },
);

server.tool(
  'mark_read',
  'Record articles as read so they are deterministically excluded from future briefs. Pass the ' +
    'article URLs (skope hashes them to the ledger key).',
  {
    urls: z.array(z.string()).min(1).describe('Article URLs the user has seen/read.'),
  },
  async ({ urls }) => {
    repo.markRead(urls.map((u) => urlHash(u)));
    return ok({ marked: urls.length });
  },
);

server.tool(
  'reading_signal',
  'The "living profile" substrate: deterministic patterns in what the user actually READ over a ' +
    'window (default 14d). Use it to keep the profile alive — but honor the gates, do not blindly ' +
    'strengthen what was read (that rebuilds the echo chamber). Fields: hotByReachAnchor (reads that ' +
    'entered via a causal anchor → the strongest case to PROMOTE that anchor to a keyword; prefer ' +
    'this over weight changes); hotByEntity / hotByAxis (with exposure denominator); staleAxes (low ' +
    'reads despite real exposure → downweight toward the general axis, never toward a hot axis); ' +
    'unmatchedReads (reads with no interest-axis path → a new-interest candidate, YOU name the topic ' +
    'and add it as a keyword on an EXISTING axis, since the 6-axis cap leaves little room); ' +
    'concentrationGate (only act on strengthening when safeToStrengthen is true). Write durable ' +
    'inferences back to memex with a derived-from:skope tag.',
  {
    window_days: z.number().optional().describe('Lookback window in days. Defaults to 14.'),
  },
  async ({ window_days }) => {
    const profile = repo.loadProfile();
    if (!profile) {
      return err('No profile. Call update_profile first.');
    }
    return ok(repo.readingSignal(window_days ?? 14));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
