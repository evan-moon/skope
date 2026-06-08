// 10-scenario MCP test harness. Each test spawns a fresh skope MCP server over its own temp DB
// (SKOPE_DB_PATH) and asserts behavior end-to-end through the real MCP protocol.
// Run from skope repo root: `node mcp-tests.mjs`
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

let dbCounter = 0;
async function withServer(fn) {
  const dbPath = join(tmpdir(), `skope-test-${process.pid}-${dbCounter++}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true });
  }
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['apps/mcp/dist/index.js'],
    env: { ...process.env, SKOPE_DB_PATH: dbPath, SKOPE_TAVILY_API_KEY: '' },
  });
  const client = new Client({ name: 'mcp-tests', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = res.content[0].text;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text }; // some errors come back as plain text, not JSON
    }
    return { parsed, isError: res.isError === true };
  };
  try {
    return await fn({ call, dbPath, client });
  } finally {
    await client.close();
  }
}

const A = (id, label, weight, keywords) => ({ id, label, weight, keywords });
const seoul = { location: 'Seoul, Korea', languages: ['ko', 'en'] };
const art = (url, title, source) => ({ url, title, source });

// T1 — guards before a profile exists
await withServer(async ({ call }) => {
  const sp = await call('show_profile');
  const br = await call('get_brief');
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/a', 'TSLA up', 'reuters.com')] });
  const ok = sp.parsed.configured === false && br.isError && ing.isError;
  record('T1 no-profile guards', ok, `show=${sp.parsed.configured} brief.err=${br.isError} ingest.err=${ing.isError}`);
});

// T2 — weight normalization to 1.0
await withServer(async ({ call }) => {
  const r = await call('update_profile', {
    axes: [A('asset', 'Asset', 3, ['TSLA']), A('career', 'Career', 1, ['Toss'])],
    user_context: seoul,
  });
  const w = r.parsed.axes.map((a) => a.weight);
  const ok = Math.abs(w[0] - 0.75) < 1e-9 && Math.abs(w[1] - 0.25) < 1e-9;
  record('T2 weight normalization', ok, `weights=[${w.map((x) => x.toFixed(2))}]`);
});

// T3 — 6-axis hard cap
await withServer(async ({ call }) => {
  const axes = Array.from({ length: 7 }, (_, i) => A(`x${i}`, `X${i}`, 1, []));
  const r = await call('update_profile', { axes, user_context: seoul });
  record('T3 six-axis cap', r.isError, `error=${r.isError} (${r.parsed.error ?? 'none'})`);
});

// T4 — reachability: relevant in, unrelated out
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [
      art('https://reuters.com/tsla', 'Tesla TSLA jumps on deliveries', 'reuters.com'),
      art('https://globo.com/rio', 'A sunny day at the Rio street festival', 'globo.com'),
    ],
  });
  const br = await call('get_brief');
  const ok = ing.parsed.entered_radar === 1 && br.parsed.radar.length === 1 && br.parsed.radar[0].source === 'reuters.com';
  record('T4 reachability filter', ok, `entered=${ing.parsed.entered_radar} radar=${br.parsed.radar.length}`);
});

// T5 — cross-call re-ingest must not double-count impacts
await withServer(async ({ call, dbPath }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const a = art('https://reuters.com/tsla', 'Tesla TSLA jumps', 'reuters.com');
  await call('ingest_news', { articles: [a] });
  await call('ingest_news', { articles: [a] });
  const br = await call('get_brief');
  const db = new Database(dbPath, { readonly: true });
  const impactRows = db.prepare('SELECT COUNT(*) n FROM article_impacts').get().n;
  db.close();
  const ok = br.parsed.radar.length === 1 && impactRows === 1;
  record('T5 re-ingest no double-count', ok, `radar=${br.parsed.radar.length} impact_rows=${impactRows} (expect 1/1)`);
});

// T6 — URL canonicalization dedup within a batch
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [
      art('https://site.com/t?utm_source=twitter', 'TSLA news', 'site.com'),
      art('https://site.com/t', 'TSLA news', 'site.com'),
    ],
  });
  record('T6 url canonicalization dedup', ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar} (expect 1)`);
});

// T7 — trust tier classification for a KR user
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', {
    articles: [
      art('https://reuters.com/a', 'TSLA via Reuters', 'reuters.com'),
      art('https://yna.co.kr/b', 'TSLA via Yonhap', 'yna.co.kr'),
      art('https://randomblog.xyz/c', 'TSLA via blog', 'randomblog.xyz'),
    ],
  });
  const br = await call('get_brief');
  const tierOf = (s) => br.parsed.radar.find((a) => a.source === s)?.tier;
  const ok = tierOf('reuters.com') === 1 && tierOf('yna.co.kr') === 2 && tierOf('randomblog.xyz') === 0;
  record('T7 tier classification', ok, `reuters=${tierOf('reuters.com')} yna=${tierOf('yna.co.kr')} blog=${tierOf('randomblog.xyz')}`);
});

// T8 — Effective-N concentration warning fires on a one-axis pile-up
await withServer(async ({ call }) => {
  await call('update_profile', {
    axes: [A('asset', 'Asset', 0.4, ['TSLA']), A('career', 'Career', 0.3, ['Toss']), A('know', 'Know', 0.2, ['React']), A('gen', 'Gen', 0.1, [])],
    user_context: seoul,
  });
  await call('ingest_news', {
    articles: Array.from({ length: 4 }, (_, i) => art(`https://reuters.com/tsla-${i}`, `TSLA story ${i}`, 'reuters.com')),
  });
  const br = await call('get_brief');
  const c = br.parsed.concentration;
  const ok = c.effectiveN < 1.8 && typeof c.warning === 'string' && c.warning.length > 0;
  record('T8 concentration warning', ok, `N=${c.effectiveN?.toFixed(2)} warning=${c.warning ? 'yes' : 'no'}`);
});

