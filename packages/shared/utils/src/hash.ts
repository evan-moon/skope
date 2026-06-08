import { createHash } from 'node:crypto';

/**
 * Canonicalize a URL so trivially different links dedup to the same key:
 * drop the hash fragment, strip common tracking params, lowercase the host, drop a trailing slash.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.host = u.host.toLowerCase();
    const tracking = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
    ];
    for (const p of tracking) {
      u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith('/')) {
      s = s.slice(0, -1);
    }
    return s;
  } catch {
    return raw.trim();
  }
}

/** Deterministic dedup key for an article. */
export function urlHash(raw: string): string {
  return createHash('sha256').update(canonicalizeUrl(raw)).digest('hex').slice(0, 16);
}

/**
 * Secondary, content-based dedup key = hash(normalized source + normalized title). Catches the same
 * story re-arriving under URL parameter variants (?ref=…) or light syndication, which url canonicalization
 * can't. Returns null for short titles (< 20 chars) — generic heads like "Markets wrap" collide too
 * easily, so those fall back to url-hash only.
 */
export function contentKey(source: string, title: string): string | null {
  const t = title.toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.length < 20) {
    return null;
  }
  const s = source.toLowerCase().replace(/^(www|api|m|amp)\./, '');
  return createHash('sha256').update(`${s}\n${t}`).digest('hex').slice(0, 16);
}
