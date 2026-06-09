import type { Article, Axis, SituationalContext } from '@skope/domain';
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

const nzContext: SituationalContext = {
  regionTokens: ['new zealand', 'auckland'],
  systemic: [
    { id: 'natural-disaster', keywords: ['earthquake', 'tsunami'] },
    { id: 'sanctions', keywords: ['sanctions', 'embargo'] },
  ],
};

const assetAxis: Axis = { id: 'asset', label: 'Asset', weight: 1, keywords: ['TSLA'] };

describe('situational reachability (broad/thin band)', () => {
  it('seeds a region match for a user situated there', () => {
    const s = scoreArticle(
      article('New Zealand unveils new climate budget'),
      [],
      undefined,
      nzContext,
    );
    expect(s.seeds).toContainEqual(
      expect.objectContaining({
        axisId: 'situational',
        entity: 'new zealand',
        matchType: 'situational',
      }),
    );
  });

  it('seeds a systemic-category match by its id, not the keyword', () => {
    const s = scoreArticle(
      article('Magnitude 7.8 earthquake hits the Pacific'),
      [],
      undefined,
      nzContext,
    );
    expect(s.seeds).toContainEqual(
      expect.objectContaining({
        axisId: 'situational',
        entity: 'natural-disaster',
        matchType: 'situational',
      }),
    );
  });

  it('is ADDITIVE — co-occurs with a personal axis hit instead of being a fallback floor', () => {
    // Names TSLA (personal) AND a sanctions systemic shock — both paths must register.
    const s = scoreArticle(
      article('New US sanctions on chips hit TSLA suppliers'),
      [assetAxis],
      undefined,
      nzContext,
    );
    const axisIds = s.hits.map((h) => h.axisId).sort();
    expect(axisIds).toEqual(['asset', 'situational']);
  });

  it('the closed enum is the gate — unrelated world news gets no situational path', () => {
    const radar = scoreBatch(
      [article('A Brazilian football match recap')],
      [],
      new Set(),
      undefined,
      nzContext,
    );
    expect(radar).toHaveLength(0);
  });

  it('a situational-only hit clears the zero-seed drop and enters the radar', () => {
    const radar = scoreBatch(
      [article('Tsunami warning issued')],
      [],
      new Set(),
      undefined,
      nzContext,
    );
    expect(radar).toHaveLength(1);
    expect(radar[0].impact.total).toBeGreaterThan(0);
  });
});
