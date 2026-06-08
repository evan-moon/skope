# skope

> Scope out the world — news that reaches *you*, not the world's noise.

skope is a local-first, AI-native **personalized news intelligence** tool. It's a lens + watcher:
it scans broadly, keeps only what has a causal path to your life (**Reachability**), and warns you
when your attention is collapsing into an echo chamber.

Part of the **Herald** ecosystem alongside [firma](https://github.com/evan-moon/firma) (assets) and
[memex](https://github.com/evan-moon/memex) (memory). Works in any MCP client — Claude Desktop,
Claude Code, Cursor.

## Why

Today you hunt the news yourself. skope flips it: the LLM actively searches what affects your
interests and assets, pulls the insight, and hands you a morning brief — broad enough to break your
bubble, narrow enough to skip a stranger's daily life on the other side of the planet.

- **Lens, not filter** — relevance is *Reachability* (a causal path to you), not keyword matching.
- **Watcher** — an Effective-N concentration meter flags when your attention over-concentrates.
- **Local-first** — your profile and reading ledger live in `~/.skope/skope.db`. Nothing leaves your machine except search queries.
- **Federation** — optionally bootstrap your profile from firma/memex; skope never depends on them.

## Status

v0.1 scaffold. See [CLAUDE.md](./CLAUDE.md) for architecture.

## License

MIT © Evan Moon
