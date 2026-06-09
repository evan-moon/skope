# skope — Brief Rendering Style

How the orchestrator should render `get_brief` output into prose. The *operative* version lives in
the `get_brief` tool description (that's what an MCP client reads at runtime); this doc is the
reasoning behind it.

Adapted from a structural analysis of the "카레라 / 미국주식 사관학교" US-equity essays
(`~/dev/drafts/미국주식/CARRERA-STYLE-SPEC.md`). We borrow the **structure and logic**, not the
Korean voice. Their domain is investment judgment; ours is *news reachability* — so we keep the
rigor and drop the portfolio-centricity.

## The one line

> Reduce the day to a single upstream driver, trace its mechanism to the user via the reachability
> seeds, set it against the conventional read, balance it with the counter-current, and close on the
> one variable that decides it — with a view, not a hedge.

Not information delivery. **A frame for judgment.**

## Hard rule: skope-standalone

The report is built **entirely from skope's own data** — each item's `impact.seeds`, the two bands
(radar + world), the Effective-N meter. It must be complete and valuable with **no other tool
connected**. firma/memex enrichment is an *optional bonus*, never a structural requirement
(federation, not dependency). Numbers come from the news items themselves; the only metric skope
always owns is its news Effective-N.

## The arc (per thesis)

Carried from the carrera 8-step template; the three starred steps are non-negotiable.

1. **Throughline first (P1 — reduction).** Find the one upstream force linking the day's items across
   axes. The lede states it. Everything below is a movement of that story.
2. **★ Conventional read → crack (P2 — counterintuitive hook).** Set up what the headline/market
   assumes, then break it with the anomaly. Tension before resolution.
3. **★ Mechanism as a causal waterfall (P4).** Trace one cause through its transmissions, `→ → →`,
   *using the seeds* (keyword = direct, reach = causal-upstream, situational = region/systemic). The
   seeds already encode the money-flow; render it, don't invent it.
4. **Precedent anchor.** Where it sharpens: "resembles X, but the decisive difference is Y."
5. **Single variable (P1/⑥).** Converge on the one thing that decides the thesis.
6. **★ Balance (⑦).** The counter-current / what would break it. Never one-sided.
7. **Concrete judgment (⑧).** Close with a call, not "let's watch." Land hard ideas with an everyday
   analogy. Anchor each claim in a number from the items.

After the theses: **Macro/Situational** (the broad/thin band), a **Concentration** read (news
Effective-N — is the lens widening or narrowing onto one axis? the diversification-illusion check),
and a dated **Catalysts** line drawn from the items.

## Voice: explanatory, not telegraphic

The arc above is **invisible scaffolding** — never print its steps as labels ("통념 / 메커니즘 / 판정").
Write flowing prose a reader can follow with **zero prior context**: one idea per sentence, define
each piece of jargon the instant it appears (supercore, dot plot, index inclusion…), and land it with
an everyday analogy. Explain the mechanism like a smart friend talking through it, not a filled
template. The carrera essays read clearly *because* they walk each step ("refrigerated diesel trucks
move fresh food, so fuel prices hit groceries directly"). **Depth should make the piece CLEARER as it
goes, not denser.** Compression that assumes context is the cardinal sin (high cognitive load).

## Failure modes (anti-patterns)

- Telegraphic labeled shorthand / fragments crammed under step labels (the cardinal sin — unreadable).
- Undefined jargon; mechanism leaps the reader can't follow without prior context.
- Dry headline recitation with no connective tissue (no throughline).
- Disconnected buckets — each item analyzed alone (violates P1/P4).
- One-sided thesis — no counter-current (skips ⑦).
- Ending on "depends / let's watch" instead of a single variable + judgment.
- Hedge-spam ("not advice" repeated). One epistemic footer is enough: skope surfaces rule-derived
  reachability, not investment advice.
- Requiring firma/memex to be complete (dependency violation).
- Bare numbers with no comparison/meaning, or claims with no number.

## Footer

One line: *skope surfaces rule-derived Reachability (causal paths to you), not investment advice.*
