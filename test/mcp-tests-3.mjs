// Round-3 — 10 adversarial scenarios probing ranking depth, multilingual geo, batch robustness,
// and input brittleness. Run from skope repo root: `node mcp-tests-3.mjs`
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
  const dbPath = join(tmpdir(), `skope-test3-${process.pid}-${n++}.db`);
  for (const s of ['', '-wal', '-shm']) rmSync(dbPath + s, { force: true });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['apps/mcp/dist/index.js'],
    env: { ...process.env, SKOPE_DB_PATH: dbPath, SKOPE_TAVILY_API_KEY: '' },
  });
  const client = new Client({ name: 'mcp-tests-3', version: '0.0.0' }, { capabilities: {} });
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
const art = (url, title, source, extra = {}) => ({ url, title, source, ...extra });

// R1 — tier inversion: strong-interest axis (Tier 0) can outrank a weak-interest axis (Tier 1)
await withServer(async ({ call }) => {
  await call('update_profile', {
    axes: [A('asset', 'Asset', 0.1, ['TSLA']), A('career', 'Career', 0.9, ['Toss'])],
    user_context: seoul,
  });
  await call('ingest_news', {
    articles: [art('https://reuters.com/t', 'TSLA news', 'reuters.com'), art('https://randomblog.xyz/c', 'Toss news', 'randomblog.xyz')],
  });
  const br = await call('get_brief');
  const ok = br.parsed.radar[0]?.source === 'randomblog.xyz';
  record('R1 interest-weight vs source-tier', ok, `top=${br.parsed.radar[0]?.source} (career0.9/T0 should beat asset0.1/T1)`);
});

// R2 — multilingual geo: a Korean-language local story from the country press should reach a KR user
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://yna.co.kr/re', '서울 아파트 전세값 급등', 'yna.co.kr')] });
  record('R2 multilingual geo (Korean local)', ing.parsed.entered_radar >= 1, `entered=${ing.parsed.entered_radar} (ideal>=1: 서울 local news)`);
});

// R3 — geo-only concentration: all-local reading collapses Effective-N onto the geo axis
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', {
    articles: Array.from({ length: 3 }, (_, i) => art(`https://reuters.com/k-${i}`, `Korea economy update ${i}`, 'reuters.com')),
  });
  const c = (await call('get_brief')).parsed.concentration;
  const ok = c.effectiveN <= 1.01 && typeof c.warning === 'string';
  record('R3 geo-only concentration', ok, `N=${c.effectiveN?.toFixed(2)} axes=[${c.distribution.map((d) => d.axisId)}]`);
});

// R4 — malformed published_at should not kill the whole batch (brittleness probe)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let ok = false;
  let detail = '';
  try {
    const r = await call('ingest_news', { articles: [art('https://reuters.com/d', 'TSLA up', 'reuters.com', { published_at: 'yesterday' })] });
    ok = !r.isError && r.parsed.entered_radar === 1;
    detail = `isError=${r.isError} entered=${r.parsed.entered_radar}`;
  } catch (e) {
    ok = false;
    detail = `threw: ${String(e).slice(0, 60)}`;
  }
  record('R4 malformed published_at tolerated', ok, `${detail} (ideal: drop bad date, keep article)`);
});

// R5 — duplicate URLs in one batch: deterministic first-wins
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', {
    articles: [art('https://reuters.com/u', 'First TSLA story', 'reuters.com'), art('https://reuters.com/u', 'Second TSLA story', 'reuters.com')],
  });
  const br = await call('get_brief');
  const ok = br.parsed.radar.length === 1 && br.parsed.radar[0].title === 'First TSLA story';
  record('R5 in-batch dup url first-wins', ok, `radar=${br.parsed.radar.length} title="${br.parsed.radar[0]?.title}"`);
});

// R6 — unimplemented mute_topic must fail gracefully without killing the server
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let errored = false;
  try {
    const r = await call('mute_topic', { topic: 'sports' });
    errored = r.isError;
  } catch {
    errored = true;
  }
  const stillAlive = (await call('show_profile')).parsed.axes?.length === 1;
  record('R6 mute_topic graceful (unimplemented)', errored && stillAlive, `errored=${errored} serverAlive=${stillAlive}`);
});

// R7 — mark_read is idempotent
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 0.5, ['TSLA']), A('career', 'Career', 0.5, ['Toss'])], user_context: seoul });
  await call('ingest_news', { articles: [art('https://reuters.com/t', 'TSLA up', 'reuters.com'), art('https://yna.co.kr/to', 'Toss IPO', 'yna.co.kr')] });
  await call('mark_read', { urls: ['https://reuters.com/t'] });
  await call('mark_read', { urls: ['https://reuters.com/t'] });
  const br = await call('get_brief');
  record('R7 mark_read idempotent', br.parsed.radar.length === 1, `radar=${br.parsed.radar.length} (expect 1)`);
});

// R8 — empty location: no geo, no crash
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: { location: '', languages: ['en'] } });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/k', 'Korea GDP grows', 'reuters.com')] });
  record('R8 empty location no geo/crash', !ing.isError && ing.parsed.entered_radar === 0, `isError=${ing.isError} entered=${ing.parsed.entered_radar}`);
});

// R9 — large batch (150 articles, 50 matching) → correct count, radar capped at 12
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const articles = Array.from({ length: 150 }, (_, i) => art(`https://reuters.com/b-${i}`, i < 50 ? `TSLA item ${i}` : `Misc item ${i}`, 'reuters.com'));
  const ing = await call('ingest_news', { articles });
  const br = await call('get_brief');
  const ok = ing.parsed.entered_radar === 50 && br.parsed.radar.length === 12;
  record('R9 large batch (150)', ok, `entered=${ing.parsed.entered_radar} radar=${br.parsed.radar.length} (expect 50/12)`);
});

// R10 — same keyword, three tiers → strict tier ordering in the radar
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call('ingest_news', {
    articles: [
      art('https://randomblog.xyz/c', 'TSLA rumor', 'randomblog.xyz'), // tier 0
      art('https://reuters.com/a', 'TSLA report', 'reuters.com'), // tier 1
      art('https://yna.co.kr/b', 'TSLA 분석', 'yna.co.kr'), // tier 2
    ],
  });
  const order = (await call('get_brief')).parsed.radar.map((a) => a.tier);
  const ok = JSON.stringify(order) === JSON.stringify([1, 2, 0]);
  record('R10 three-tier strict ordering', ok, `order=[${order}] (expect [1,2,0])`);
});

const passed = results.filter((r) => r.ok).length;
console.log(`\n──────────────\n${passed}/${results.length} passed`);
console.log(JSON.stringify(results, null, 2));
