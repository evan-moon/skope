import type { Article, RawArticle, Tier } from '@skope/domain';
import { classifyTier } from '@skope/source-trust';
import { urlHash } from '@skope/utils';

export interface NormalizeConfig {
  /** User location, drives Tier-2 classification. */
  location: string;
  /** Active topics (axis ids + keywords), drives Tier-3 classification. */
  topics?: string[];
}

function hostOf(source: string): string {
  try {
    return source.includes('://') ? new URL(source).host.replace(/^www\./, '') : source;
  } catch {
    return source;
  }
}

/**
 * Turn raw articles (from the LLM's own web search, via ingest_news) into deterministic domain
 * Articles: derive the urlHash and the trust tier here, so identity and trust are skope's call —
 * not the caller's. Dedups within the batch. No API key required; this is the key-less primary path.
 */
export function normalizeArticles(raw: RawArticle[], config: NormalizeConfig): Article[] {
  const topics = config.topics ?? [];
  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const r of raw) {
    const hash = urlHash(r.url);
    if (seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    const source = hostOf(r.source);
    articles.push({
      urlHash: hash,
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      source,
      tier: classifyTier(source, config.location, topics) as Tier,
      publishedAt: r.publishedAt,
    });
  }
  return articles;
}
