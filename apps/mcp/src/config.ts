import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface SkopeConfig {
  tavily_api_key?: string;
}

function configPath(): string {
  return join(homedir(), '.skope', 'config.json');
}

function readConfig(): SkopeConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SkopeConfig;
  } catch {
    return {};
  }
}

/** Tavily key: env var wins, then ~/.skope/config.json. Undefined → scan_news reports setup needed. */
export function getTavilyKey(): string | undefined {
  return process.env.SKOPE_TAVILY_API_KEY ?? readConfig().tavily_api_key;
}

export const SKOPE_VERSION = '0.1.0';

export const SERVER_INSTRUCTIONS =
  'skope is a personalized news lens. It keeps only what has a causal path to the user ' +
  '(Reachability) and watches for attention over-concentration. You are the orchestrator and the ' +
  'collector: YOU search the web with your own tools, then hand results to skope, which owns the ' +
  'deterministic ledger only (dedup, trust-tier, rule scoring, Effective-N). You also render the ' +
  'causal-chain narrative from the rule-match seeds skope returns and synthesize the brief prose. ' +
  'For a vague ask like "today\'s news": call show_profile, then generate a query set that expands ' +
  "BOTH each axis's keywords (the literal entities) AND its reachAnchors (causal-upstream topics " +
  'that reach the user without naming the entity — e.g. "Fed rate", "USD/KRW" for a TSLA holder). ' +
  'Searching only the literal keywords is what makes briefs feel repetitive; the anchors are the ' +
  'lens. Deliver TWO bands every time: (1) NARROW & DEEP — news related to the user (the profile ' +
  'axes above); (2) BROAD & THIN — "world that can affect me": the user\'s region/country and global ' +
  'systemic shocks (energy, supply-chain, sanctions, rates/FX, cyber/outage, natural-disaster, ' +
  'conflict, pandemic). Generate broad queries for those too — skope scores them on a situational ' +
  'axis and surfaces them additively. Do not rely on the stored profile alone: also draw on the live ' +
  "conversation, memex (the user's location, life situation, projects), and firma (portfolio), and " +
  'enumerate the connected MCP tools — if a read-only tool (get_/show_/search_/list_) plausibly ' +
  'carries situational signal, use it (confirm before first use of an unfamiliar one). Keep ' +
  'userContext.location fresh from conversation/memex via update_profile — the current location can ' +
  'differ from home, and a stale one hides the news that matters where the user actually is. ' +
  'Search the web yourself, call ingest_news, then get_brief (its radar auto-rotates already-shown ' +
  'items down). Only fall back to scan_news (Tavily) if you have no web search of your own. If a ' +
  'profile has empty reachAnchors, infer a few per axis and offer to save them via update_profile.';
