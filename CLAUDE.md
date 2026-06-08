# skope — Project Context

skope is a local-first personalized news intelligence tool — a **lens + watcher** on the world.
Not "the world's news" but "news that reaches *you*". It scans broadly, aligns to your situation
(Reachability), and watches you against your own echo chamber.
Target audience: developers worldwide (Hacker News / GeekNews demographic), any MCP client.
Herald ecosystem family member, alongside [firma] (assets) and [memex] (memory).

## Core philosophy

1. **Lens, not filter.** Relevance = *Reachability* (does a causal path reach you?), not "is this my
   interest?". Broadens without becoming random noise. `brazil rate hike` reaches you via
   currency exposure → relevant; `a Brazilian's daily life` has no path → excluded.
2. **Collection is active (non-deterministic), the ledger is deterministic.** The LLM (the MCP
   caller / orchestrator) decides *what* to search, synthesizes causal narrative, infers interests.
   skope owns the deterministic ledger: profile, dedup (URL hash), rule-based impact scoring,
   Effective-N concentration, the read/mute feedback log, and the *rule-match seed* of reachability.
3. **MCP-first, CLI is the safety net.** Analysis/synthesis is MCP tools. The CLI is for setup,
   manual profile editing, and read-only inspection.
4. **Federation, not dependency.** skope owns its interest profile (single source of truth). firma /
   memex are *optional adapters* — the LLM reads them and feeds skope via `update_profile`. skope
   never imports another tool; it does not break if firma dies.

## Architecture

Turborepo monorepo with Yarn Berry (`nodeLinker: node-modules`):

```
apps/
  cli/                     — @evan-moon/skope  TypeScript CLI (Commander + Clack). Safety net only.
  mcp/                     — @skope/mcp         MCP server (shares ~/.skope/skope.db with CLI)
packages/
  domain/                  — Ports (interfaces + types), no external-API dep
    domain/                — @skope/domain — Profile/Axis, Article/Tier, ImpactScore/ReachabilitySeed,
                             Brief/Concentration, SearchProvider port
  external-api/            — Raw API clients, no @skope/domain dep
    tavily/                — @skope/tavily — Tavily Search + extract client
    source-trust/          — @skope/source-trust — Tier-1 global anchors + country→Tier-2 seed data
  adapter/                 — The only layer that imports both sides
    adapters/              — @skope/adapters — SearchProvider registry (tavily + source-trust)
  use-case/                — Business logic (depends on domain only)
    profile/               — @skope/profile  — axis upsert, weight normalization (sum=1.0), 6-axis cap, cold-start
    discovery/             — @skope/discovery — scan (query budget, incremental) + score (dedup, rule impact, reachability seed)
    brief/                 — @skope/brief    — 2-layer assembly: [your radar] + [world headlines] + concentration
    watch/                 — @skope/watch    — Effective-N (Inverse Simpson) concentration watcher
  shared/                  — Cross-cutting
    db/                    — @skope/db    — Drizzle schema + repository (~/.skope/skope.db)
    utils/                 — @skope/utils — pure helpers (url hash, Effective-N math, date)
```

### Dependency direction (hexagonal — never violate)

`@skope/domain` depends on nothing. `use-case/*` depends on `domain` only — it reaches search
through the `SearchProvider` **port**, never importing `@skope/tavily` directly. `external-api/*`
has no `domain` dep. `adapter/adapters` is the only package that imports both `external-api` and
`domain`, wiring the concrete Tavily client to the port.

## MCP tools

MVP (v0.1):
- `show_profile()` — current axes, weights, user_context, last_scan
- `update_profile(axes?, user_context?)` — upsert axes, auto-normalize weights to 1.0 (federation entry point)
- `ingest_news(articles, query_context?)` — **primary, key-less collection.** The LLM searches the
  web itself and hands results here; skope canonicalizes URLs, derives the trust tier, dedups by URL
  hash, rule-scores reachability, persists. Collection is the orchestrator's job — skope is the ledger.
- `scan_news(queries, time_range?)` — **fallback, needs a Tavily key.** For clients without their own
  web search, or to enforce the whitelist + 5-call budget. Runs the same dedup/score/persist pipeline.
- `get_brief()` — assembles { radar: ScoredArticle[], world: Article[], concentration }
- `mark_read(urls)` — feedback ledger update (drops seen articles from future briefs)

Deferred (v0.2): `explain_impact` (LLM causal narrative over the stored rule seed), `mute_topic`,
`list_sources`, Effective-N-triggered `--diverge` recommendation.

### Why ingest over a built-in fetcher

skope's deterministic value (dedup, trust-tier, rule scoring, Effective-N, the ledger) is computed
*after* fetch, on the article content — so it does not matter who fetched the bytes. Letting the
orchestrating LLM collect (it already has web search) keeps skope key-less and frictionless, and is
consistent with "collection is active, the ledger is deterministic". Tavily stays as an optional
adapter (`external-api/tavily`) for clients without web search or who want enforced whitelist/budget.

## Reachability: the rule/LLM split in code

skope stores only the **ReachabilitySeed** (which axis, which entity, match type, strength) —
deterministic, computed by rule. The LLM renders the *causal chain narrative*
(`brazil rate hike → USD strength → TSLA valuation`) statelessly at brief time from that seed.
Never persist LLM-generated narrative in the ledger.
