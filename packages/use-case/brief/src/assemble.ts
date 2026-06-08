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
}

/**
 * Assemble the two-layer brief: [your radar] (reachability-scored) + [world headlines] (top global,
 * shown even when irrelevant so the world outside your bubble is never hidden) + the concentration
 * meter. Pure: synthesis into prose is the LLM's job, downstream of this structured result.
 */
export function assembleBrief(input: AssembleInput, now: number = Date.now()): Brief {
  const radarLimit = input.radarLimit ?? 12;
  const worldLimit = input.worldLimit ?? 5;
  return {
    radar: input.scored.slice(0, radarLimit),
    world: input.world.slice(0, worldLimit),
    concentration: concentration(input.axisTotals),
    generatedAt: now,
  };
}
