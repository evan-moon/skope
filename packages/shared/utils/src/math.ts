/**
 * Normalize a list of weights so they sum to 1.0, preserving relative ratios.
 * When every weight is 0 (or the list is empty), falls back to a uniform distribution.
 */
export function normalizeWeights(weights: number[]): number[] {
  const safe = weights.map((w) => (w > 0 ? w : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total === 0) {
    if (safe.length === 0) {
      return [];
    }
    return safe.map(() => 1 / safe.length);
  }
  return safe.map((w) => w / total);
}

/**
 * Effective number of axes via the Inverse Simpson index: 1 / Σ(p_i²).
 * shares must already be a probability distribution (sum ≈ 1). Returns 1 for a single-axis pile-up,
 * and approaches axisCount when attention is perfectly spread.
 */
export function effectiveN(shares: number[]): number {
  const sumSq = shares.reduce((acc, p) => acc + p * p, 0);
  if (sumSq === 0) {
    return 0;
  }
  return 1 / sumSq;
}
