// Downloads every free data source into ./data as small JSON files.
// Run: npm run fetch   (the server also runs it on start when data is older than 12h)
import { mkdir, writeFile, readFile, stat, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

export const FRED_SERIES = [
  'WALCL',        // Fed total assets (millions USD, weekly)
  'WTREGEN',      // Treasury General Account (millions USD, weekly)
  'RRPONTSYD',    // Overnight reverse repo (billions USD, daily)
  'M2SL',         // US M2 (billions USD, monthly)
  'DFEDTARU',     // Fed funds target upper bound (daily, from 2008-12)
  'DTWEXBGS',     // Broad US dollar index (daily)
  'DFII10',       // 10Y real yield (TIPS)
  'T10Y2Y',       // 10Y minus 2Y yield spread
  'USREC',        // NBER recession flag (monthly)
  'CPIAUCSL',     // CPI index (monthly)
  'UNRATE',       // Unemployment rate (monthly)
  'NASDAQCOM',    // Nasdaq composite (daily)
  'VIXCLS',       // VIX (daily)
  'BAMLH0A0HYM2', // High-yield credit spread (daily)
];

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
// Third-party data ends up in the page; only plain YYYY-MM-DD dates are kept.
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'crows-chart/0.1 (+https://cryptocrow.io)' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await sleep(1500 * i);
    }
  }
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'crows-chart/0.1 (+https://cryptocrow.io)' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

async function save(rel, value) {
  const file = path.join(DATA, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(value)); // write then rename: readers never see half a file
  await rename(file + '.tmp', file);
}

// CoinMetrics community API: free daily metrics back to 2010.
async function fetchCoinMetrics() {
  const metrics = ['PriceUSD', 'CapMrktCurUSD', 'CapMVRVCur', 'SplyCur', 'HashRate', 'AdrActCnt', 'IssTotUSD', 'TxCnt'];
  let url = `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=${metrics.join(',')}` +
    '&frequency=1d&start_time=2010-07-17&page_size=10000&paging_from=start';
  const rows = [];
  while (url) {
    const page = await getJSON(url);
    rows.push(...page.data);
    url = page.next_page_url || null;
  }
  // Columnar: { t: [...dates], PriceUSD: [...], ... } keeps the file small.
  const out = { t: [] };
  for (const m of metrics) out[m] = [];
  for (const r of rows) {
    if (!isDay(String(r.time).slice(0, 10))) continue;
    out.t.push(r.time.slice(0, 10));
    for (const m of metrics) out[m].push(r[m] == null ? null : Number(r[m]));
  }
  await save('coinmetrics.json', out);
  return out;
}