// T9 — mark_read deterministic exclusion
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 0.5, ['TSLA']), A('career', 'Career', 0.5, ['Toss'])], user_context: seoul });
  await call('ingest_news', {
    articles: [art('https://reuters.com/tsla', 'TSLA jumps', 'reuters.com'), art('https://yna.co.kr/toss', 'Toss IPO', 'yna.co.kr')],
  });
  const before = await call('get_brief');
  await call('mark_read', { urls: ['https://reuters.com/tsla'] });
  const after = await call('get_brief');
  const ok = before.parsed.radar.length === 2 && after.parsed.radar.length === 1 && after.parsed.radar[0].source === 'yna.co.kr';
  record('T9 mark_read exclusion', ok, `before=${before.parsed.radar.length} after=${after.parsed.radar.length}`);
});

// T10 — input validation + scan_news without key
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let zodRejected = false;
  try {
    const r = await call('ingest_news', { articles: [{ url: 'not-a-url', title: 'x', source: 'y' }] });
    zodRejected = r.isError;
  } catch {
    zodRejected = true; // SDK throws McpError on invalid params — also a valid rejection
  }
  const scan = await call('scan_news', { queries: ['TSLA'] });
  const scanOk = scan.isError && /ingest_news|Tavily/i.test(scan.parsed.error ?? '');
  record('T10 input validation + scan fallback', zodRejected && scanOk, `zodRejected=${zodRejected} scanErr=${scanOk}`);
});

// ── Additional 5 (T11–T15), per Gemini's coverage gaps ───────────────────────

// T11 — one article matching multiple axes → impact row per axis, summed total
await withServer(async ({ call, dbPath }) => {
  await call('update_profile', {
    axes: [A('asset', 'Asset', 0.6, ['NVDA', '엔비디아']), A('semi', 'Semiconductors', 0.4, ['반도체', 'semiconductor'])],
    user_context: seoul,
  });
  await call('ingest_news', { articles: [art('https://reuters.com/nv', '엔비디아 반도체 surge on AI demand', 'reuters.com')] });
  const br = await call('get_brief');
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare('SELECT COUNT(*) n FROM article_impacts').get().n;
  db.close();
  const seeds = br.parsed.radar[0]?.impact.seeds.map((s) => s.axisId) ?? [];
  const ok = rows === 2 && new Set(seeds).size === 2;
  record('T11 multi-axis match', ok, `impact_rows=${rows} axes=[${[...new Set(seeds)]}]`);
});

// T12 — substring false-positive: keyword "AI" must NOT match "Spain"/"rain"
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['AI'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/rain', 'Spain rain brings relief to farmers', 'reuters.com')] });
  const ok = ing.parsed.entered_radar === 0;
  record('T12 substring false-positive guard', ok, `entered=${ing.parsed.entered_radar} (expect 0; substring "ai" in Sp-ai-n/r-ai-n)`);
});

// T13 — Korean (non-ASCII) keyword matching
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['삼성전자'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://yna.co.kr/ss', '삼성전자 3분기 실적 발표', 'yna.co.kr')] });
  record('T13 Korean keyword match', ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar} (expect 1)`);
});

// T14 — 14-day window: a 20-day-old impact must be excluded from Effective-N
await withServer(async ({ call, dbPath }) => {
  await call('update_profile', {
    axes: [A('asset', 'Asset', 0.5, ['TSLA']), A('career', 'Career', 0.5, ['Toss'])],
    user_context: seoul,
  });
  await call('ingest_news', { articles: [art('https://reuters.com/tsla', 'TSLA jumps', 'reuters.com')] });
  // backdate a 'career' impact 20 days ago directly in the ledger
  const old = Date.now() - 20 * 24 * 60 * 60 * 1000;
  const db = new Database(dbPath);
  db.prepare('INSERT OR IGNORE INTO articles_seen (url_hash,url,title,source,tier,first_seen_at) VALUES (?,?,?,?,?,?)')
    .run('oldhash', 'https://yna.co.kr/old', 'old Toss story', 'yna.co.kr', 2, old);
  db.prepare('INSERT INTO article_impacts (url_hash,axis_id,score,match_seed) VALUES (?,?,?,?)')
    .run('oldhash', 'career', 0.5, null);
  db.close();
  const br = await call('get_brief');
  const axes = br.parsed.concentration.distribution.map((d) => d.axisId);
  const ok = axes.includes('asset') && !axes.includes('career');
  record('T14 14-day window boundary', ok, `distribution=[${axes}] (career @20d must be excluded)`);
});

// T15 — last_scan advances after ingest
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const before = await call('show_profile');
  await call('ingest_news', { articles: [art('https://reuters.com/tsla', 'TSLA jumps', 'reuters.com')] });
  const after = await call('show_profile');
  const ls = after.parsed.lastScan;
  const ok = before.parsed.lastScan == null && typeof ls === 'number' && Date.now() - ls < 60000;
  record('T15 last_scan advances', ok, `before=${before.parsed.lastScan} after=${ls}`);
});

const passed = results.filter((r) => r.ok).length;
console.log(`\n──────────────\n${passed}/${results.length} passed`);
console.log(JSON.stringify(results, null, 2));
