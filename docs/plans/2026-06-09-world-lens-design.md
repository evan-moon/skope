# skope — World Lens: situational reachability + living profile

Date: 2026-06-09
Status: Design (branch `feat/world-lens`)

## Why

A world-monitor's essence is **peripheral vision** — making visible the world-systems whose
state can propagate to you. skope's thesis ("lens, not filter; relevance = Reachability") is right,
but the implementation collapsed reachability to *profile-keyword match* — the **personal/narrow**
band only. The **situational/broad** band is missing, so the brief feels narrow (a user in New
Zealand sees zero NZ news because `userContext.location` is stale "Seoul" and only the asset profile
drives collection). And the profile is treated as a one-shot static input, not a living one fed by
behavior + conversation + the MCP ecosystem.

Two requirements:
- **Narrow & deep** — news related to me (personal reachability). Exists (radar).
- **Broad & thin** — world news that can *affect* me (situational reachability). Missing.

Inputs to relevance must stop being profile-only: profile ∪ live conversation ∪ memex/firma ∪
dynamically-discovered MCP tools.

## Reachability has two altitudes; the brief keeps two layers

| concept tier | brief location | path | inputs |
|---|---|---|---|
| narrow-deep (personal) | `radar` | holdings, employer, stack | profile axes |
| broad-thin (situational) | `radar` (added) | location, region, industry, systemic | userContext + static enum |
| bubble-outside (no path) | `world` (kept) | none — shown anyway | Tier-1 slice |

`Brief` stays two-layer. Situational hits join the radar (lower impact, sink below personal hits but
clear the zero-seed drop). `world` keeps its **principled** role: deliberately-no-path stories so the
user is never sealed in. The situational band must **not cannibalize** `world`.

## A. Situational reachability (the broad/thin band)

A new **virtual `situational` axis**, parallel to the existing `geo` virtual axis, with a new honest
`matchType: 'situational'` (≈0.5, below `keyword` 0.6, like `reach`).

**Critical mechanics — additive, NOT a floor.** The `geo` seed fires only when `hits.length === 0`
(`score.ts`): a fallback. Situational seeds must be **additive** — a systemic shock (NZ quake, APAC
cable cut) must reach the user *even when a personal axis also matched*; that co-occurrence is often
the most important brief item. This is the single most important decision in the reframe.

**Seed sources (deterministic):**
1. **Geo-region lattice** — city ∈ region ∈ country ∈ economic-bloc ∈ global, strength decaying with
   distance. Static table in `external-api/source-trust` (already owns country→Tier seed data).
2. **Closed systemic-category enum** — `energy, supply-chain, sanctions, rates/FX, cyber/outage,
   natural-disaster, conflict, pandemic`. Rule-matched by category keyword sets (same `keywordMatches`
   machinery). **Closed + curated is the anti-firehose gate.**
3. **Industry adjacency** — the user's career/employer axis industry tag becomes a situational anchor.

Rule = *which* region/category/industry matched + hierarchy-decayed strength (a `ReachabilitySeed`).
LLM = *why* it matters and *whether* to surface it. Same split as the radar.

### Anti-firehose discriminator (all deterministic, in skope)

1. Closed systemic whitelist OR geo-region match = **membership gate** (primary).
2. Trust-tier damping (systemic claims lean Tier-1/2).
3. Region-proximity decay (local NZ > APAC > generic-global).
4. **Per-category Effective-N diversity cap** — reuse `@skope/watch`; no single system drowns the
   periphery. The narrow band watches *your* echo chamber; the broad band watches the *world-view's*.

The line: an article is **situationally reachable** iff a deterministic structural path (geo /
systemic-category / industry) connects it to the user's situation. It's **just world news** if the
only connection is "it's important." Relaxing the gate to "Tier-1 + recent" rebuilds the firehose and
breaks the thesis.

## B. Live userContext

- Reconcile `location` continuously from conversation + memex (orchestrator via `update_profile`),
  with a **provenance tag** (`mcp://memex` vs `conversation`) so an offhand "visiting NZ" doesn't
  permanently overwrite a memex-confirmed home.
