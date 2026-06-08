import { resolveCountry, TIER1_GLOBAL, TIER2_BY_COUNTRY, TIER3_BY_TOPIC } from './tiers.ts';

/** Trust tier as a plain number (mirrors domain's Tier without depending on it — external-api stays dep-free). */
export type TierValue = 0 | 1 | 2 | 3;

/** Normalize a URL/host to a bare registrable-ish host for whitelist comparison. */
function hostOf(source: string): string {
  try {
    const h = source.includes('://') ? new URL(source).host : source;
    return h.toLowerCase().replace(/^www\./, '');
  } catch {
    return source.toLowerCase();
  }
}

function matches(host: string, list: readonly string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Deterministically tier a source for a user. Tier 2 depends on the user's country; Tier 3 on the
 * active topics (from axis keywords/labels). Unranked → 0.
 */
export function classifyTier(source: string, location: string, topics: string[] = []): TierValue {
  const host = hostOf(source);
  if (matches(host, TIER1_GLOBAL)) {
    return 1;
  }
  const country = resolveCountry(location);
  if (country && matches(host, TIER2_BY_COUNTRY[country] ?? [])) {
    return 2;
  }
  for (const topic of topics) {
    if (matches(host, TIER3_BY_TOPIC[topic.toLowerCase()] ?? [])) {
      return 3;
    }
  }
  return 0;
}

/** The set of trusted domains to inject into search queries (site: filters) for this user. */
export function trustedDomains(location: string, topics: string[] = []): string[] {
  const country = resolveCountry(location);
  const tier2 = country ? (TIER2_BY_COUNTRY[country] ?? []) : [];
  const tier3 = topics.flatMap((t) => TIER3_BY_TOPIC[t.toLowerCase()] ?? []);
  return [...TIER1_GLOBAL, ...tier2, ...tier3];
}
