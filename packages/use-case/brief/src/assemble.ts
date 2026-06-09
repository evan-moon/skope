import type { Article, Brief, ScoredArticle } from '@skope/domain';
import { type AxisImpactTotals, concentration } from '@skope/watch';

export interface AssembleInput {
  /** Reachability-scored articles (from discovery.scoreBatch), already sorted desc. */
  scored: ScoredArticle[];
  /** Top global headlines, shown regardless of relevance (the bubble outside). */
  world: Article[];
  /** Per-axis cumulative impact over the rolling window, for the concentration meter. */
  axisTotals: AxisImpactTotals[];
  /** Max items in the radar layer. */
  radarLimit?: number;
  /** Max items in the world layer. */
  worldLimit?: number;
  /**
   * url_hash → epoch-ms it was last *shown* in a brief. Drives the freshness decay so a just-shown
   * article is demoted (never dropped) below genuinely new ones. Absent map / missing key = never
   * shown = no penalty. This is the only clock-dependent input; the deterministic ledger (impact
   * scores, Effective-N) is never touched — decay lives strictly at read time.
   */
  lastShownAt?: ReadonlyMap<string, number>;
}

/** Just-shown articles decay to this fraction of their impact, then recover linearly to 1.0. */
const FRESH_FLOOR = 0.3;
/** How long until a shown article fully recovers its rank (~3 days). */
const RECOVERY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Read-time freshness multiplier in [FRESH_FLOOR, 1]. An article shown `ageMs` ago is damped toward
 * FRESH_FLOOR right after it's seen and recovers linearly to 1.0 over RECOVERY_MS — so "show me new
 * ones next time" holds without ever emptying a thin radar (a thrice-shown article still beats an
 * empty slot). Never shown (ageMs = +Infinity) → 1.0.
 */
export function freshnessDecay(ageMs: number): number {
  if (!Number.isFinite(ageMs)) {
    return 1;
  }
  const recovered = Math.min(1, Math.max(0, ageMs) / RECOVERY_MS);
  return FRESH_FLOOR + (1 - FRESH_FLOOR) * recovered;
}

/**
 * Assemble the two-layer brief: [your radar] (reachability-scored) + [world headlines] (top global,
 * shown even when irrelevant so the world outside your bubble is never hidden) + the concentration
 * meter. The radar is re-ranked by impact × freshness so already-shown items sink before slicing.
 * Pure: synthesis into prose is the LLM's job, downstream of this structured result.
 */
export function assembleBrief(input: AssembleInput, now: number = Date.now()): Brief {
  const radarLimit = input.radarLimit ?? 12;
  const worldLimit = input.worldLimit ?? 5;
  const lastShown = input.lastShownAt;
  const radar = [...input.scored]
    .map((a) => {
      const shownAt = lastShown?.get(a.urlHash);
      const effective =
        a.impact.total * freshnessDecay(shownAt === undefined ? Infinity : now - shownAt);
      return { article: a, effective };
    })
    .sort((x, y) => y.effective - x.effective)
    .slice(0, radarLimit)
    .map((x) => x.article);
  return {
    radar,
    world: input.world.slice(0, worldLimit),
    concentration: concentration(input.axisTotals),
    generatedAt: now,
  };
}
