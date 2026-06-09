/**
 * The "living profile" behavioral substrate: deterministic patterns in what the user actually READ
 * (interactions ⋈ article_impacts) over a window. skope emits only the rule-derived facts +
 * Effective-N-gated recommendations; the orchestrator names topics, judges genuine-vs-transient, and
 * decides whether to mutate the profile (auto-apply) and write the inference back to memex.
 */

export interface HotEntity {
  /** The matched seed entity (a profile keyword or reachAnchor), e.g. "스테이블코인". */
  entity: string;
  axisId: string;
  /** Distinct read articles that hit this entity in the window. */
  reads: number;
  /** Distinct days those reads span — hysteresis against a single-day spike. */
  days: number;
  /** Rule recommendation when thresholds clear (e.g. "promote_to_keyword"); else omitted. */
  recommend?: string;
}

export interface HotAxis {
  axisId: string;
  reads: number;
  /** Share of cumulative impact in the window — the denominator so a starved axis isn't "hot". */
  exposure: number;
}

export interface StaleAxis {
  axisId: string;
  reads: number;
  exposure: number;
  recommend: string;
}

/** A read article with NO interest-axis path (only geo/situational, or none) — a new-interest candidate. */
export interface UnmatchedRead {
  urlHash: string;
  title: string;
  source: string;
}

/** The runaway-loop brake: only strengthen a hot axis when attention isn't already over-concentrated. */
export interface ConcentrationGate {
  effectiveN: number;
  safeToStrengthen: boolean;
}

export interface ReadingSignal {
  windowDays: number;
  /** Reads that entered via a 'reach' anchor — the strongest signal an anchor deserves promotion. */
  hotByReachAnchor: HotEntity[];
  hotByEntity: HotEntity[];
  hotByAxis: HotAxis[];
  staleAxes: StaleAxis[];
  unmatchedReads: UnmatchedRead[];
  concentrationGate: ConcentrationGate;
}
