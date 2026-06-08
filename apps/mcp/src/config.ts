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
  'For a vague ask like "today\'s news": call show_profile, generate a query set across the axes, ' +
  'search the web yourself, call ingest_news with the results, then get_brief. Only fall back to ' +
  'scan_news (Tavily) if you have no web search of your own.';
