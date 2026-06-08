import type {
  Article,
  Axis,
  AxisHit,
  ImpactScore,
  MatchType,
  ReachabilitySeed,
  ScoredArticle,
} from '@skope/domain';

/** Per-match-type base strength. geo/entity (direct) outrank a loose keyword brush. */
const STRENGTH: Record<MatchType, number> = {
  geo: 1.0,
  entity: 0.9,
  keyword: 0.6,
  sector: 0.5,
};

/**
 * Source-trust multiplier on the final impact. A trusted global anchor (Tier 1) keeps full weight;
 * an unranked source (Tier 0) is damped, so two articles on the same topic rank by source trust —
 * the "trust lens" actually affects ranking, not just a display tag.
 */
const TIER_FACTORS: Record<number, number> = { 1: 1.0, 2: 0.9, 3: 0.85, 0: 0.6 };

/** Virtual axis id for geographic reachability — a path that isn't one of the user's chosen axes. */
const GEO_AXIS = 'geo';
/** Weight of the geo reachability path. Below a direct keyword hit, but enough to clear the radar. */
const GEO_WEIGHT = 0.15;

function haystack(article: Article): string {
  return `${article.title} ${article.snippet ?? ''}`.toLowerCase();
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Does `text` (already lowercased) contain `needle` as a real match, not a spurious substring?
 * ASCII keywords match on word boundaries so short ones like "AI" don't fire on "Spain"/"rain".
 * Non-ASCII keywords (Korean/CJK have no word boundaries) fall back to substring containment.
 */
function keywordMatches(text: string, needle: string): boolean {
  if (needle.length === 0) {
    return false;
  }
  if (/^[a-z0-9 +#.-]+$/.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(text);
  }
  return text.includes(needle);
}

/** Rule-match a single axis against an article, emitting reachability seeds for each keyword hit. */
function seedsForAxis(article: Article, axis: Axis): ReachabilitySeed[] {
  const text = haystack(article);
  const seeds: ReachabilitySeed[] = [];
  for (const kw of axis.keywords) {
    if (keywordMatches(text, kw.toLowerCase().trim())) {
      seeds.push({ axisId: axis.id, entity: kw, matchType: 'keyword', strength: STRENGTH.keyword });
    }
  }
  return seeds;
}

/**
 * Geographic reachability: news about where the user lives reaches them even with no keyword match.
 * Tokenize the location ("Seoul, Korea" → seoul, korea) and emit a geo seed per hit. This is the
 * deterministic "resident-country passthrough" the design promises for a worldwide user base.
 */
function seedsForGeo(article: Article, location: string): ReachabilitySeed[] {
  const text = haystack(article);
  const tokens = location
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const seeds: ReachabilitySeed[] = [];
  for (const token of tokens) {
    if (keywordMatches(text, token)) {
      seeds.push({ axisId: GEO_AXIS, entity: token, matchType: 'geo', strength: STRENGTH.geo });
    }
  }
  return seeds;
}

/**
 * Geo seeds for an article: explicit location-token matches, OR — language-agnostically — the fact
 * that the source is a Tier-2 outlet, which classifyTier only assigns to the *user's own resident
 * country* press. So a Korean-language local story from yna.co.kr reaches a Seoul user without any
 * multilingual token table.
 */
function geoSeedsFor(article: Article, location?: string): ReachabilitySeed[] {
  const tokenSeeds = location ? seedsForGeo(article, location) : [];
  if (tokenSeeds.length === 0 && article.tier === 2) {
    return [{ axisId: GEO_AXIS, entity: article.source, matchType: 'geo', strength: STRENGTH.geo }];
  }
  return tokenSeeds;
}

/**
 * The deterministic impact kernel. For each article, rule-match every axis, emit ReachabilitySeeds,
 * and roll them into a weighted ImpactScore. Tier-1 sources get a small reliability floor so a
 * trusted global anchor isn't dropped purely for lacking a keyword (it still needs *some* path to
 * enter the radar; with zero seeds it stays a "world headline", handled by brief).
 *
 * The LLM later renders the causal-chain narrative from `seeds` — skope stores only the seed.
 */
export function scoreArticle(article: Article, axes: Axis[], location?: string): ImpactScore {
  const hits: AxisHit[] = [];
  const seeds: ReachabilitySeed[] = [];
  // Trust damping is folded into each hit's contribution (not just the total) so it survives
  // persistence and reconstruction, and flows honestly into the Effective-N concentration meter.
  const tierFactor = TIER_FACTORS[article.tier] ?? TIER_FACTORS[0];

  for (const axis of axes) {
    const axisSeeds = seedsForAxis(article, axis);
    if (axisSeeds.length === 0) {
      continue;
    }
    seeds.push(...axisSeeds);
    const best = Math.max(...axisSeeds.map((s) => s.strength));
    hits.push({ axisId: axis.id, contribution: axis.weight * best * tierFactor });
  }

  // Geo is a FLOOR, not a bonus: it only carries an article in when no interest axis matched, so
  // keyword-matched articles keep clean source-tier ordering (a Tier-2 local hit can't leapfrog a
  // Tier-1 source on the same topic).
  if (hits.length === 0) {
    const geoSeeds = geoSeedsFor(article, location);
    if (geoSeeds.length > 0) {
      seeds.push(...geoSeeds);
      hits.push({ axisId: GEO_AXIS, contribution: GEO_WEIGHT * STRENGTH.geo * tierFactor });
    }
  }

  const total = Math.min(
    1,
    hits.reduce((a, h) => a + h.contribution, 0),
  );
  return { total, hits, seeds };
}

/**
 * Score a batch, drop anything already in the exclusion set (read/seen/muted — deterministic dedup),
 * keep only articles with a reachability path, and sort by impact descending. `location` enables the
 * geographic reachability path (resident-country passthrough).
 */
export function scoreBatch(
  articles: Article[],
  axes: Axis[],
  excluded: ReadonlySet<string> = new Set(),
  location?: string,
): ScoredArticle[] {
  return articles
    .filter((a) => !excluded.has(a.urlHash))
    .map((a) => ({ ...a, impact: scoreArticle(a, axes, location) }))
    .filter((a) => a.impact.seeds.length > 0)
    .sort((a, b) => b.impact.total - a.impact.total);
}
