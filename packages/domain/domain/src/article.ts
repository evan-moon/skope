/**
 * Source trust tier. Lower is more trusted.
 * 1 = global anchors (Reuters/AP/Bloomberg), 2 = country leaders (Yonhap/NHK), 3 = domain experts.
 * 0 is reserved for "unranked / unknown local source" — handled conservatively downstream.
 */
export type Tier = 0 | 1 | 2 | 3;

/**
 * An article as handed in from a collection source — either Tavily (scan_news) or, primarily, the
 * orchestrating LLM's own web search (ingest_news). No urlHash/tier yet: skope derives those
 * deterministically (hash + classifyTier) so the ledger stays the single arbiter of identity/trust,
 * regardless of who fetched the bytes.
 */
export interface RawArticle {
  url: string;
  title: string;
  snippet?: string;
  /** Publisher domain or name, e.g. "reuters.com". */
  source: string;
  /** Epoch ms, when the source provides it. */
  publishedAt?: number;
}

/** A raw discovered article, deduped by urlHash. The deterministic ledger's atomic unit. */
export interface Article {
  /** Deterministic id = hash(canonical url). The dedup key. */
  urlHash: string;
  url: string;
  title: string;
  snippet?: string;
  /** Publisher domain or name, e.g. "reuters.com". */
  source: string;
  tier: Tier;
  /** Epoch ms, when available from the provider. */
  publishedAt?: number;
}

import type { ImpactScore } from './impact.ts';

/** An article that survived rule scoring, carrying its impact and reachability seed. */
export interface ScoredArticle extends Article {
  impact: ImpactScore;
}
