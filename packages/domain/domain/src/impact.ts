/**
 * How an article's mention connects to an axis. Deterministic, rule-computed.
 * - keyword: a profile keyword appears (e.g. "TSLA")
 * - entity : a resolved named entity matches (ticker, employer, person)
 * - geo    : the user's location/country is the subject
 * - sector : same sector/industry as a held entity
 */
export type MatchType = 'keyword' | 'entity' | 'geo' | 'sector';

/**
 * The deterministic kernel of Reachability. skope stores ONLY this seed — the LLM renders the
 * causal-chain narrative (e.g. "brazil rate hike → USD strength → TSLA") statelessly at brief time.
 * Never persist LLM narrative in the ledger.
 */
export interface ReachabilitySeed {
  axisId: string;
  /** The concrete thing matched, e.g. "TSLA", "KRW", "Seoul". */
  entity: string;
  matchType: MatchType;
  /** 0..1 rule-assigned match strength. */
  strength: number;
}

export interface AxisHit {
  axisId: string;
  /** Weighted contribution of this axis to the article's total score. */
  contribution: number;
}

export interface ImpactScore {
  /** 0..1 aggregate, rule-derived (the LLM may re-rank the top slice, but this is the floor). */
  total: number;
  hits: AxisHit[];
  /** Seeds the LLM expands into a why-explanation. Empty for pure "world headline" passthrough. */
  seeds: ReachabilitySeed[];
}