- Add minimal structure: `{ country, region?, timezone? }` alongside the free-text `location`
  (back-compat). `region` keys the lattice; `timezone` drives "today" freshness.
- Distinguish **home** (memex-confirmed; currency/Tier-2/long-term situational) vs **current**
  (conversation-derived, transient; "where am I physically exposed now"). NZ is *current*. Both feed
  situational scoring at different strengths.

## C. Living profile (folds in from the prior onboarding thread)

- **`gaps` on show_profile**: `{needsOnboarding, lensNarrow, perAxis:[{id, keywords, reachAnchors,
  federated}]}`; `general` axis exempt. The onboarding/refresh trigger.
- **`reading_signal()`** deterministic substrate (interactions ⋈ article_impacts, 14d):
  `hotByReachAnchor` (reach-path reads → promote anchor to keyword; the loop-closing signal),
  `hotByEntity`, `hotByAxis` (with exposure denominator), `staleAxes` (low reads AND non-trivial
  exposure → downweight toward `general`), `unmatchedReads` (read ∧ articles_seen row ∧ no non-geo
  impact; INNER JOIN — pasted-URL reads invisible), `concentrationGate` (Effective-N: safeToStrengthen).
- **Guardrails (anti-runaway):** default mutation = reachAnchor→keyword **promotion**, not weight
  inflation; weight changes only when the Effective-N gate is healthy; hysteresis (N reads across M
  days); new behavioral interests default to **keywords on an existing axis**, not new axes (6-axis
  cap has only 2 free after the 4 seeds); downweight bleeds into `general` (the renormalization
  buffer), not into hot axes; `source`-tagged (federated) axes resist behavioral drift.

## D. Collection playbook (orchestrator/instructions — skope imports nothing)

For a brief: gather inputs beyond the profile — live conversation, memex (`search_notes`,
inferences, location), firma (portfolio), and **MCP-ecosystem discovery**. Generate BOTH narrow
(personal axis keywords + reachAnchors) AND broad (region + systemic-category + industry) queries.
Then ingest → get_brief.

**MCP-ecosystem discovery constraints (playbook, not skope code):**
- **Read-only verbs only** — auto-invoke `get_/show_/search_/list_*`; never `write_/save_/project_/
  execute_*` for enrichment.
- **Confirm before first use** of a newly discovered tool; cache the classification after.
- **Provenance tag** ingested context with its `source` (`mcp://...`).
- **Gap-triggered** — probe only when `gaps`/`reading_signal` indicates a missing input, not every
  brief.

**Bidirectional memex write-back:** emerging interests detected by `reading_signal` are written to
memex (`mint_inference`/`save_note`) **with a `derived-from: skope` provenance tag**, and the refresh
path **excludes skope-originated inferences** when re-seeding — else memex becomes an echo amplifier.

## Implementation slices (build order)

1. **Situational axis (fixes "no NZ news")** — `situational` matchType + additive scoring in
   `score.ts`; region lattice + systemic enum in `source-trust`; structured `UserContext`
   (`country/region`); per-category diversity cap in brief assembly. *Directly delivers broad/thin.*
2. **Living-profile substrate** — `gaps` field + `reading_signal()` + guardrails.
3. **Playbook instructions** — collection (narrow+broad), MCP discovery constraints, memex write-back
   provenance, live-location reconcile.

CLI `init` stays a minimal skeleton (safety net) + a hint to run onboarding via the MCP client.

## Philosophy guards (must hold)

- Ledger deterministic (impacts/seeds/Effective-N reproducible from inputs); brief = ledger + clock.
- Reachability ≠ interest — situational adds *ambient/structural* causal paths, not topical match.
- Federation, not dependency — skope owns profile + situational scoring; works standalone.
- Collection active, ledger deterministic — discovery/memex/conversation are orchestrator-side.
- Keep `world` as the true bubble-outside; situational must not eat it.
