/**
 * The closed, curated systemic-category enum — the world-systems whose state propagates to people
 * structurally exposed to them (cf. a world-monitor's cable/pipeline/sanction/disaster layers).
 *
 * This list is DELIBERATELY closed and small. It is the membership gate for skope's broad/thin
 * "situational reachability" band: an article qualifies for that band only if it matches one of these
 * categories (or the user's geo-region). Relaxing this to "anything important" rebuilds the firehose
 * that "lens, not filter" exists to reject. Extend it consciously, not reflexively.
 *
 * Keywords match the same way profile keywords do (word-boundary for ASCII, substring for CJK), so
 * keep them specific enough to avoid spurious hits.
 */
export interface SystemicCategorySeed {
  id: string;
  keywords: readonly string[];
}

export const SYSTEMIC_CATEGORIES: readonly SystemicCategorySeed[] = [
  {
    id: 'energy',
    keywords: [
      'oil price',
      'opec',
      'natural gas',
      'lng',
      'power grid',
      'electricity price',
      '유가',
      '전력',
    ],
  },
  {
    id: 'supply-chain',
    keywords: [
      'supply chain',
      'shipping',
      'port strike',
      'semiconductor shortage',
      'chip shortage',
      '공급망',
      '물류',
    ],
  },
  {
    id: 'sanctions',
    keywords: [
      'sanction',
      'sanctions',
      'embargo',
      'export control',
      'tariff',
      'trade war',
      '제재',
      '관세',
    ],
  },
  {
    id: 'rates-fx',
    keywords: [
      'central bank',
      'rate hike',
      'rate cut',
      'inflation',
      'currency crisis',
      'devaluation',
      '환율',
      '기준금리',
    ],
  },
  {
    id: 'cyber-outage',
    keywords: [
      'cyberattack',
      'ransomware',
      'data breach',
      'outage',
      'undersea cable',
      'submarine cable',
      '해킹',
      '정전',
    ],
  },
  {
    id: 'natural-disaster',
    keywords: [
      'earthquake',
      'tsunami',
      'hurricane',
      'typhoon',
      'flood',
      'wildfire',
      'volcano',
      '지진',
      '태풍',
    ],
  },
  {
    id: 'conflict',
    keywords: [
      'war',
      'invasion',
      'airstrike',
      'military strike',
      'ceasefire',
      'coup',
      '전쟁',
      '공습',
    ],
  },
  {
    id: 'pandemic',
    keywords: ['pandemic', 'outbreak', 'epidemic', 'novel virus', 'quarantine', '팬데믹', '전염병'],
  },
] as const;
