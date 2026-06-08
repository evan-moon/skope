// Round-5 — operational stability: concurrency/atomicity, large-ledger latency, bounded brief,
// persistence across restart, idempotent schema bootstrap. Run: `node mcp-tests-5.mjs`
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

const newDbPath = (i) => {
  const p = join(tmpdir(), `skope-test5-${process.pid}-${i}.db`);
  for (const s of ['', '-wal', '-shm']) rmSync(p + s, { force: true });
  return p;
};

function connect(dbPath) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['apps/mcp/dist/index.js'],
    env: { ...process.env, SKOPE_DB_PATH: dbPath, SKOPE_TAVILY_API_KEY: '' },
  });
  const client = new Client({ name: 'mcp-tests-5', version: '0.0.0' }, { capabilities: {} });
  return { transport, client };
}
async function open(dbPath) {
  const { client, transport } = connect(dbPath);
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
  return { client, call };
}

const A = (id, label, weight, keywords) => ({ id, label, weight, keywords });
const seoul = { location: 'Seoul, Korea', languages: ['ko', 'en'] };

// G1 — concurrent ingest: a shared story across parallel calls must dedup (no double-count)
{
  const dbPath = newDbPath(0);
  const { client, call } = await open(dbPath);
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  const shared = { url: 'https://reuters.com/shared', title: 'Tesla beats Q3 delivery estimates as TSLA jumps', source: 'reuters.com' };
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      call('ingest_news', { articles: [shared, { url: `https://reuters.com/u-${i}`, title: `TSLA unique story number ${i}`, source: 'reuters.com' }] }),
    ),
  );
  await client.close();
  const db = new Database(dbPath, { readonly: true });
  const sharedRows = db.prepare("SELECT COUNT(*) n FROM article_impacts WHERE url_hash = (SELECT url_hash FROM articles_seen WHERE url = ?)").get(shared.url).n;
  const totalArticles = db.prepare('SELECT COUNT(*) n FROM articles_seen').get().n;
  db.close();
  const ok = sharedRows === 1 && totalArticles === 9; // 1 shared + 8 unique
  record('G1 concurrent ingest dedup (no double-count)', ok, `shared_impacts=${sharedRows} total_articles=${totalArticles} (expect 1/9)`);
}

// G2 + G3 — large ledger: latency bounded + brief output capped
{
  const dbPath = newDbPath(1);
  const { client, call } = await open(dbPath);
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await client.close();
  // pre-seed 5000 scored articles directly
  const db = new Database(dbPath);
  const now = Date.now();
  const insA = db.prepare('INSERT INTO articles_seen (url_hash,url,title,source,tier,first_seen_at) VALUES (?,?,?,?,?,?)');
  const insI = db.prepare('INSERT INTO article_impacts (url_hash,axis_id,score,match_seed) VALUES (?,?,?,?)');
  const tx = db.transaction(() => {
    for (let i = 0; i < 5000; i++) {
      const h = `seed${i}`;
      insA.run(h, `https://reuters.com/seed-${i}`, `TSLA seeded story ${i}`, 'reuters.com', 1, now);
      insI.run(h, 'asset', 0.5 + (i % 100) / 1000, JSON.stringify({ entity: 'TSLA', matchType: 'keyword', strength: 0.6 }));
    }
  });
  tx();
  db.close();
  const { client: c2, call: call2 } = await open(dbPath);
  const t0 = performance.now();
  const br = await call2('get_brief');
  const ms = performance.now() - t0;
  await c2.close();
  record('G2 large-ledger latency (5000 rows)', ms < 2000, `get_brief took ${ms.toFixed(0)}ms (expect <2000)`);
  record('G3 brief output bounded under load', br.parsed.radar.length === 12 && br.parsed.world.length <= 5, `radar=${br.parsed.radar.length} world=${br.parsed.world.length}`);
}

// G4 — persistence + idempotent bootstrap across a server restart
{
  const dbPath = newDbPath(2);
  const { client: c1, call: call1 } = await open(dbPath);
  await call1('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  await call1('ingest_news', { articles: [{ url: 'https://reuters.com/persist', title: 'TSLA persistence check story', source: 'reuters.com' }] });
  await c1.close();
  // reopen a fresh server on the same db (re-runs CREATE TABLE IF NOT EXISTS)
  const { client: c2, call: call2 } = await open(dbPath);
  const prof = await call2('show_profile');
  const br = await call2('get_brief');
  await c2.close();
  const ok = prof.parsed.axes?.length === 1 && br.parsed.radar.length === 1;
  record('G4 persistence + idempotent bootstrap', ok, `axes=${prof.parsed.axes?.length} radar=${br.parsed.radar.length}`);
}

// G5 — sustained sequential load: 30 ingest calls, ledger consistent, no crash
{
  const dbPath = newDbPath(3);
  const { client, call } = await open(dbPath);
  await call('update_profile', { axes: [A('asset', 'Asset', 1, ['TSLA'])], user_context: seoul });
  for (let i = 0; i < 30; i++) {
    await call('ingest_news', { articles: [{ url: `https://reuters.com/seq-${i}`, title: `TSLA sequential story number ${i}`, source: 'reuters.com' }] });
  }
  const br = await call('get_brief');
  await client.close();
  const db = new Database(dbPath, { readonly: true });
  const total = db.prepare('SELECT COUNT(*) n FROM articles_seen').get().n;
  db.close();
  record('G5 sustained sequential load (30)', total === 30 && br.parsed.radar.length === 12, `total=${total} radar=${br.parsed.radar.length} (expect 30/12)`);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n──────────────\n${passed}/${results.length} passed`);
console.log(JSON.stringify(results, null, 2));
