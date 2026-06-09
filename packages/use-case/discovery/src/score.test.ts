import type { Article, Axis } from '@skope/domain';
import { describe, expect, it } from 'vitest';
import { scoreArticle, scoreBatch } from './score.ts';

const article = (title: string, over: Partial<Article> = {}): Article => ({
  urlHash: title,
  url: `https://example.com/${encodeURIComponent(title)}`,
  title,
  source: 'reuters.com',
  tier: 1,
  ...over,
});

const assetAxis: Axis = {
  id: 'asset',
  label: 'Asset exposure',
  weight: 1,
  keywords: ['TSLA'],
  reachAnchors: ['Fed'],
};

describe('reachAnchor scoring', () => {
  it('emits a weaker "reach" seed when only a causal-upstream anchor matches', () => {
    const score = scoreArticle(article('Fed signals another rate hike'), [assetAxis]);
    expect(score.seeds).toHaveLength(1);
    expect(score.seeds[0]).toMatchObject({ axisId: 'asset', entity: 'Fed', matchType: 'reach' });
    expect(score.seeds[0].strength).toBe(0.5);
  });

  it('keeps a reach-only article in the radar (previously dropped as zero-seed)', () => {
    const radar = scoreBatch([article('Fed signals another rate hike')], [assetAxis]);
    expect(radar).toHaveLength(1);
  });

  it('ranks a direct keyword hit above a reach hit on the same axis', () => {
    const radar = scoreBatch(
      [article('Fed signals another rate hike'), article('TSLA earnings beat estimates')],
      [assetAxis],
    );
    expect(radar.map((a) => a.title)).toEqual([
      'TSLA earnings beat estimates',
      'Fed signals another rate hike',
    ]);
  });

  it('still drops an article with no direct keyword and no reachAnchor (regression)', () => {
    const radar = scoreBatch([article('A Brazilian football match recap')], [assetAxis]);
    expect(radar).toHaveLength(0);
  });

  it('treats a missing reachAnchors field as "direct keywords only"', () => {
    const legacyAxis: Axis = { id: 'asset', label: 'Asset', weight: 1, keywords: ['TSLA'] };
    const score = scoreArticle(article('Fed signals another rate hike'), [legacyAxis]);
    expect(score.seeds).toHaveLength(0);
  });
});
