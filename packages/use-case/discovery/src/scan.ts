import type { Article, Axis, SearchProvider, SearchQuery } from '@skope/domain';

/** Hard cap on search calls per brief — the deterministic cost ceiling (Gemini's Quota Budgeting). */
export const MAX_QUERIES_PER_SCAN = 5;

/**
 * Deterministically allocate the call budget across axes by weight (largest-remainder rounding).
 * The LLM decides query *text*; this rule decides *how many slots* each axis gets, so a data-rich
 * axis (money) can't silently monopolize the brief.
 */
export function allocateBudget(
  axes: Axis[],
  budget: number = MAX_QUERIES_PER_SCAN,
): Map<string, number> {
  const alloc = new Map<string, number>();
  if (axes.length === 0 || budget <= 0) {
    return alloc;
  }
  const raw = axes.map((a) => ({ id: a.id, exact: a.weight * budget }));
  let used = 0;
  for (const r of raw) {
    const floor = Math.floor(r.exact);
    alloc.set(r.id, floor);
    used += floor;
  }
  // Distribute the remainder to the largest fractional parts.
  const remainder = budget - used;
  const byFraction = [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1));
  for (let i = 0; i < remainder; i++) {
    const id = byFraction[i % byFraction.length].id;
    alloc.set(id, (alloc.get(id) ?? 0) + 1);
  }
  return alloc;
}

/**
 * Run a scan: enforce the call cap, then fetch via the SearchProvider port. The provider (wired in
 * adapter) injects the trusted-domain whitelist and tier-tags results. Incremental window is passed
 * through as timeRange. Returns raw deduped articles; impact scoring happens in score.ts.
 */
export async function scan(provider: SearchProvider, queries: SearchQuery[]): Promise<Article[]> {
  const capped = queries.slice(0, MAX_QUERIES_PER_SCAN);
  return provider.search(capped);
}
