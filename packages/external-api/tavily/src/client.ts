/**
 * Minimal Tavily Search client. Raw transport only — no skope domain types here (external-api stays
 * dependency-free). The adapter maps these results into domain Articles and tier-tags them.
 *
 * Docs: https://docs.tavily.com/  (POST https://api.tavily.com/search)
 */

export interface TavilySearchParams {
  query: string;
  /** "day" | "week" | "month" | "year" — Tavily's incremental window. */
  topic?: 'news' | 'general';
  timeRange?: 'day' | 'week' | 'month' | 'year';
  maxResults?: number;
  /** Restrict to these domains (our Tier-1/2/3 whitelist). */
  includeDomains?: string[];
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilyClient {
  search(params: TavilySearchParams): Promise<TavilyResult[]>;
}

const ENDPOINT = 'https://api.tavily.com/search';

/** Construct a client bound to an API key (read from SKOPE_TAVILY_API_KEY by the adapter). */
export function createTavilyClient(apiKey: string): TavilyClient {
  return {
    async search(params: TavilySearchParams): Promise<TavilyResult[]> {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: params.query,
          topic: params.topic ?? 'news',
          time_range: params.timeRange ?? 'week',
          max_results: params.maxResults ?? 10,
          include_domains: params.includeDomains ?? [],
        }),
      });
      if (!res.ok) {
        throw new Error(`Tavily search failed: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { results?: TavilyResult[] };
      return json.results ?? [];
    },
  };
}
