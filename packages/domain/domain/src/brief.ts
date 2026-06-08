import type { Article, ScoredArticle } from './article.ts';

/**
 * Effective-N (Inverse Simpson) over the 14-day distribution of per-axis impact.
 * Mirrors firma's portfolio-concentration grammar: "your attention is as concentrated as your assets".
 */
export interface Concentration {
  /** 1 / Σ(p_i²) where p_i is axis i's share of cumulative impact. Range [1, axisCount]. */
  effectiveN: number;
  /** Per-axis share p_i, for transparency. */
  distribution: { axisId: string; share: number }[];
  /** Present when effectiveN falls below the threshold (default 1.8). */
  warning?: string;
}

/**
 * The two-layer brief. The radar is reachability-scored "news toward you"; world is top global
 * headlines shown regardless of relevance so the bubble outside is never hidden.
 */
export interface Brief {
  radar: ScoredArticle[];
  world: Article[];
  concentration: Concentration;
  generatedAt: number;
}
