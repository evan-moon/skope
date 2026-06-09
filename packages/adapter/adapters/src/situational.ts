import type { SituationalContext, UserContext } from '@skope/domain';
import { SYSTEMIC_CATEGORIES } from '@skope/source-trust';

/**
 * Wire the deterministic situational-reachability inputs for scoring. This is the adapter seam: the
 * use-case (discovery) never imports external-api, so the static systemic enum (source-trust) and the
 * user's region tokens are assembled here and injected into `scoreArticle`.
 *
 * Region tokens come from the free-text `location` (comma-split) plus the optional `region` bloc; the
 * systemic categories are the closed curated whitelist. The LLM keeps `location`/`country` fresh from
 * conversation/memex via update_profile — this function just turns the current state into match data.
 *
 * `currentLocation` is the transient travel case: the profile keeps the DURABLE home location, and the
 * orchestrator passes where the user physically is right now (from conversation/memex) per collection,
 * unioned into the region tokens. No home/current split in the profile — current location is live
 * context (the orchestrator's job), not a durable ledger fact.
 */
export function buildSituationalContext(
  userContext: UserContext,
  currentLocation?: string,
): SituationalContext {
  const tokens = new Set<string>();
  const addLocation = (loc: string) => {
    for (const part of loc.split(',')) {
      const t = part.trim().toLowerCase();
      if (t.length > 0) {
        tokens.add(t);
      }
    }
  };
  addLocation(userContext.location);
  if (userContext.region) {
    tokens.add(userContext.region.trim().toLowerCase());
  }
  if (currentLocation) {
    addLocation(currentLocation);
  }
  return {
    regionTokens: [...tokens],
    systemic: SYSTEMIC_CATEGORIES.map((c) => ({ id: c.id, keywords: [...c.keywords] })),
  };
}
