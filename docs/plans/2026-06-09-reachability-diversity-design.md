# skope — Reachability Diversity (exposure map + brief freshness)

Date: 2026-06-09
Status: Implemented on `feat/reachability-diversity`

## Problem

Briefs feel repetitive — the radar keeps surfacing only the literal profile keywords
(`TSLA`, `Toss`, `React`). Two independent root causes, both in code, not data:

1. **Topical breadth.** `discovery/score.ts` `seedsForAxis` emits a seed *only* when an article
   literally contains an axis keyword, and `scoreBatch` drops any zero-seed article. A causally
   reachable story ("Fed rate hike", no "Tesla" in the text) gets 0 seeds → dropped from the radar,
   surviving only as a Tier-1 "world headline". The `MatchType` union defined `entity`/`sector`
   strengths that nothing ever emitted — the lens had collapsed to a 6-string keyword filter,
   contradicting the "lens, not filter / Reachability" philosophy.
2. **Temporal novelty.** Once shown, the same top articles re-serve on every brief for ~24h. Only an
   explicit `mark_read` drops them. "Show me something new next time" was unsupported.

## Design

### Axis 1 — exposure map (topical breadth)

Add a second anchor bucket to each axis: **`reachAnchors: string[]`** — causal-upstream entities that
*reach* the axis without naming it (asset/TSLA → `Fed rate`, `USD/KRW`, `BYD`, `lithium`).

- `domain/profile.ts`: `Axis.reachAnchors?: string[]` (optional; legacy profiles round-trip as `[]`).
- `domain/impact.ts`: new `MatchType` member `'reach'`.
- `discovery/score.ts`: `STRENGTH.reach = 0.5`; `seedsForAxis` second pass emits a `'reach'` seed for
  each anchor hit. Direct `keyword` stays at 0.6, so `Math.max` best-strength keeps direct hits on
  top. A reach hit is a *real* hit, so `scoreBatch` no longer drops the causally-reachable article.
- DB: `profile_axes.reach_anchors TEXT NOT NULL DEFAULT '[]'` (+ idempotent `ALTER TABLE` migration).
- MCP: `axisSchema.reachAnchors`; `ingest`/`scan` topics flatten anchors too; `ingest_news` /
  `SERVER_INSTRUCTIONS` tell the orchestrator to expand queries across **keywords AND reachAnchors**.

Decision: a separate `string[]` field, **not** promoting `keywords` to `{term, kind}[]` (would break
the `update_profile` contract + federation `string[]` adapters for expressiveness not yet needed), and
**not** ephemeral per-scan anchors (non-reproducible, can't be federated — violates "deterministic
ledger" and "federation, not dependency"). A new honest `'reach'` matchType (not overloading
`'sector'`) so the seed doesn't lie to the LLM rendering the causal narrative.

### Axis 2 — brief freshness (temporal novelty)

Append a **last-shown** log and apply a **read-time decay**, never touching the ledger.

- DB: `brief_appearances(url_hash PK, shown_at)`.
- `repo.recordAppearances(hashes)` / `repo.lastShownMap()`.
- `brief/assemble.ts`: `freshnessDecay(ageMs)` ∈ `[0.3, 1]` — just-shown → 0.3, linear recovery to
  1.0 over ~3 days, never-shown → 1.0. Radar is re-ranked by `impact.total × freshnessDecay` *before*
  slicing → shown items sink, new ones rise. **Demote, never exclude** (a thin radar never empties).
- `get_brief`: read `lastShownMap()` → assemble → `recordAppearances(brief.radar)`. Read-before-write,
  so a render never penalizes itself, only the next one.

Hard line held: `article_impacts.score` / Effective-N are untouched — the **ledger is reproducible
from inputs alone; the brief is a reproducible function of the ledger + the clock**. `shown` (we
displayed it) stays distinct from `read` (`interactions`), so the feedback ledger isn't corrupted.

## Tests

`discovery/src/score.test.ts`, `brief/src/assemble.test.ts` (first tests in the repo):
reach seed emitted at 0.5; reach-only article enters radar; direct keyword outranks reach; no-match
still dropped; missing `reachAnchors` = direct-only; decay boundaries; shown article demoted below an
equal fresh one but not dropped; strong shown story still beats a much weaker fresh one.

## Follow-ups (not built — YAGNI)

- World layer rotation (decay currently radar-only).
- Per-axis anchor suggestions surfaced proactively when `reachAnchors` is empty.
