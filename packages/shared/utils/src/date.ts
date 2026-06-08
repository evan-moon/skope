/** Epoch ms for "n days ago", used for the Effective-N rolling window and incremental scans. */
export function daysAgo(n: number, now: number = Date.now()): number {
  return now - n * 24 * 60 * 60 * 1000;
}
