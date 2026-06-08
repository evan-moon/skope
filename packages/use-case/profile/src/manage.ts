import type { Axis, Profile, UserContext } from '@skope/domain';
import { normalizeAxes } from './normalize.ts';

/** The default seed axes — a *starting point*, fully overridable. Not a fixed truth about anyone. */
export function seedAxes(): Axis[] {
  return normalizeAxes([
    { id: 'asset', label: 'Asset exposure', weight: 0.4, keywords: [] },
    { id: 'career', label: 'Career', weight: 0.3, keywords: [] },
    { id: 'knowledge', label: 'Knowledge & identity', weight: 0.2, keywords: [] },
    { id: 'general', label: 'World headlines', weight: 0.1, keywords: [] },
  ]);
}

/**
 * Cold-start profile: works with zero MCP integrations. The user (or the LLM, from a short
 * conversation) supplies location + keywords; no firma/memex required.
 */
export function coldStart(
  userContext: UserContext,
  keywordsByAxis: Record<string, string[]> = {},
): Profile {
  const axes = seedAxes().map((a) => ({ ...a, keywords: keywordsByAxis[a.id] ?? [] }));
  return { version: 'v2', userContext, axes };
}

/** Insert or update an axis by id, then renormalize. Pure — returns a new axis list. */
export function upsertAxis(axes: Axis[], next: Axis): Axis[] {
  const idx = axes.findIndex((a) => a.id === next.id);
  const merged = idx === -1 ? [...axes, next] : axes.map((a) => (a.id === next.id ? next : a));
  return normalizeAxes(merged);
}

/** Remove an axis by id, then renormalize the remainder. */
export function removeAxis(axes: Axis[], id: string): Axis[] {
  return normalizeAxes(axes.filter((a) => a.id !== id));
}
