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
  /** Direct anchors — the literal entities this axis is *about*, e.g. ["TSLA", "Toss", "React"]. */
  keywords: string[];
  /**
   * Causal-upstream anchors: things that *reach* this axis without naming it, e.g. for an asset axis
   * holding TSLA — ["Fed rate", "USD/KRW", "BYD", "lithium"]. The LLM expands these into search
   * queries too (broadening the lens) and the scorer matches them at the weaker 'reach' strength, so
   * a causally-reachable article enters the radar but still ranks below a direct keyword hit.
   * Optional — absent means "direct keywords only" (legacy profiles round-trip as []).
   */
  reachAnchors?: string[];
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
  /**
   * ISO 3166-1 alpha-2 of the user's *current* situation, e.g. "NZ". Optional; when present it keys
   * the situational region lattice directly instead of best-effort parsing `location`. The user can
   * be physically somewhere (current) different from their `location` home — situational scoring uses
   * this to surface "world that can affect me where I am now".
   */
  country?: string;
  /** Optional region/bloc token for the situational lattice, e.g. "APAC", "Oceania". */
  region?: string;
}

/** One curated class of world-system whose state propagates to people structurally exposed to it. */
export interface SystemicCategory {
  /** Stable id, e.g. "sanctions", "natural-disaster". The seed entity for the situational axis. */
  id: string;
  /** Rule-match keyword set. A hit means the article is about this system. */
  keywords: string[];
}

/** A region the user is exposed to, with a proximity strength: closer (city) > farther (bloc). */
export interface RegionToken {
  token: string;
  /** 0..1 proximity strength — local city ~1.0, country ~0.85, bloc ~0.7. Local news outranks far. */
  strength: number;
}

/**
 * The deterministic inputs to *situational* reachability (the broad/thin band). Built by the adapter
 * layer from UserContext (region tokens, proximity-weighted) + the static systemic-category enum,
 * then injected into scoring. skope matches these additively (a systemic shock reaches you even when
 * a personal axis also matched) — distinct from the geo *floor* which only fires when nothing matched.
 */
export interface SituationalContext {
  /** Region tokens with proximity strength, e.g. [{token:"seoul",strength:1},{token:"korea",strength:0.85}]. */
  regionTokens: RegionToken[];
  /** Curated systemic categories — the closed whitelist that keeps the broad band from a firehose. */
  systemic: SystemicCategory[];
}

export interface Profile {
  version: 'v2';
  userContext: UserContext;
  axes: Axis[];
  /** Epoch ms of the last scan; scan_news fetches incrementally after this. */
  lastScan?: number;
}

/** Per-axis completeness, so the orchestrator knows what onboarding/refresh still needs to fill. */
export interface AxisGap {
  id: string;
  keywords: number;
  reachAnchors: number;
  /** True if the axis carries a federation `source` (filled from firma/memex), not a cold-start seed. */
  federated: boolean;
}

/**
 * Deterministic completeness signal for the profile — the onboarding/refresh trigger. skope reports
 * only its own internal state (empty keyword/anchor buckets, federation provenance); it cannot know
 * whether firma/memex are connected (federation, not dependency) — that is the orchestrator's to see.
 */
export interface ProfileGaps {
  /** Any interest axis (non-'general') has zero keywords → radar is near-dead, run onboarding. */
  needsOnboarding: boolean;
  /** Any interest axis has keywords but zero reachAnchors → lens is keyword-narrow, broaden it. */
  lensNarrow: boolean;
  perAxis: AxisGap[];
}
