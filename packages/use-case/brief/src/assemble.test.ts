import type { ScoredArticle } from '@skope/domain';
import { describe, expect, it } from 'vitest';
import { assembleBrief, freshnessDecay } from './assemble.ts';

const DAY = 24 * 60 * 60 * 1000;

const scored = (urlHash: string, total: number): ScoredArticle => ({
  urlHash,
  url: `https://example.com/${urlHash}`,
  title: urlHash,
  source: 'reuters.com',
  tier: 1,
  impact: { total, hits: [{ axisId: 'asset', contribution: total }], seeds: [] },
});

describe('freshnessDecay', () => {
  it('does not penalize a never-shown article', () => {
    expect(freshnessDecay(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('damps a just-shown article to the floor', () => {
    expect(freshnessDecay(0)).toBeCloseTo(0.3);
  });

  it('recovers to full rank after the recovery window', () => {
    expect(freshnessDecay(3 * DAY)).toBe(1);
    expect(freshnessDecay(1.5 * DAY)).toBeCloseTo(0.65);
  });
});

describe('assembleBrief radar rotation', () => {
  const now = 1_000 * DAY;

  it('demotes a recently-shown article below an equally-scored fresh one', () => {
    const brief = assembleBrief(
      {
        scored: [scored('shown', 0.5), scored('fresh', 0.5)],
        world: [],
        axisTotals: [],
        lastShownAt: new Map([['shown', now]]),
      },
      now,
    );
    expect(brief.radar.map((a) => a.urlHash)).toEqual(['fresh', 'shown']);
  });

  it('demotes but never drops — a shown article still beats an empty slot', () => {
    const brief = assembleBrief(
      {
        scored: [scored('shown', 0.9)],
        world: [],
        axisTotals: [],
        lastShownAt: new Map([['shown', now]]),
      },
      now,
    );
    expect(brief.radar).toHaveLength(1);
  });

  it('lets a high-impact shown article still outrank a much weaker fresh one', () => {
    const brief = assembleBrief(
      {
        scored: [scored('shown', 0.9), scored('fresh', 0.2)],
        world: [],
        axisTotals: [],
        lastShownAt: new Map([['shown', now]]),
      },
      now,
    );
    // 0.9 * 0.3 = 0.27 > 0.2 → the strong story holds even just after being shown.
    expect(brief.radar.map((a) => a.urlHash)).toEqual(['shown', 'fresh']);
  });
});
