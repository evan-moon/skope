import type { Concentration } from '@skope/domain';
import { effectiveN } from '@skope/utils';

/** Below this Effective-N (on the default 4-axis seed), attention is judged over-concentrated. */
export const DEFAULT_THRESHOLD = 1.8;

/** Per-axis cumulative impact over the rolling window (typically last 14 days). */
export interface AxisImpactTotals {
  axisId: string;
  /** Sum of impact scores attributed to this axis in the window. */
  total: number;
}

/**
 * Compute the attention-concentration meter. Mirrors firma's portfolio Effective-N: the user's
 * attention is "as diversified as N independent axes". Falling below threshold raises a warning,
 * which the orchestrator can act on (e.g. recommend `--diverge`).
 */
export function concentration(
  totals: AxisImpactTotals[],
  threshold: number = DEFAULT_THRESHOLD,
): Concentration {
  const grand = totals.reduce((a, t) => a + t.total, 0);
  const distribution = totals.map((t) => ({
    axisId: t.axisId,
    share: grand === 0 ? 0 : t.total / grand,
  }));
  const n = effectiveN(distribution.map((d) => d.share));

  const dominant = [...distribution].sort((a, b) => b.share - a.share)[0];
  const pct = dominant ? Math.round(dominant.share * 100) : 0;
  const warning =
    n > 0 && n < threshold && dominant
      ? dominant.axisId === 'geo'
        ? `Local echo chamber: effective N=${n.toFixed(2)} (< ${threshold}). ${pct}% of what reached ` +
          'you is just local news, not your interests. Consider widening.'
        : `Attention is concentrating: effective N=${n.toFixed(2)} (< ${threshold}). ` +
          `${pct}% sits on the "${dominant.axisId}" axis. Consider diverging.`
      : undefined;

  return { effectiveN: n, distribution, warning };
}
