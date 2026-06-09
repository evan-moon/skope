import type { Profile } from '@skope/domain';
import { describe, expect, it } from 'vitest';
import { profileGaps } from './gaps.ts';

const profile = (axes: Profile['axes']): Profile => ({
  version: 'v2',
  userContext: { location: 'Seoul, Korea', languages: ['ko'] },
  axes,
});

describe('profileGaps', () => {
  it('flags needsOnboarding when an interest axis has no keywords', () => {
    const g = profileGaps(
      profile([
        { id: 'asset', label: 'Asset', weight: 0.5, keywords: [], reachAnchors: [] },
        { id: 'general', label: 'World', weight: 0.5, keywords: [], reachAnchors: [] },
      ]),
    );
    expect(g.needsOnboarding).toBe(true);
  });

  it('exempts the general axis — empty general alone is not a gap', () => {
    const g = profileGaps(
      profile([
        { id: 'asset', label: 'Asset', weight: 0.5, keywords: ['TSLA'], reachAnchors: ['Fed'] },
        { id: 'general', label: 'World', weight: 0.5, keywords: [], reachAnchors: [] },
      ]),
    );
    expect(g.needsOnboarding).toBe(false);
    expect(g.lensNarrow).toBe(false);
  });

  it('flags lensNarrow when keywords exist but reachAnchors are empty', () => {
    const g = profileGaps(
      profile([{ id: 'asset', label: 'Asset', weight: 1, keywords: ['TSLA'], reachAnchors: [] }]),
    );
    expect(g.lensNarrow).toBe(true);
  });

  it('reports per-axis counts and the federated flag from source', () => {
    const g = profileGaps(
      profile([
        {
          id: 'asset',
          label: 'Asset',
          weight: 1,
          keywords: ['TSLA', 'NVDA'],
          reachAnchors: ['Fed'],
          source: 'mcp://firma/portfolio',
        },
      ]),
    );
    expect(g.perAxis[0]).toEqual({ id: 'asset', keywords: 2, reachAnchors: 1, federated: true });
  });

  it('treats a missing reachAnchors field as zero (legacy axis)', () => {
    const g = profileGaps(
      profile([{ id: 'asset', label: 'Asset', weight: 1, keywords: ['TSLA'] }]),
    );
    expect(g.lensNarrow).toBe(true);
    expect(g.perAxis[0].reachAnchors).toBe(0);
  });
});
