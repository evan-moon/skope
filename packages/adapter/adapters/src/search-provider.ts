import type { Article, SearchProvider, SearchQuery, Tier } from '@skope/domain';
import { classifyTier, trustedDomains } from '@skope/source-trust';
import { createTavilyClient, type TavilyResult } from '@skope/tavily';
import { urlHash } from '@skope/utils';

export interface SearchProviderConfig {
  apiKey: string;
  /** User location, drives Tier-2 domain injection. */
  location: string;
  /** Active topics (from axis labels/keywords), drives Tier-3 injection + tagging. */
  topics?: string[];
}

const TIME_RANGE_MAP: Record<string, 'day' | 'week' | 'month' | 'year'> = {
  '1d': 'day',
  '1w': 'week',
  '1m': 'month',
  '1y': 'year',
};

function toArticle(r: TavilyResult, location: string, topics: string[]): Article {
  const source = (() => {
    try {
      return new URL(r.url).host.replace(/^www\./, '');
    } catch {
      return r.url;
    }
  })();
  return {
    urlHash: urlHash(r.url),
    url: r.url,
    title: r.title,
    snippet: r.content,
    source,
    tier: classifyTier(source, location, topics) as Tier,
    publishedAt: r.publishedDate ? Date.parse(r.publishedDate) || undefined : undefined,
  };
}

/**
 * Wire the concrete Tavily client to the domain SearchProvider port. This is the ONLY place that
 * imports both external-api and domain. Injects the trusted-domain whitelist and tier-tags results,
 * so use-case/discovery receives clean, already-trusted domain Articles.
 */
export function createSearchProvider(config: SearchProviderConfig): SearchProvider {
  const client = createTavilyClient(config.apiKey);
  const topics = config.topics ?? [];
  const whitelist = trustedDomains(config.location, topics);

  return {
    async search(queries: SearchQuery[]): Promise<Article[]> {
      const batches = await Promise.all(
        queries.map((q) =>
          client.search({
            query: q.query,
            timeRange: q.timeRange ? TIME_RANGE_MAP[q.timeRange] : undefined,
            maxResults: q.limit,
            includeDomains: whitelist,
          }),
        ),
      );
      const seen = new Set<string>();
      const articles: Article[] = [];
      for (const batch of batches) {
        for (const r of batch) {
          const article = toArticle(r, config.location, topics);
          if (!seen.has(article.urlHash)) {
            seen.add(article.urlHash);
            articles.push(article);
          }
        }
      }
      return articles;
    },
  };
}
