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
/** Proximity strengths by hierarchy level — local news outranks far-region news. */
const REGION_LOCAL = 1.0;
const REGION_COUNTRY = 0.85;
const REGION_BLOC = 0.7;

export function buildSituationalContext(
  userContext: UserContext,
  currentLocation?: string,
): SituationalContext {
  // token -> best (highest) proximity strength seen for it
  const tokens = new Map<string, number>();
  const add = (raw: string, strength: number) => {
    const t = raw.trim().toLowerCase();
    if (t.length > 0) {
      tokens.set(t, Math.max(tokens.get(t) ?? 0, strength));
    }
  };
  // A free-text location is "City, Country": the first part is local (closest), the rest country.
  const addLocation = (loc: string) => {
    const parts = loc
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    parts.forEach((p, i) => {
      add(p, i === 0 ? REGION_LOCAL : REGION_COUNTRY);
    });
  };
  addLocation(userContext.location);
  if (userContext.region) {
    add(userContext.region, REGION_BLOC);
  }
  if (currentLocation) {
    addLocation(currentLocation);
  }
  return {
    regionTokens: [...tokens].map(([token, strength]) => ({ token, strength })),
    systemic: SYSTEMIC_CATEGORIES.map((c) => ({ id: c.id, keywords: [...c.keywords] })),
  };
}
