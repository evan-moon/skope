/**
 * Cross-persona validation: does skope's RULE ENGINE surface the right articles for different users?
 * One shared, diverse pool scored against five personas via the pure scoreBatch — no DB, no LLM, no
 * curation. Logs the reach matrix and asserts the discriminating invariants (the same article must
 * reach the right people, drop for the wrong ones, and reach different people via DIFFERENT seeds).
 */
import { buildSituationalContext } from '@skope/adapters';
import { scoreBatch } from '@skope/discovery';
import type { Article, Profile, ScoredArticle } from '@skope/domain';
import { describe, expect, it } from 'vitest';

const art = (id: string, title: string, snippet: string): Article => ({
  urlHash: id,
  url: `https://example.com/${id}`,
  title,
  snippet,
  source: 'reuters.com',
  tier: 1,
});

const POOL: Article[] = [
  art(
    'tesla',
    'Tesla launches unsupervised robotaxi in Austin',
    'TSLA shares jump as Tesla goes driverless; JPMorgan upgrade.',
  ),
  art(
    'spacex',
    'SpaceX IPO forces Nasdaq-100 funds to buy $22B',
    'Index funds must sell Apple, Microsoft and Nvidia to buy SpaceX.',
  ),
  art(
    'cpi',
    'US inflation runs hot at 3.8% as oil shock bites',
    'US CPI accelerated; the Federal Reserve faces a sticky rate decision as inflation rises.',
  ),
  art(
    'soy',
    "Argentina's soy exports to China soar",
    'China buys over 1M tonnes of soybean from Argentina; Rosario grain export margins firm.',
  ),
  art(
    'drought',
    'La Nina fades but drought hits Argentina farms',
    'Lingering drought and soil health weigh on the soybean crop across Argentina.',
  ),
  art(
    'oil',
    'Oil shock lifts diesel and fertilizer costs',
    'The Hormuz crude oil disruption pushed diesel and fertilizer prices higher; natural gas up too.',
  ),
  art(
    'nvda',
    'NVIDIA and TSMC deepen AI chip partnership',
    'Nvidia and TSMC expand semiconductor and GPU capacity for AI datacenters.',
  ),
  art(
    'react',
    'React 19 and Next.js reshape frontend',
    'React Server Components and TypeScript dominate frontend; Next.js leads.',
  ),
  art(
    'btc',
    'Bitcoin ETF inflows surge as crypto rallies',
    'Bitcoin and Ethereum jump; spot crypto ETF demand hits records.',
  ),
  art(
    'nurse',
    'German hospitals face deepening nurse staffing shortage',
    'A nursing union warns hospital staffing and health policy are at breaking point in Germany.',
  ),
  art(
    'energy_de',
    'German energy bills spike as gas prices climb',
    'Heating and electricity price hikes hit German households; Berlin debates relief.',
  ),
  art(
    'unity',
    'Unity overhauls pricing as indie studios eye Unreal',
    'The Unity game engine faces Steam indie backlash; game studios weigh alternatives.',
  ),
  art(
    'oilco',
    'OPEC supply curbs send crude oil to a 2-year high',
    'OPEC cuts and the Hormuz crisis lift crude oil and natural gas; refinery margins widen.',
  ),
  art(
    'quake',
    'Magnitude 7.8 earthquake strikes the Philippines',
    'A powerful earthquake triggers Pacific tsunami warnings; dozens killed.',
  ),
  art(
    'kpop',
    'K-pop group announces sold-out world tour',
    'The group will play 30 cities; fan demand breaks records.',
  ),
];

const persona = (
  location: string,
  country: string,
  region: string,
  axes: Profile['axes'],
): Profile => ({
  version: 'v2',
  userContext: { location, country, region, languages: ['en'] },
  axes,
});

const a = (id: string, weight: number, keywords: string[], reachAnchors: string[]) => ({
  id,
  label: id,
  weight,
  keywords,
  reachAnchors,
});
const general = a('general', 0.1, [], []);

