// Round-4 — Gemini's 3 adversarial surfaces (temporal drift, dedup bypass, keyword stuffing)
// plus regex/locale edge probes. Run from skope repo root: `node mcp-tests-4.mjs`
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
  const dbPath = join(tmpdir(), `skope-test4-${process.pid}-${n++}.db`);
  for (const s of ['', '-wal', '-shm']) rmSync(dbPath + s, { force: true });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['apps/mcp/dist/index.js'],
    env: { ...process.env, SKOPE_DB_PATH: dbPath, SKOPE_TAVILY_API_KEY: '' },
  });
  const client = new Client({ name: 'mcp-tests-4', version: '0.0.0' }, { capabilities: {} });
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

// F1 — temporal drift (future date) must not pollute the 14-day window (window keys off ingest time)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/f', 'TSLA up', 'reuters.com', { published_at: '2099-01-01T00:00:00Z' })] });
  const c = (await call('get_brief')).parsed.concentration;
  const ok = !ing.isError && ing.parsed.entered_radar === 1 && c.effectiveN >= 1;
  record('F1 future date no window pollution', ok, `entered=${ing.parsed.entered_radar} N=${c.effectiveN?.toFixed(2)}`);
});

// F2 — temporal drift (ancient date) likewise harmless
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/p', 'TSLA up', 'reuters.com', { published_at: '1970-01-01' })] });
  const br = await call('get_brief');
  record('F2 ancient date harmless', !ing.isError && br.parsed.radar.length === 1, `entered=${ing.parsed.entered_radar}`);
});

// F3 — dedup bypass via a non-tracking param (?ref=) — same story re-ingested as distinct rows
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [
      art('https://reuters.com/x?ref=a', 'Tesla beats Q3 delivery estimates as TSLA jumps', 'reuters.com'),
      art('https://reuters.com/x?ref=b', 'Tesla beats Q3 delivery estimates as TSLA jumps', 'reuters.com'),
    ],
  });
  const ok = ing.parsed.entered_radar === 1; // ideal: same story dedups to 1 via content key
  record('F3 dedup bypass via ref param', ok, `entered=${ing.parsed.entered_radar} (ideal 1; same path, diff ?ref)`);
});

// F4 — keyword stuffing can't force impact to 1.0 (bounded by normalized axis weights)
await withServer(async ({ call }) => {
  await call('update_profile', {
    axes: [A('a', 'A', 0.25, ['TSLA']), A('b', 'B', 0.25, ['Toss']), A('c', 'C', 0.25, ['React']), A('d', 'D', 0.25, ['NVDA'])],
    user_context: seoul,
  });
  await call('ingest_news', { articles: [art('https://randomblog.xyz/s', 'TSLA Toss React NVDA all the buzzwords', 'randomblog.xyz')] });
  const top = (await call('get_brief')).parsed.radar[0];
  const ok = top && top.impact.total <= 0.7;
  record('F4 keyword stuffing bounded', ok, `impact=${top?.impact.total?.toFixed(3)} (bounded, not forced to 1.0)`);
});

// F5 — special-char keyword ("$GME", "C++") must match (regex escaping)
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['$GME', 'C++'])], user_context: seoul });
  const ing = await call('ingest_news', {
    articles: [art('https://reuters.com/g', '$GME surges as C++ devs pile in', 'reuters.com')],
  });
  record('F5 special-char keyword match', ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar} (expect 1)`);
});

// F6 — zero-weight axis: normalization + matching don't crash
await withServer(async ({ call }) => {
  const r = await call('update_profile', {
    axes: [A('asset', 'Asset', 1, ['TSLA']), A('dead', 'Dead', 0, ['Toss'])],
    user_context: seoul,
  });
  const ok = !r.isError && Math.abs(r.parsed.axes.find((a) => a.id === 'asset').weight - 1) < 1e-9;
  record('F6 zero-weight axis normalized', ok, `weights=[${r.parsed.axes?.map((a) => a.weight.toFixed(2))}]`);
});

// F7 — emoji / unicode title does not crash matching
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const ing = await call('ingest_news', { articles: [art('https://reuters.com/e', '🚀 TSLA 🚀 soars 한국어 mixed 日本語', 'reuters.com')] });
  record('F7 emoji/unicode title', !ing.isError && ing.parsed.entered_radar === 1, `entered=${ing.parsed.entered_radar}`);
});

// F8 — mark_read with empty array rejected by zod
await withServer(async ({ call }) => {
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  let rejected = false;
  try {
    const r = await call('mark_read', { urls: [] });
    rejected = r.isError;
  } catch {
    rejected = true;
  }
  record('F8 mark_read empty array rejected', rejected, `rejected=${rejected}`);
});

const passed = results.filter((r) => r.ok).length;
console.log(`\n──────────────\n${passed}/${results.length} passed`);
console.log(JSON.stringify(results, null, 2));
