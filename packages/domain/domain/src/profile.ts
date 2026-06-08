/**
 * The interest profile is skope's single source of truth (federation, not dependency).
 * Other tools (firma, memex) are optional adapters that the LLM reads and feeds in via
 * update_profile — skope itself never imports them.
 */

/** Hard cap on axes. Beyond this, attention over-diffuses and insight quality drops (see watch). */
export const MAX_AXES = 6;

/**
 * One dimension of a person's life that news can reach. Default seed is asset/currency/career/
 * knowledge, but the schema is user-defined — an artist or freelancer redefines the axes entirely.
 */
export interface Axis {
  /** Stable identifier, e.g. "asset", "career", "hobby". */
  id: string;
  /** Human label shown in briefs, e.g. "Asset exposure". */
  label: string;
  /** Relative importance. Across all axes, weights are normalized to sum to 1.0. */
  weight: number;
  /** Free-text anchors the LLM expands into search queries, e.g. ["TSLA", "Toss", "React"]. */
  keywords: string[];
  /**
   * Optional federation source the profile was bootstrapped from, e.g. "mcp://firma/portfolio".
   * Informational only — skope does not call it. Present means "an LLM filled this from elsewhere".
   */
  source?: string;
}

/** Where and how the user lives — drives geographic Reachability and Tier-2 source selection. */
export interface UserContext {
  /** e.g. "Seoul, Korea". Drives local-news passthrough and currency inference. */
  location: string;
  /** BCP-47-ish language preferences, most-preferred first, e.g. ["ko", "en"]. */
  languages: string[];
}

export interface Profile {
  version: 'v2';
  userContext: UserContext;
  axes: Axis[];
  /** Epoch ms of the last scan; scan_news fetches incrementally after this. */
  lastScan?: number;
}
