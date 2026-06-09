import type { ScoredArticle } from '@skope/domain';
import { describe, expect, it } from 'vitest';
import { assembleBrief, dropStaleSituational, freshnessDecay } from './assemble.ts';

const DAY = 24 * 60 * 60 * 1000;

const scored = (urlHash: string, total: number): ScoredArticle => ({
  urlHash,
  url: `https://example.com/${urlHash}`,
  title: urlHash,
  source: 'reuters.com',
  tier: 1,
  impact: { total, hits: [{ axisId: 'asset', contribution: total }], seeds: [] },
});

/** A purely-situational (broad/thin) article matching one systemic category. */
const situational = (urlHash: string, total: number, category: string): ScoredArticle => ({
  urlHash,
  url: `https://example.com/${urlHash}`,
  title: urlHash,
  source: 'reuters.com',
  tier: 1,
  impact: {
    total,
    hits: [{ axisId: 'situational', contribution: total }],
    seeds: [{ axisId: 'situational', entity: category, matchType: 'situational', strength: 1 }],
  },
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

describe('assembleBrief situational diversity cap', () => {
  it('caps purely-situational items at 3 per category so one system cannot flood the radar', () => {
    const quakes = [1, 2, 3, 4, 5].map((i) => situational(`quake${i}`, 0.09, 'natural-disaster'));
    const brief = assembleBrief({ scored: quakes, world: [], axisTotals: [] });
    expect(brief.radar).toHaveLength(3);
  });

  it('caps each category independently', () => {
    const mixed = [
      situational('q1', 0.09, 'natural-disaster'),
      situational('q2', 0.09, 'natural-disaster'),
      situational('q3', 0.09, 'natural-disaster'),
      situational('q4', 0.09, 'natural-disaster'),
      situational('s1', 0.09, 'sanctions'),
      situational('s2', 0.09, 'sanctions'),
    ];
    const brief = assembleBrief({ scored: mixed, world: [], axisTotals: [] });
    // 3 quakes (capped) + 2 sanctions (under cap) = 5
    expect(brief.radar.map((a) => a.urlHash)).toEqual(['q1', 'q2', 'q3', 's1', 's2']);
  });

  it('never caps personal-axis hits — only the broad/thin band', () => {
    const personal = [1, 2, 3, 4, 5].map((i) => scored(`p${i}`, 0.2));
    const brief = assembleBrief({ scored: personal, world: [], axisTotals: [] });
    expect(brief.radar).toHaveLength(5);
  });
});

describe('dropStaleSituational', () => {
  const currentRegions = new Set(['seoul', 'korea']);
  const systemicIds = new Set(['natural-disaster', 'sanctions']);
  const geoArticle = (urlHash: string): ScoredArticle => ({
    urlHash,
    url: `https://example.com/${urlHash}`,
    title: urlHash,
    source: 'rnz.co.nz',
    tier: 2,
    impact: {
      total: 0.135,
      hits: [{ axisId: 'geo', contribution: 0.135 }],
      seeds: [{ axisId: 'geo', entity: 'rnz.co.nz', matchType: 'geo', strength: 1 }],
    },
  });

  it('drops a pure-situational article whose only region is one the user has left', () => {
    const kept = dropStaleSituational(
      [situational('nz', 0.09, 'new zealand')],
      currentRegions,
      systemicIds,
    );
    expect(kept).toHaveLength(0);
  });

  it('keeps a systemic-category hit (location-independent)', () => {
    const kept = dropStaleSituational(
      [situational('quake', 0.09, 'natural-disaster')],
      currentRegions,
      systemicIds,
    );
    expect(kept).toHaveLength(1);
  });

  it('keeps a region still in the current set, a personal hit, and a geo hit', () => {
    const kept = dropStaleSituational(
      [situational('kr', 0.09, 'seoul'), scored('p', 0.2), geoArticle('g')],
      currentRegions,
      systemicIds,
    );
    expect(kept.map((a) => a.urlHash)).toEqual(['kr', 'p', 'g']);
  });
});