async function fetchBitstamp(pair, startSec) {
  const bars = [];
  const now = Math.floor(Date.now() / 1000);
  let start = startSec;
  while (start < now) {
    const page = await getJSON(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=86400&limit=1000&start=${start}`);
    if (!Array.isArray(page?.data?.ohlc)) throw new Error(`Bitstamp bad reply: ${JSON.stringify(page).slice(0, 200)}`);
    const ohlc = page.data.ohlc;
    if (!ohlc.length) { start += 86400 * 1000; continue; }
    for (const k of ohlc) {
      bars.push({ t: day(Number(k.timestamp) * 1000), o: +k.open, h: +k.high, l: +k.low, c: +k.close, v: +k.volume });
    }
    const last = Number(ohlc[ohlc.length - 1].timestamp);
    if (last + 86400 <= start) break;
    start = last + 86400;
    await sleep(250);
  }
  const seen = new Map();
  for (const b of bars) seen.set(b.t, b);
  return [...seen.values()].sort((a, b) => (a.t < b.t ? -1 : 1));
}

// Real candles from Bitstamp (from Aug 2011). Before that, and in any gap,
// CoinMetrics daily price fills in as a flat "synthetic" candle (s: 1).
async function buildBtc(cm) {
  const stamp = await fetchBitstamp('btcusd', 1312156800); // 2011-08-01
  const byDay = new Map(stamp.filter((b) => b.c > 0).map((b) => [b.t, b]));
  const out = [];
  let prev = null;
  for (let i = 0; i < cm.t.length; i++) {
    const t = cm.t[i];
    const real = byDay.get(t);
    if (real) { out.push(real); prev = real.c; byDay.delete(t); continue; }
    const p = cm.PriceUSD[i];
    if (p == null) continue;
    const o = prev ?? p;
    out.push({ t, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: 0, s: 1 });
    prev = p;
  }
  // Bitstamp days newer than the latest CoinMetrics day (today's candle).
  for (const b of byDay.values()) if (b.t > out[out.length - 1].t) out.push(b);
  out.sort((a, b) => (a.t < b.t ? -1 : 1));
  await save('btc.json', out);
  return out;
}

async function fetchFred(id) {
  const csv = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`);
  const lines = csv.trim().split('\n').slice(1);
  const t = [], v = [];
  for (const line of lines) {
    const [d, val] = line.split(',');
    const n = Number(val);
    if (!isDay(d) || val === '' || val === '.' || !Number.isFinite(n)) continue;
    t.push(d); v.push(n);
  }
  await save(`fred/${id}.json`, { t, v });
}

async function fetchDifficulty() {
  const j = await getJSON('https://api.blockchain.info/charts/difficulty?timespan=all&format=json&sampled=false');
  await save('difficulty.json', { t: j.values.map((p) => day(p.x * 1000)), v: j.values.map((p) => p.y) });
}

async function fetchFearGreed() {
  const j = await getJSON('https://api.alternative.me/fng/?limit=0');
  const rows = j.data.map((r) => [day(Number(r.timestamp) * 1000), Number(r.value)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  await save('feargreed.json', { t: rows.map((r) => r[0]), v: rows.map((r) => r[1]) });
}

async function fetchStablecoins() {
  const j = await getJSON('https://stablecoins.llama.fi/stablecoincharts/all');
  const rows = j.filter((r) => r.totalCirculatingUSD?.peggedUSD).map((r) => [day(Number(r.date) * 1000), r.totalCirculatingUSD.peggedUSD]);
  await save('stablecoins.json', { t: rows.map((r) => r[0]), v: rows.map((r) => r[1]) });
}

async function fetchEthBtc() {
  const bars = await fetchBitstamp('ethbtc', 1501545600); // 2017-08-01
  await save('ethbtc.json', { t: bars.map((b) => b.t), v: bars.map((b) => b.c) });
}

export async function fetchAll(log = console.log) {
  await mkdir(DATA, { recursive: true });
  const report = {};
  const run = async (name, fn) => {
    const t0 = Date.now();
    try { await fn(); report[name] = 'ok'; log(`  ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
    catch (err) { report[name] = `FAILED: ${err.message}`; log(`  FAIL ${name}: ${err.message}`); }
  };
  log('Fetching data...');
  let cm;
  await run('coinmetrics', async () => { cm = await fetchCoinMetrics(); });
  if (cm) await run('btc candles', () => buildBtc(cm));
  await Promise.all([
    run('difficulty', fetchDifficulty),
    run('fear & greed', fetchFearGreed),
    run('stablecoins', fetchStablecoins),
    run('eth/btc', fetchEthBtc),
    ...FRED_SERIES.map((id) => run(`fred ${id}`, () => fetchFred(id))),
  ]);
  // Core data failed → keep the old timestamp so the next start retries.
  const coreOk = report.coinmetrics === 'ok' && report['btc candles'] === 'ok';
  let prev = {}; try { prev = JSON.parse(await readFile(path.join(DATA, 'meta.json'), 'utf8')); } catch { /* first run */ }
  await save('meta.json', { fetchedAt: coreOk ? new Date().toISOString() : prev.fetchedAt || new Date(0).toISOString(), report });
  log('Done.');
  return report;
}

export async function dataAgeHours() {
  try {
    const meta = JSON.parse(await readFile(path.join(DATA, 'meta.json'), 'utf8'));
    await stat(path.join(DATA, 'btc.json'));
    return (Date.now() - Date.parse(meta.fetchedAt)) / 36e5;
  } catch { return Infinity; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchAll().catch((err) => { console.error(err); process.exit(1); });
}
