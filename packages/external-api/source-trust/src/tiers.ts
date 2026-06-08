/**
 * Tiered trust seed. We do NOT carry a global media-credibility DB (infeasible). Instead:
 * - Tier 1: a small, stable global-anchor whitelist (everyone shares it).
 * - Tier 2: per-country reference outlets, injected dynamically from the user's location.
 * - Tier 3: domain-expert outlets keyed by topic.
 * Anything else resolves to Tier 0 (unranked) and is treated conservatively downstream.
 */

/** Global anchors — shared by every user regardless of location. */
export const TIER1_GLOBAL: readonly string[] = [
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'bbc.com',
];

/**
 * Country → reference outlets. Keyed by ISO 3166-1 alpha-2 (uppercased).
 * Seed set only; extend as users in new regions appear.
 */
export const TIER2_BY_COUNTRY: Record<string, readonly string[]> = {
  KR: ['yna.co.kr', 'yonhapnews.co.kr', 'hani.co.kr', 'chosun.com'],
  JP: ['nhk.or.jp', 'asahi.com', 'nikkei.com'],
  US: ['npr.org', 'washingtonpost.com', 'cnbc.com'],
  GB: ['theguardian.com', 'telegraph.co.uk'],
  DE: ['dw.com', 'spiegel.de'],
  FR: ['lemonde.fr', 'lefigaro.fr'],
  IN: ['thehindu.com', 'indianexpress.com'],
  BR: ['globo.com', 'folha.uol.com.br'],
};

/** Topic → domain-expert outlets. */
export const TIER3_BY_TOPIC: Record<string, readonly string[]> = {
  tech: ['techcrunch.com', 'theverge.com', 'arstechnica.com'],
  crypto: ['theblock.co', 'coindesk.com'],
  finance: ['marketwatch.com', 'barrons.com'],
  science: ['nature.com', 'sciencemag.org'],
};

/** Very small country-name → ISO map for free-text UserContext.location like "Seoul, Korea". */
const COUNTRY_ALIASES: Record<string, string> = {
  korea: 'KR',
  'south korea': 'KR',
  한국: 'KR',
  대한민국: 'KR',
  서울: 'KR',
  japan: 'JP',
  일본: 'JP',
  日本: 'JP',
  도쿄: 'JP',
  東京: 'JP',
  usa: 'US',
  'united states': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  india: 'IN',
  brazil: 'BR',
  brasil: 'BR',
};

/** Best-effort country resolution from a free-text location string. */
export function resolveCountry(location: string): string | undefined {
  const lower = location.toLowerCase();
  for (const [name, iso] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(name)) {
      return iso;
    }
  }
  return undefined;
}
