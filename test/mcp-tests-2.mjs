// Round-2 MCP test harness — 10 NEW scenarios probing surface the first 15 didn't cover:
// limits, geo reachability, tier-aware ranking, snippet matching, and input edge cases.
// Run from skope repo root: `node mcp-tests-2.mjs`
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

let n = 0;
async function withServer(fn) {
  const dbPath = join(tmpdir(), `skope-test2-${process.pid}-${n++}.db`);
  for (const s of ['', '-wal', '-shm']) rmSync(dbPath + s, { force: true });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['apps/mcp/dist/index.js'],
    env: { ...process.env, SKOPE_DB_PATH: dbPath, SKOPE_TAVILY_API_KEY: '' },
  });
  const client = new Client({ name: 'mcp-tests-2', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const res = await client.callTool({ name, arguments: args });
    let parsed;
    try {
      parsed = JSON.parse(res.content[0].text);
    } catch {
      parsed = { error: res.content[0].text };
    }
    return { parsed, isError: res.isError === true };
  };
  try {
    return await fn({ call, dbPath });
  } finally {
    await client.close();
  }
}

const A = (id, label, weight, keywords) => ({ id, label, weight, keywords });
const seoul = { location: 'Seoul, Korea', languages: ['ko', 'en'] };
const art = (url, title, source, snippet) => ({ url, title, source, ...(snippet ? { snippet } : {}) });

// N1 — empty ingest array rejected by zod (min 1)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let rejected = false;
  try {
    const r = await call('ingest_news', { articles: [] });
    rejected = r.isError;
  } catch {
    rejected = true;
  }
  record('N1 empty ingest rejected', rejected, `rejected=${rejected}`);
});

// N2 — radar limit: 15 matching articles → brief.radar capped at 12
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const articles = Array.from({ length: 15 }, (_, i) => art(`https://reuters.com/tsla-${i}`, `TSLA story ${i}`, 'reuters.com'));
  await call('ingest_news', { articles });
  const br = await call('get_brief');
  record('N2 radar limit (12)', br.parsed.radar.length === 12, `radar=${br.parsed.radar.length} (expect 12)`);
});

// N3 — world layer limit: 8 tier-1 no-path headlines → world capped at 5
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const articles = Array.from({ length: 8 }, (_, i) => art(`https://reuters.com/w-${i}`, `Global summit day ${i}`, 'reuters.com'));
  const ing = await call('ingest_news', { articles });
  const br = await call('get_brief');
  const ok = ing.parsed.entered_radar === 0 && br.parsed.world.length === 5;
  record('N3 world layer limit (5)', ok, `entered=${ing.parsed.entered_radar} world=${br.parsed.world.length} (expect 0/5)`);
});

// N4 — last_scan is preserved across a profile re-feed (federation update must not reset scan state)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', { articles: [art('https://reuters.com/tsla', 'TSLA jumps', 'reuters.com')] });
  const mid = (await call('show_profile')).parsed.lastScan;
  await call('update_profile', { axes: [A('asset', 'Asset', 0.7, ['TSLA']), A('career', 'Career', 0.3, ['Toss'])] });
  const after = (await call('show_profile')).parsed.lastScan;
  const ok = typeof mid === 'number' && after === mid;
  record('N4 last_scan preserved on re-feed', ok, `mid=${mid} after=${after}`);
});

// N5 — keyword present only in the snippet (not the title) still matches
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [art('https://reuters.com/mkt', 'Markets wrap', 'reuters.com', 'Tech led by TSLA which rallied 5%')],
  });
  record('N5 snippet match', ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar} (expect 1)`);
});

// N6 — case-insensitive keyword matching
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['tsla'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/x', 'TSLA Inc rallies on AI', 'reuters.com')] });
  record('N6 case-insensitive match', ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar} (expect 1)`);
});

// N7 — GEO reachability: local-country news with no keyword should reach the user (design: local passthrough)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [art('https://yna.co.kr/econ', "South Korea's central bank holds interest rates", 'yna.co.kr')],
  });
  const ok = ing.parsed.entered_radar >= 1;
  record('N7 geo reachability (local passthrough)', ok, `entered=${ing.parsed.entered_radar} (design expects >=1: local news reaches user)`);
});

// N8 — tier-aware ranking: same keyword, Tier-1 should outrank Tier-0
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', {
    articles: [
      art('https://reuters.com/a', 'TSLA delivery beat', 'reuters.com'),
      art('https://randomblog.xyz/b', 'TSLA delivery beat rumor', 'randomblog.xyz'),
    ],
  });
  const br = await call('get_brief');
  const t1 = br.parsed.radar.find((a) => a.source === 'reuters.com');
  const t0 = br.parsed.radar.find((a) => a.source === 'randomblog.xyz');
  const ok = t1 && t0 && t1.impact.total > t0.impact.total;
  record('N8 tier-aware ranking', ok, `tier1=${t1?.impact.total} tier0=${t0?.impact.total} (design: trusted outranks)`);
});

// N9 — mark_read with an unknown URL is a graceful no-op
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let ok = false;
  try {
    const r = await call('mark_read', { urls: ['https://nowhere.example/never-seen'] });
    ok = !r.isError && r.parsed.marked === 1;
  } catch {
    ok = false;
  }
  record('N9 mark_read unknown url', ok, `graceful no-op`);
});

// N10 — duplicate + whitespace keywords in an axis don't crash or double-fire
await withServer(async ({ call, dbPath }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA', '   ', 'TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/t', 'TSLA up', 'reuters.com')] });
  const br = await call('get_brief');
  const ok = ing.parsed.entered_radar === 1 && br.parsed.radar.length === 1;
  record('N10 dup/whitespace keywords', ok, `entered=${ing.parsed.entered_radar} radar=${br.parsed.radar.length} seeds=${br.parsed.radar[0]?.impact.seeds.length}`);
});

const passed = results.filter((r) => r.ok).length;
console.log(`\n──────────────\n${passed}/${results.length} passed`);
console.log(JSON.stringify(results, null, 2));
