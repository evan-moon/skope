/**
 * How an article's mention connects to an axis. Deterministic, rule-computed.
 * - keyword    : a direct profile keyword appears (e.g. "TSLA")
 * - reach      : a causal-upstream anchor of an axis appears (e.g. "Fed", "USD/KRW") — no direct
 *                mention, but a path reaches the user. Scored below keyword so direct hits win.
 * - situational: a broad/thin ambient path — the user's region or a systemic category (energy,
 *                sanctions, natural-disaster…) the user is structurally exposed to. "World that can
 *                affect me." Additive (co-occurs with personal hits), low weight.
 * - entity     : a resolved named entity matches (ticker, employer, person)
 * - geo        : the user's location/country is the subject (resident passthrough floor)
 * - sector     : same sector/industry as a held entity
 */
export type MatchType = 'keyword' | 'reach' | 'situational' | 'entity' | 'geo' | 'sector';

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
