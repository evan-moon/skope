import type { Article } from './article.ts';

/** A single search request. The whitelist of trusted domains is injected by the adapter, not here. */
export interface SearchQuery {
  query: string;
  /** ISO-ish window hint, e.g. "1d", "1w". Maps to the provider's incremental window. */
  timeRange?: string;
  /** Max results to pull for this query. */
  limit?: number;
}

/**
 * The port through which use-case/discovery reaches the outside world. use-case never imports a
 * concrete client (@skope/tavily) — only this interface. adapter/adapters supplies the impl,
 * wiring in source-trust so results arrive already tier-tagged.
 */
export interface SearchProvider {
  search(queries: SearchQuery[]): Promise<Article[]>;
}