const PERSONAS: Record<string, Profile> = {
  'Evan (Seoul, tech investor)': persona('Seoul, Korea', 'KR', 'APAC', [
    a(
      'asset',
      0.4,
      ['TSLA', 'Tesla', 'NVDA', 'Nvidia', 'Apple', 'Microsoft'],
      ['Federal Reserve', 'CPI', 'Nasdaq', 'TSMC', 'interest rate'],
    ),
    a('career', 0.3, ['Toss', 'fintech'], ['fintech regulation']),
    a('knowledge', 0.2, ['React', 'frontend', 'TypeScript'], ['Next.js', 'AI coding']),
    general,
  ]),
  'Lucia (Rosario, soy farmer)': persona('Rosario, Argentina', 'AR', 'LATAM', [
    a(
      'asset',
      0.4,
      ['soybean', 'wheat', 'corn'],
      ['fertilizer', 'diesel', 'crude oil', 'China soybean demand', 'La Nina'],
    ),
    a('career', 0.3, ['agribusiness', 'grain export'], ['Rosario', 'export tariff']),
    a('knowledge', 0.2, ['agronomy'], ['drought', 'soil health']),
    general,
  ]),
  'Hans (Berlin, nurse)': persona('Berlin, Germany', 'DE', 'EU', [
    a('asset', 0.3, ['rent', 'energy bill'], ['heating', 'electricity price', 'inflation']),
    a('career', 0.4, ['nurse', 'hospital', 'healthcare'], ['staffing shortage', 'health policy']),
    a('knowledge', 0.2, ['public health'], ['medicine']),
    general,
  ]),
  'Kenji (Lisbon, game dev)': persona('Lisbon, Portugal', 'PT', 'EU', [
    a('asset', 0.3, ['Bitcoin', 'Ethereum', 'crypto'], ['ETF', 'interest rate', 'stablecoin']),
    a('career', 0.4, ['indie game', 'Steam', 'game studio'], ['Unity', 'Unreal']),
    a('knowledge', 0.2, ['game engine', 'GPU'], ['shader', 'WebGPU']),
    general,
  ]),
  'Dale (Houston, oil engineer)': persona('Houston, United States', 'US', 'NA', [
    a(
      'asset',
      0.4,
      ['Exxon', 'Chevron', 'oil and gas'],
      ['crude oil', 'OPEC', 'natural gas', 'refinery'],
    ),
    a('career', 0.3, ['drilling', 'refinery'], ['Hormuz', 'shale']),
    a('knowledge', 0.2, ['petroleum engineering'], ['LNG']),
    general,
  ]),
};

function scoreFor(p: Profile): Map<string, ScoredArticle> {
  const scored = scoreBatch(
    POOL,
    p.axes,
    new Set(),
    p.userContext.location,
    buildSituationalContext(p.userContext),
  );
  return new Map(scored.map((s) => [s.urlHash, s]));
}

describe('cross-persona reachability', () => {
  it('surfaces the right articles per persona and drops the wrong ones (logs the matrix)', () => {
    for (const [label, p] of Object.entries(PERSONAS)) {
      const m = scoreFor(p);
      const ranked = [...m.values()].sort((x, y) => y.impact.total - x.impact.total);
      console.log(`\n=== ${label} ===`);
      for (const s of ranked) {
        const via = s.impact.seeds.map((x) => `${x.entity}(${x.matchType})`).join(', ');
        console.log(`  ${s.impact.total.toFixed(3)}  ${s.urlHash.padEnd(10)} ← ${via}`);
      }
      const dropped = POOL.filter((x) => !m.has(x.urlHash)).map((x) => x.urlHash);
      console.log(`  DROPPED: ${dropped.join(', ')}`);
    }

    const reach = Object.fromEntries(Object.entries(PERSONAS).map(([k, p]) => [k, scoreFor(p)]));
    const evan = reach['Evan (Seoul, tech investor)'];
    const lucia = reach['Lucia (Rosario, soy farmer)'];
    const hans = reach['Hans (Berlin, nurse)'];
    const kenji = reach['Kenji (Lisbon, game dev)'];
    const dale = reach['Dale (Houston, oil engineer)'];

    // Personal items reach their person and DROP for everyone else.
    expect(evan.has('tesla')).toBe(true);
    expect(lucia.has('tesla')).toBe(false);
    expect(dale.has('tesla')).toBe(false);

    expect(lucia.has('soy')).toBe(true);
    expect(evan.has('soy')).toBe(false);
    expect(hans.has('soy')).toBe(false);

    expect(hans.has('nurse')).toBe(true);
    expect(evan.has('nurse')).toBe(false);

    expect(kenji.has('unity')).toBe(true);
    expect(lucia.has('unity')).toBe(false);

    // Pure noise reaches no one.
    for (const m of Object.values(reach)) {
      expect(m.has('kpop')).toBe(false);
    }

    // SAME oil shock reaches different people via DIFFERENT seeds (the reachability thesis).
    expect(lucia.get('oil')?.impact.seeds.some((s) => s.entity === 'fertilizer')).toBe(true);
    expect(dale.get('oilco')?.impact.seeds.some((s) => s.entity === 'crude oil')).toBe(true);

    // A systemic shock (earthquake) reaches everyone thinly via the situational band.
    for (const m of Object.values(reach)) {
      expect(m.get('quake')?.impact.seeds.some((s) => s.matchType === 'situational')).toBe(true);
    }
  });
});
