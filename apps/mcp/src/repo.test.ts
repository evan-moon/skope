import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, schema } from '@skope/db';
import type { Profile, ScoredArticle } from '@skope/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Repo } from './repo.ts';

let repo: Repo;
let db: ReturnType<typeof openDb>;
let dbPath: string;

const PROFILE: Profile = {
  version: 'v2',
  userContext: { location: 'Seoul, Korea', languages: ['ko'] },
  axes: [
    { id: 'asset', label: 'Asset', weight: 0.5, keywords: ['TSLA'], reachAnchors: [] },
    { id: 'career', label: 'Career', weight: 0.4, keywords: ['Toss'], reachAnchors: ['금융위'] },
    { id: 'general', label: 'World', weight: 0.1, keywords: [], reachAnchors: [] },
  ],
};

const scored = (
  urlHash: string,
  axisId: string,
  entity: string,
  matchType: ScoredArticle['impact']['seeds'][number]['matchType'],
  strength: number,
  contribution: number,
): ScoredArticle => ({
  urlHash,
  url: `https://example.com/${urlHash}`,
  title: urlHash,
  source: 'reuters.com',
  tier: 1,
  impact: {
    total: contribution,
    hits: [{ axisId, contribution }],
    seeds: [{ axisId, entity, matchType, strength }],
  },
});

beforeEach(() => {
  dbPath = join(tmpdir(), `skope-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  db = openDb(dbPath);
  repo = new Repo(db);
  repo.saveProfile(PROFILE);
  const articles: ScoredArticle[] = [
    scored('tsla1', 'asset', 'TSLA', 'keyword', 0.6, 0.3),
    scored('fsc1', 'career', '금융위', 'reach', 0.5, 0.2),
    scored('fsc2', 'career', '금융위', 'reach', 0.5, 0.2),
    scored('quake1', 'situational', 'natural-disaster', 'situational', 1, 0.09),
  ];
  repo.recordArticles(articles);
  repo.recordScored(articles);
});

afterEach(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${dbPath}${suffix}`;
    if (existsSync(p)) {
      rmSync(p);
    }
  }
});

describe('repo.readingSignal', () => {
  it('reports no stale axes and empty hot lists when nothing has been read', () => {
    const s = repo.readingSignal();
    expect(s.hotByEntity).toHaveLength(0);
    expect(s.hotByReachAnchor).toHaveLength(0);
    expect(s.staleAxes).toHaveLength(0); // the zero-reads guard
    expect(typeof s.concentrationGate.effectiveN).toBe('number');
  });

  it('surfaces hot reach anchors, unmatched reads, and stale (unread-but-exposed) axes', () => {
    repo.markRead(['fsc1', 'fsc2', 'quake1']);
    const s = repo.readingSignal();

    const fsc = s.hotByReachAnchor.find((h) => h.entity === '금융위');
    expect(fsc).toMatchObject({ axisId: 'career', reads: 2 });
    expect(fsc?.recommend).toBeUndefined(); // same-day reads → days 1 < threshold, no promotion

    expect(s.unmatchedReads.map((u) => u.urlHash)).toContain('quake1'); // situational-only read
    expect(s.staleAxes.map((a) => a.axisId)).toContain('asset'); // exposed but never read
    expect(s.staleAxes.map((a) => a.axisId)).not.toContain('career'); // career was read
  });

  it('recommends promotion only once a reach anchor is read enough across enough days', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    // three 금융위 reads spanning two distinct days clears the hysteresis threshold
    repo.recordArticles([scored('fsc3', 'career', '금융위', 'reach', 0.5, 0.2)]);
    repo.recordScored([scored('fsc3', 'career', '금융위', 'reach', 0.5, 0.2)]);
    db.insert(schema.interactions)
      .values([
        { urlHash: 'fsc1', action: 'read', timestamp: new Date(now - 2 * day) },
        { urlHash: 'fsc2', action: 'read', timestamp: new Date(now - 2 * day) },
        { urlHash: 'fsc3', action: 'read', timestamp: new Date(now) },
      ])
      .run();
    const s = repo.readingSignal();
    const fsc = s.hotByReachAnchor.find((h) => h.entity === '금융위');
    expect(fsc).toMatchObject({ reads: 3, days: 2, recommend: 'promote_to_keyword' });
  });
});
