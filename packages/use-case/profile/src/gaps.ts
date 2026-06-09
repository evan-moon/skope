import type { Profile, ProfileGaps } from '@skope/domain';

/** The world-headlines axis legitimately has no keywords/anchors — exempt it from gap flags. */
const EXEMPT_AXIS = 'general';

/**
 * Deterministic profile-completeness report. Drives the onboarding/refresh playbook: an interest
 * axis with no keywords means the radar is near-dead (only geo + world surface), and keywords with
 * no reachAnchors means the lens is keyword-narrow (the "repetitive brief" failure mode).
 */
export function profileGaps(profile: Profile): ProfileGaps {
  const interest = profile.axes.filter((a) => a.id !== EXEMPT_AXIS);
  return {
    needsOnboarding: interest.some((a) => a.keywords.length === 0),
    lensNarrow: interest.some((a) => a.keywords.length > 0 && (a.reachAnchors?.length ?? 0) === 0),
    perAxis: profile.axes.map((a) => ({
      id: a.id,
      keywords: a.keywords.length,
      reachAnchors: a.reachAnchors?.length ?? 0,
      federated: Boolean(a.source),
    })),
  };
}
