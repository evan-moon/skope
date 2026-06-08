import type { Axis } from '@skope/domain';
import { MAX_AXES } from '@skope/domain';
import { normalizeWeights } from '@skope/utils';

/** Raised when a profile mutation would exceed the axis hard cap. */
export class TooManyAxesError extends Error {
  constructor(count: number) {
    super(
      `Profile exceeds the ${MAX_AXES}-axis cap (got ${count}). Remove or merge an axis first.`,
    );
    this.name = 'TooManyAxesError';
  }
}

/**
 * Enforce the axis cap and re-normalize weights to sum to 1.0, preserving relative ratios.
 * Adding an axis "borrows" proportionally from the existing axes — exactly Gemini's redistribution
 * rule (keep existing ratios, renormalize total to 1.0).
 */
export function normalizeAxes(axes: Axis[]): Axis[] {
  if (axes.length > MAX_AXES) {
    throw new TooManyAxesError(axes.length);
  }
  const weights = normalizeWeights(axes.map((a) => a.weight));
  return axes.map((a, i) => ({ ...a, weight: weights[i] }));
}
