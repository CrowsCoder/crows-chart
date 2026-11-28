// Every clickable item in the left panel. Pure data + math (no DOM),
// so bin/chart.mjs can load the same catalog for stats.
//
// Item shape:
//   { id, group, name, desc, grade: 'A'|'B'|'C', color, needs: [dataKeys],
//     build(ctx) -> { events?: [{d,label,note}], zones?: [{from,to,label,note}], lines?: [Line] } }
// Line shape:
//   { name, points: [{time,value}], color?, target: 'price'|'overlay'|'pane',
//     type?: 'line'|'histogram'|'step', levels?: [n], log?: bool, dashed?: bool, width?: n, format?: 'usd'|'pct'|'num' }
// ctx: { bars (daily candles), get(key) -> loaded JSON }
import * as E from './events-data.js';
import {
  addDays, toMs, DAY_MS, sma, ema, rsi, zip, weeklyIndicator, cols, valueAt,
  powerLawFit, moonDates, lastFriday, daysBetween,
} from './calc.js';

export const GROUPS = [
  { id: 'cycle', name: 'Halving & 4-year cycle' },
  { id: 'money', name: 'Central bank money (QE / QT)' },
  { id: 'rates', name: 'Interest rates' },
  { id: 'politics', name: 'US politics' },
  { id: 'macro', name: 'Business cycle & macro' },
  { id: 'wars', name: 'Wars & geopolitics' },
  { id: 'news', name: 'Crypto news & crises' },
  { id: 'miners', name: 'Miners & hash power' },
  { id: 'onchain', name: 'On-chain value' },
  { id: 'models', name: 'Price models' },
  { id: 'flows', name: 'Flows & big holders' },
  { id: 'deriv', name: 'Derivatives & leverage' },
  { id: 'sentiment', name: 'Sentiment & market structure' },
  { id: 'season', name: 'Seasonality' },
  { id: 'waves', name: 'Long waves & folklore' },
];

// Items from the master list that need paid or blocked data. Shown greyed out.
export const UNAVAILABLE = [
  { group: 'money', name: 'Global M2 (multi-country)', why: 'No clean free daily source for China/EU/Japan M2 in USD.' },
  { group: 'macro', name: 'ISM Manufacturing PMI', why: 'ISM removed it from FRED. Paid only.' },
  { group: 'onchain', name: 'SOPR / LTH supply / HODL waves', why: 'Glassnode / CryptoQuant paid API.' },
  { group: 'onchain', name: 'Exchange balances & netflows', why: 'CryptoQuant / Glassnode paid API.' },
  { group: 'flows', name: 'Spot ETF daily flows', why: 'No free API (Farside is a web page only).' },
  { group: 'flows', name: 'Coinbase premium', why: 'CryptoQuant paid API.' },
  { group: 'deriv', name: 'Funding rates & open interest history', why: 'Binance/Bybit block US; others keep only ~3 months free.' },
  { group: 'deriv', name: 'Liquidation heatmap', why: 'Coinglass paid API.' },
  { group: 'sentiment', name: 'Google Trends', why: 'No official free API.' },
  { group: 'sentiment', name: 'BTC dominance history', why: 'CoinGecko history needs a paid key.' },
];

const PALETTE = ['#f7931a', '#4f8cff', '#e5484d', '#30a46c', '#ad7bff', '#f5d90a', '#12a5b8', '#ff8bd1', '#8e9196', '#ff6b2c', '#7ee787', '#c9a227'];
let colorIdx = 0;
const nextColor = () => PALETTE[colorIdx++ % PALETTE.length];

const fred = (ctx, id) => cols(ctx.get(`fred:${id}`));
const cm = (ctx, metric) => {
  const c = ctx.get('cm');
  return c.t.map((t, i) => ({ time: t, value: c[metric][i] })).filter((p) => p.value != null && Number.isFinite(p.value));
};
const closes = (ctx) => ctx.bars.map((b) => b.c);
const times = (ctx) => ctx.bars.map((b) => b.t);
const today = () => new Date().toISOString().slice(0, 10);

function crossings(t, a, b, upLabel, downLabel) {
  const ev = [];
  for (let i = 1; i < t.length; i++) {
    if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
    if (upLabel && a[i - 1] <= b[i - 1] && a[i] > b[i]) ev.push({ d: t[i], label: upLabel });
    if (downLabel && a[i - 1] >= b[i - 1] && a[i] < b[i]) ev.push({ d: t[i], label: downLabel });
  }
  return ev;
}

function extremeIn(bars, from, to, high) {
  let best = null;
  for (const b of bars) {
    if (b.t < from || b.t > to) continue;
    if (!best || (high ? b.h > best.h : b.l < best.l)) best = b;
  }
  return best;
}

const usd = (n) => (n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toPrecision(3)}`);

// Fed target-rate moves, from FRED DFEDTARU (upper bound, daily since 2008-12-16).
function rateMoves(ctx) {
  const s = fred(ctx, 'DFEDTARU');
  const moves = [];
  for (let i = 1; i < s.length; i++) {
    const diff = s[i].value - s[i - 1].value;
    if (Math.abs(diff) < 1e-9) continue;
    const bp = Math.round(diff * 100);
    moves.push({ d: s[i].time, dir: diff > 0 ? 'hike' : 'cut', bp, to: s[i].value });
  }
  return moves;
}
function moveRuns(moves, dir) {
  const runs = [];
  let run = null;
  for (const m of moves) {
    if (m.dir !== dir) { run = null; continue; }
    if (run && daysBetween(run.to, m.d) <= 400) { run.to = m.d; run.n++; run.total += m.bp; }
    else { run = { from: m.d, to: m.d, n: 1, total: m.bp }; runs.push(run); }
  }
  return runs.filter((r) => r.n >= 2).map((r) => ({ from: r.from, to: r.to, label: `${dir === 'hike' ? 'Hiking' : 'Cutting'} cycle: ${r.n} moves, ${r.total > 0 ? '+' : ''}${(r.total / 100).toFixed(2)}%` }));
}

function yearZones(fromYear, toYear, fn) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) { const z = fn(y); if (z) out.push(z); }
  return out;
}

const NOW_YEAR = new Date().getUTCFullYear();

export const ITEMS = [
  // ───────── Halving & 4-year cycle
  { id: 'halvings', group: 'cycle', name: 'Halvings', grade: 'A', desc: 'Block reward cut in half every 210,000 blocks (~4 years).',
    build: () => ({ events: E.HALVINGS }) },
  { id: 'halving-epochs', src: 'Halving dates', group: 'cycle', name: 'Halving epochs (4-year cycles)', grade: 'A', desc: 'Shaded halving-to-halving periods.',
    build: () => {
      const d = ['2009-01-03', ...E.HALVINGS.map((h) => h.d)];
      return { zones: d.slice(0, -1).map((from, i) => ({ from, to: addDays(d[i + 1], -1), label: `Epoch ${i + 1}`, alt: i % 2 })) };
    } },
  { id: 'cycle-peaks', src: 'Found in BTC price data (highest high in fixed date windows)', group: 'cycle', name: 'Cycle tops', grade: 'B', desc: 'Highest price of each cycle, found in the data.',
    build: (ctx) => ({ events: E.CYCLE_PEAK_WINDOWS.map(([f, t, label]) => ({ b: extremeIn(ctx.bars, f, t, true), label })).filter((x) => x.b)
      .map(({ b, label }) => ({ d: b.t, label: `${label} ${usd(b.h)}` })) }) },
  { id: 'cycle-bottoms', src: 'Found in BTC price data (lowest low in fixed date windows)', group: 'cycle', name: 'Cycle bottoms', grade: 'B', desc: 'Lowest price of each bear market, found in the data.',
    build: (ctx) => ({ events: E.CYCLE_BOTTOM_WINDOWS.map(([f, t, label]) => ({ b: extremeIn(ctx.bars, f, t, false), label })).filter((x) => x.b)
      .map(({ b, label }) => ({ d: b.t, label: `${label} ${usd(b.l)}` })) }) },
  { id: 'halving-to-top', src: 'Halving dates + cycle tops found in price data', group: 'cycle', name: 'Halving → top runs', grade: 'B', desc: 'Shaded run from each halving to the next cycle top. Shows the ~12–18 month pattern.',
    build: (ctx) => {
      const peaks = E.CYCLE_PEAK_WINDOWS.slice(1).map(([f, t]) => extremeIn(ctx.bars, f, t, true));
      return { zones: E.HALVINGS.slice(0, 4).map((h, i) => peaks[i] && ({ from: h.d, to: peaks[i].t, label: `Halving ${i + 1} → top: ${daysBetween(h.d, peaks[i].t)} days` })).filter(Boolean) };
    } },
  { id: 'days-since-halving', src: 'Computed from halving dates', group: 'cycle', name: 'Days since halving', grade: 'B', desc: 'Counter that resets at every halving.',
    build: (ctx) => {
      const hs = E.HALVINGS.map((h) => h.d);
      return { lines: [{ name: 'Days since halving', target: 'pane', format: 'num', points: ctx.bars.map((b) => {
        const last = hs.filter((h) => h <= b.t).pop();
        return last ? { time: b.t, value: daysBetween(last, b.t) } : null;
      }).filter(Boolean) }] };
    } },
  { id: 'inflation', group: 'cycle', name: 'BTC supply inflation % (yearly)', grade: 'A', needs: ['cm'], desc: 'New coins per year ÷ supply. Drops at each halving.',
    build: (ctx) => {
      const s = cm(ctx, 'SplyCur');
      return { lines: [{ name: 'Supply inflation %', target: 'pane', format: 'pct', points: s.slice(365).map((p, i) => ({ time: p.time, value: (p.value / s[i].value - 1) * 100 })) }] };
    } },
  { id: 's2f', group: 'cycle', name: 'Stock-to-Flow model (PlanB 2019)', grade: 'C', needs: ['cm'], desc: 'ln(market cap) = 3.3·ln(S2F) + 14.6. Model failed in 2021–22. Shown for reference.',
    build: (ctx) => {
      const s = cm(ctx, 'SplyCur');
      const pts = s.slice(365).map((p, i) => {
        const flow = p.value - s[i].value;
        const sf = p.value / flow;
        return { time: p.time, value: Math.exp(14.6) * Math.pow(sf, 3.3) / p.value };
      });
      return { lines: [{ name: 'S2F model price', target: 'price', points: pts, dashed: true }] };
    } },

  // ───────── Central bank money
  { id: 'qe', group: 'money', name: 'QE periods (money printing)', grade: 'A', color: '#30a46c', desc: 'Fed buying bonds = adding money. Includes "Not-QE" and RMP.',
    build: () => ({ zones: E.QE_ZONES }) },
  { id: 'qt', group: 'money', name: 'QT periods (money draining)', grade: 'A', color: '#e5484d', desc: 'Fed shrinking its balance sheet = removing money.',
    build: () => ({ zones: E.QT_ZONES }) },
  { id: 'taper', group: 'money', name: 'Taper periods', grade: 'B', color: '#f5d90a', desc: 'Fed slowing QE before stopping it.',
    build: () => ({ zones: E.TAPER_ZONES }) },
  { id: 'fed-balance', group: 'money', name: 'Fed balance sheet ($T)', grade: 'A', needs: ['fred:WALCL'], desc: 'FRED WALCL. Rising = QE, falling = QT.',
    build: (ctx) => ({ lines: [{ name: 'Fed balance sheet $T', target: 'overlay', format: 'num', points: fred(ctx, 'WALCL').map((p) => ({ time: p.time, value: p.value / 1e6 })) }] }) },
  { id: 'net-liquidity', group: 'money', name: 'Fed net liquidity ($T)', grade: 'A', needs: ['fred:WALCL', 'fred:WTREGEN', 'fred:RRPONTSYD'],
    desc: 'Balance sheet − Treasury account (TGA) − reverse repo. Tracks BTC closely since 2020.',
    build: (ctx) => {
      const w = fred(ctx, 'WALCL'), tga = fred(ctx, 'WTREGEN'), rrp = fred(ctx, 'RRPONTSYD');
      return { lines: [{ name: 'Net liquidity $T', target: 'overlay', format: 'num', points: w.map((p) => {
        const t = valueAt(tga, p.time)?.value ?? 0;
        const r = valueAt(rrp, p.time)?.value ?? 0;
        return { time: p.time, value: (p.value - t - r * 1000) / 1e6 };
      }) }] };
    } },
  { id: 'tga', group: 'money', name: 'Treasury General Account ($B)', grade: 'B', needs: ['fred:WTREGEN'], desc: 'Government cash at the Fed. Rising TGA drains liquidity.',
    build: (ctx) => ({ lines: [{ name: 'TGA $B', target: 'pane', format: 'num', points: fred(ctx, 'WTREGEN').map((p) => ({ time: p.time, value: p.value / 1000 })) }] }) },
  { id: 'rrp', group: 'money', name: 'Reverse repo ($B)', grade: 'B', needs: ['fred:RRPONTSYD'], desc: 'Cash parked at the Fed. Draining RRP adds liquidity.',
    build: (ctx) => ({ lines: [{ name: 'Reverse repo $B', target: 'pane', format: 'num', points: fred(ctx, 'RRPONTSYD') }] }) },
  { id: 'm2', group: 'money', name: 'US M2 money supply ($T)', grade: 'A', needs: ['fred:M2SL'], desc: 'FRED M2SL, monthly.',
    build: (ctx) => ({ lines: [{ name: 'US M2 $T', target: 'overlay', format: 'num', points: fred(ctx, 'M2SL').filter((p) => p.time >= '2009-01-01').map((p) => ({ time: p.time, value: p.value / 1000 })) }] }) },
  { id: 'm2-yoy', group: 'money', name: 'US M2 growth % (yearly)', grade: 'A', needs: ['fred:M2SL'], desc: 'Year-over-year change in M2. Negative in 2023 for the first time since the 1930s.',
    build: (ctx) => { const s = fred(ctx, 'M2SL'); return { lines: [{ name: 'M2 YoY %', target: 'pane', format: 'pct', levels: [0], points: s.slice(12).map((p, i) => ({ time: p.time, value: (p.value / s[i].value - 1) * 100 })).filter((p) => p.time >= '2009-01-01') }] }; } },

  // ───────── Interest rates
  { id: 'fed-rate', group: 'rates', name: 'Fed funds rate (upper target)', grade: 'A', needs: ['fred:DFEDTARU'], desc: 'FRED DFEDTARU.',
    build: (ctx) => ({ lines: [{ name: 'Fed funds upper %', target: 'pane', type: 'step', format: 'pct', points: fred(ctx, 'DFEDTARU') }] }) },
  { id: 'rate-hikes', group: 'rates', name: 'Rate hikes', grade: 'A', color: '#e5484d', needs: ['fred:DFEDTARU'], desc: 'Each Fed hike, from the rate data.',
    build: (ctx) => ({ events: rateMoves(ctx).filter((m) => m.dir === 'hike').map((m) => ({ d: m.d, label: `Hike +${(m.bp / 100).toFixed(2)}% → ${m.to.toFixed(2)}%` })) }) },
  { id: 'rate-cuts', group: 'rates', name: 'Rate cuts', grade: 'A', color: '#30a46c', needs: ['fred:DFEDTARU'], desc: 'Each Fed cut, from the rate data. Includes 2020 emergency cuts.',
    build: (ctx) => ({ events: rateMoves(ctx).filter((m) => m.dir === 'cut').map((m) => ({ d: m.d, label: `Cut ${(m.bp / 100).toFixed(2)}% → ${m.to.toFixed(2)}%` })) }) },
  { id: 'hiking-cycles', group: 'rates', name: 'Hiking cycles', grade: 'A', color: '#e5484d', needs: ['fred:DFEDTARU'], desc: 'First to last hike of each run.',
    build: (ctx) => ({ zones: moveRuns(rateMoves(ctx), 'hike') }) },
  { id: 'cutting-cycles', group: 'rates', name: 'Cutting cycles', grade: 'A', color: '#30a46c', needs: ['fred:DFEDTARU'], desc: 'First to last cut of each run.',
    build: (ctx) => ({ zones: moveRuns(rateMoves(ctx), 'cut') }) },
  { id: 'zirp', group: 'rates', name: 'Zero-rate eras', grade: 'B', needs: ['fred:DFEDTARU'], desc: 'Fed funds upper bound at 0.25% or below.',
    build: (ctx) => {
      const s = fred(ctx, 'DFEDTARU'); const zones = []; let z = null;
      for (const p of s) {
        if (p.value <= 0.25) { if (!z) { z = { from: p.time, to: p.time, label: 'Zero rates' }; zones.push(z); } else z.to = p.time; }
        else z = null;
      }
      return { zones };
    } },
  { id: 'fed-chairs', group: 'rates', name: 'Fed chair changes', grade: 'B', desc: 'Yellen 2014, Powell 2018, Warsh 2026.',
    build: () => ({ events: E.FED_CHAIRS }) },
  { id: 'real-yield', group: 'rates', name: '10Y real yield (TIPS)', grade: 'A', needs: ['fred:DFII10'], desc: 'Higher real yield is usually bad for BTC and gold.',
    build: (ctx) => ({ lines: [{ name: '10Y real yield %', target: 'pane', format: 'pct', levels: [0], points: fred(ctx, 'DFII10').filter((p) => p.time >= '2009-01-01') }] }) },
  { id: 'yield-curve', group: 'rates', name: 'Yield curve (10Y − 2Y)', grade: 'B', needs: ['fred:T10Y2Y'], desc: 'Below 0 = inverted. Historic recession warning.',
    build: (ctx) => ({ lines: [{ name: '10Y−2Y %', target: 'pane', format: 'pct', levels: [0], points: fred(ctx, 'T10Y2Y').filter((p) => p.time >= '2009-01-01') }] }) },

  // ───────── Politics
  { id: 'presidential', group: 'politics', name: 'Presidential elections', grade: 'B', color: '#4f8cff', desc: 'Line on election day. Shaded campaign year (Jan 1 → election).',
    build: () => ({ events: E.PRESIDENTIAL, zones: E.PRESIDENTIAL.map((e) => ({ from: e.d.slice(0, 4) + '-01-01', to: e.d, label: `Election year ${e.d.slice(0, 4)}` })) }) },
  { id: 'midterms', group: 'politics', name: 'Midterm elections', grade: 'B', color: '#ad7bff', desc: 'Line on election day. Shaded midterm year (Jan 1 → election). All 3 past midterms were near bear-market lows.',
    build: () => ({ events: E.MIDTERMS, zones: E.MIDTERMS.map((e) => ({ from: e.d.slice(0, 4) + '-01-01', to: e.d, label: `Midterm year ${e.d.slice(0, 4)}` })) }) },
  { id: 'inaugurations', group: 'politics', name: 'Inaugurations', grade: 'C', desc: 'New president sworn in (Jan 20).',
    build: () => ({ events: E.INAUGURATIONS }) },
  { id: 'pres-cycle', src: 'Calendar: 4-year US presidential term', group: 'politics', name: 'Presidential cycle years', grade: 'C', desc: 'Stock-market theory: Year 1 post-election, Year 2 midterm (weakest), Year 3 pre-election (strongest), Year 4 election.',
    build: () => ({ zones: yearZones(2010, NOW_YEAR + 2, (y) => {
      const k = ((y - 2009) % 4 + 4) % 4; // 2009 = year 1
      const names = ['Y1 post-election', 'Y2 midterm', 'Y3 pre-election', 'Y4 election'];
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: names[k], alt: k };
    }) }) },
  { id: 'shutdowns', group: 'politics', name: 'Government shutdowns', grade: 'C', desc: 'Federal funding lapses.',
    build: () => ({ zones: E.SHUTDOWNS }) },
  { id: 'downgrades', group: 'politics', name: 'US credit downgrades & debt ceiling', grade: 'C', desc: 'S&P 2011, Fitch 2023, Moody\'s 2025, 2023 debt-ceiling deal.',
    build: () => ({ events: E.CREDIT_DOWNGRADES }) },
  { id: 'policy', group: 'politics', name: 'Crypto policy & regulation', grade: 'B', desc: 'China bans, futures launches, ETF approval, Strategic Reserve, GENIUS Act.',
    build: () => ({ events: E.POLICY_EVENTS }) },

  // ───────── Macro
  { id: 'recessions', group: 'macro', name: 'US recessions (NBER)', grade: 'B', color: '#8e9196', needs: ['fred:USREC'], desc: 'Official recession months. Only one (2020) since BTC began.',
    build: (ctx) => {
      const s = fred(ctx, 'USREC'); const zones = []; let z = null;
      for (const p of s) {
        if (p.value === 1) { if (!z) { z = { from: p.time, to: p.time, label: 'Recession' }; zones.push(z); } else z.to = p.time; }
        else z = null;
      }
      zones.forEach((zz) => { const d = new Date(toMs(zz.to)); d.setUTCMonth(d.getUTCMonth() + 1); zz.to = addDays(d.toISOString().slice(0, 10), -1); });
      return { zones: zones.filter((zz) => zz.to >= '2007-01-01') };
    } },
  { id: 'dollar', group: 'macro', name: 'US dollar index (broad)', grade: 'A', needs: ['fred:DTWEXBGS'], desc: 'FRED broad trade-weighted dollar. Moves like DXY. Strong dollar usually = weak BTC.',
    build: (ctx) => ({ lines: [{ name: 'USD broad index', target: 'overlay', format: 'num', points: fred(ctx, 'DTWEXBGS').filter((p) => p.time >= '2009-01-01') }] }) },
  { id: 'nasdaq', group: 'macro', name: 'Nasdaq Composite', grade: 'A', needs: ['fred:NASDAQCOM'], desc: 'Tech stocks. BTC often trades like a tech stock.',
    build: (ctx) => ({ lines: [{ name: 'Nasdaq', target: 'overlay', format: 'num', log: true, points: fred(ctx, 'NASDAQCOM').filter((p) => p.time >= '2009-01-01') }] }) },
  { id: 'cpi', group: 'macro', name: 'CPI inflation % (yearly)', grade: 'B', needs: ['fred:CPIAUCSL'], desc: 'Consumer prices, year over year.',
    build: (ctx) => { const s = fred(ctx, 'CPIAUCSL'); return { lines: [{ name: 'CPI YoY %', target: 'pane', format: 'pct', levels: [2], points: s.slice(12).map((p, i) => ({ time: p.time, value: (p.value / s[i].value - 1) * 100 })).filter((p) => p.time >= '2009-01-01') }] }; } },
  { id: 'unemployment', group: 'macro', name: 'Unemployment rate', grade: 'B', needs: ['fred:UNRATE'], desc: 'Rising unemployment often leads to rate cuts.',
    build: (ctx) => ({ lines: [{ name: 'Unemployment %', target: 'pane', format: 'pct', points: fred(ctx, 'UNRATE').filter((p) => p.time >= '2009-01-01') }] }) },
  { id: 'vix', group: 'macro', name: 'VIX (stock fear index)', grade: 'B', needs: ['fred:VIXCLS'], desc: 'Spikes = panic in stocks.',
    build: (ctx) => ({ lines: [{ name: 'VIX', target: 'pane', format: 'num', levels: [20, 30], points: fred(ctx, 'VIXCLS').filter((p) => p.time >= '2009-01-01') }] }) },
  { id: 'hy-spread', group: 'macro', name: 'High-yield credit spread', grade: 'B', needs: ['fred:BAMLH0A0HYM2'], desc: 'Risk appetite. FRED only gives the last ~3 years free.',
    build: (ctx) => ({ lines: [{ name: 'HY spread %', target: 'pane', format: 'pct', points: fred(ctx, 'BAMLH0A0HYM2') }] }) },
  { id: 'macro-shocks', group: 'macro', name: 'Macro shocks', grade: 'B', desc: 'Cyprus, Greece, yuan devaluation, Brexit, COVID, SVB, yen carry crash.',
    build: () => ({ events: E.MACRO_SHOCKS }) },

  // ───────── Wars & geopolitics
  { id: 'wars', group: 'wars', name: 'Wars & conflicts (start → end)', grade: 'B', color: '#e5484d', desc: 'Shaded from start to end. Open-ended wars run to today.',
    build: () => ({ zones: E.WAR_ZONES }) },
  { id: 'war-events', group: 'wars', name: 'Geopolitical shock days', grade: 'B', desc: 'Invasions, strikes, attacks, tariff shocks.',
    build: () => ({ events: E.WAR_EVENTS }) },

  // ───────── Crypto news
  { id: 'crypto-news', group: 'news', name: 'Crypto crises & milestones', grade: 'B', desc: 'Mt. Gox, FTX, Terra, Celsius, hacks, Tesla, forks, record liquidations.',
    build: () => ({ events: E.CRYPTO_EVENTS }) },
  { id: 'ftx', group: 'news', name: 'FTX collapse', grade: 'B', color: '#e5484d', desc: 'Withdrawals halted 2022-11-08. Bankruptcy 2022-11-11. Cycle bottom 10 days later.',
    build: () => ({ events: E.CRYPTO_EVENTS.filter((e) => e.label.startsWith('FTX')) }) },
  { id: 'exchange-failures', group: 'news', name: 'Exchange failures & hacks', grade: 'B', desc: 'Mt. Gox, Bitfinex, Coincheck, FTX, Bybit.',
    build: () => ({ events: E.CRYPTO_EVENTS.filter((e) => /Gox|hack|FTX|Celsius|3AC/i.test(e.label)) }) },

  // ───────── Miners
  { id: 'hashrate', group: 'miners', name: 'Hash rate', grade: 'B', needs: ['cm'], desc: 'Total mining power (CoinMetrics). Follows price with a lag.',
    build: (ctx) => ({ lines: [{ name: 'Hash rate (TH/s)', target: 'overlay', log: true, format: 'num', points: cm(ctx, 'HashRate').filter((p) => p.value > 0) }] }) },
  { id: 'difficulty', group: 'miners', name: 'Mining difficulty', grade: 'B', needs: ['difficulty'], desc: 'Adjusts every 2,016 blocks (~2 weeks). blockchain.com.',
    build: (ctx) => ({ lines: [{ name: 'Difficulty', target: 'overlay', log: true, type: 'step', format: 'num', points: cols(ctx.get('difficulty')).filter((p) => p.value > 0) }] }) },
  { id: 'hash-ribbons', group: 'miners', name: 'Hash Ribbons', grade: 'B', needs: ['cm'], desc: '30-day vs 60-day hash rate average. Marker = 30d crosses back above 60d (miner capitulation over). Simplified version.',
    build: (ctx) => {
      const h = cm(ctx, 'HashRate'); const t = h.map((p) => p.time), v = h.map((p) => p.value);
      const a = sma(v, 30), b = sma(v, 60);
      return { lines: [
        { name: 'Hash 30d', target: 'pane', log: true, format: 'num', points: zip(t, a), color: '#30a46c' },
        { name: 'Hash 60d', target: 'pane', log: true, format: 'num', points: zip(t, b), color: '#e5484d' },
      ], events: crossings(t, a, b, 'Hash Ribbon recovery (buy signal)', null).filter((e) => e.d >= '2011-01-01') };
    } },
  { id: 'puell', group: 'miners', name: 'Puell Multiple', grade: 'B', needs: ['cm'], desc: 'Miner issuance USD ÷ its 365-day average. Below 0.5 = bottom zone, above 4 = top zone.',
    build: (ctx) => {
      const s = cm(ctx, 'IssTotUSD'); const a = sma(s.map((p) => p.value), 365);
      return { lines: [{ name: 'Puell', target: 'pane', log: true, format: 'num', levels: [0.5, 1, 4], points: zip(s.map((p) => p.time), s.map((p, i) => (a[i] ? p.value / a[i] : null))) }] };
    } },

  // ───────── On-chain
  { id: 'realized-price', group: 'onchain', name: 'Realized price', grade: 'A', needs: ['cm'], desc: 'Average price every coin last moved at. Market cap ÷ MVRV ÷ supply.',
    build: (ctx) => {
      const c = ctx.get('cm');
      return { lines: [{ name: 'Realized price', target: 'price', color: '#12a5b8', points: c.t.map((t, i) => {
        const mc = c.CapMrktCurUSD[i], m = c.CapMVRVCur[i], s = c.SplyCur[i];
        return mc && m && s ? { time: t, value: mc / m / s } : null;
      }).filter(Boolean) }] };
    } },
  { id: 'mvrv', group: 'onchain', name: 'MVRV ratio', grade: 'A', needs: ['cm'], desc: 'Market value ÷ realized value. Below 1 = bottom zone, above 3.7 = top zone (history).',
    build: (ctx) => ({ lines: [{ name: 'MVRV', target: 'pane', format: 'num', levels: [1, 3.7], points: cm(ctx, 'CapMVRVCur') }] }) },
  { id: 'mvrv-z', group: 'onchain', name: 'MVRV Z-Score', grade: 'A', needs: ['cm'], desc: '(Market cap − realized cap) ÷ std dev of market cap. Above 7 = top zone, below 0 = bottom zone. Did not reach 7 in 2025.',
    build: (ctx) => {
      const c = ctx.get('cm'); const pts = []; let n = 0, mean = 0, m2 = 0;
      for (let i = 0; i < c.t.length; i++) {
        const mc = c.CapMrktCurUSD[i], m = c.CapMVRVCur[i];
        if (!mc || !m) continue;
        n++; const d = mc - mean; mean += d / n; m2 += d * (mc - mean);
        if (n < 365) continue;
        pts.push({ time: c.t[i], value: (mc - mc / m) / Math.sqrt(m2 / (n - 1)) });
      }
      return { lines: [{ name: 'MVRV Z', target: 'pane', format: 'num', levels: [0, 7], points: pts }] };
    } },
  { id: 'nupl', group: 'onchain', name: 'NUPL (net unrealized profit/loss)', grade: 'A', needs: ['cm'], desc: '1 − 1/MVRV. Below 0 = capitulation, above 0.75 = euphoria.',
    build: (ctx) => ({ lines: [{ name: 'NUPL', target: 'pane', format: 'num', levels: [0, 0.25, 0.5, 0.75], points: cm(ctx, 'CapMVRVCur').map((p) => ({ time: p.time, value: 1 - 1 / p.value })) }] }) },
  { id: 'active-addresses', group: 'onchain', name: 'Active addresses', grade: 'B', needs: ['cm'], desc: 'Daily active addresses (CoinMetrics), 7-day average.',
    build: (ctx) => { const s = cm(ctx, 'AdrActCnt'); return { lines: [{ name: 'Active addresses 7d', target: 'pane', log: true, format: 'num', points: zip(s.map((p) => p.time), sma(s.map((p) => p.value), 7)) }] }; } },
  { id: 'tx-count', group: 'onchain', name: 'Transactions per day', grade: 'C', needs: ['cm'], desc: 'On-chain transactions, 7-day average.',
    build: (ctx) => { const s = cm(ctx, 'TxCnt'); return { lines: [{ name: 'Tx/day 7d', target: 'pane', log: true, format: 'num', points: zip(s.map((p) => p.time), sma(s.map((p) => p.value), 7)) }] }; } },
  { id: 'stablecoins', group: 'onchain', name: 'Stablecoin supply ($B)', grade: 'A', needs: ['stablecoins'], desc: 'Total USD stablecoins (DefiLlama). "Dry powder" to buy crypto.',
    build: (ctx) => ({ lines: [{ name: 'Stablecoins $B', target: 'overlay', format: 'num', points: cols(ctx.get('stablecoins')).map((p) => ({ time: p.time, value: p.value / 1e9 })) }] }) },

  // ───────── Price models
  { id: 'ma200w', group: 'models', name: '200-week moving average', grade: 'A', color: '#ad7bff', desc: 'Historic bear-market floor.',
    build: (ctx) => ({ lines: [{ name: '200W SMA', target: 'price', width: 2, points: weeklyIndicator(ctx.bars, (c) => sma(c, 200)) }] }) },
  { id: 'bmsb', group: 'models', name: 'Bull market support band', grade: 'A', desc: '20-week SMA + 21-week EMA. Bull markets hold above it.',
    build: (ctx) => ({ lines: [
      { name: '20W SMA', target: 'price', color: '#30a46c', points: weeklyIndicator(ctx.bars, (c) => sma(c, 20)) },
      { name: '21W EMA', target: 'price', color: '#7ee787', points: weeklyIndicator(ctx.bars, (c) => ema(c, 21)) },
    ] }) },
  { id: 'pi-cycle', group: 'models', name: 'Pi Cycle Top', grade: 'B', desc: '111-day SMA crosses above 2× 350-day SMA = cycle top signal. Hit 2013, 2017, 2021. Not 2025.',
    build: (ctx) => {
      const t = times(ctx), c = closes(ctx); const a = sma(c, 111), b = sma(c, 350).map((v) => (v == null ? null : v * 2));
      return { lines: [
        { name: '111D SMA', target: 'price', color: '#f5d90a', points: zip(t, a) },
        { name: '350D SMA ×2', target: 'price', color: '#e5484d', points: zip(t, b) },
      ], events: crossings(t, a, b, 'Pi Cycle top signal', null) };
    } },
  { id: 'ma2y', group: 'models', name: '2-year MA multiplier', grade: 'B', desc: '2-year SMA (buy zone below) and 5× 2-year SMA (sell zone above).',
    build: (ctx) => { const t = times(ctx), a = sma(closes(ctx), 730); return { lines: [
      { name: '2Y SMA', target: 'price', color: '#30a46c', points: zip(t, a) },
      { name: '2Y SMA ×5', target: 'price', color: '#e5484d', points: zip(t, a.map((v) => (v == null ? null : v * 5))) },
    ] }; } },
  { id: 'golden-ratio', group: 'models', name: 'Golden Ratio Multiplier', grade: 'B', desc: '350-day SMA × 1.6, 2, 3.',
    build: (ctx) => { const t = times(ctx), a = sma(closes(ctx), 350); const m = (k) => zip(t, a.map((v) => (v == null ? null : v * k)));
      return { lines: [
        { name: '350D SMA', target: 'price', color: '#8e9196', points: m(1) },
        { name: '350D ×1.6', target: 'price', color: '#30a46c', points: m(1.6) },
        { name: '350D ×2', target: 'price', color: '#f5d90a', points: m(2) },
        { name: '350D ×3', target: 'price', color: '#e5484d', points: m(3) },
      ] }; } },
  { id: 'ma50-200', group: 'models', name: '50 / 200-day MA (golden & death cross)', grade: 'B', desc: 'Markers on each golden cross and death cross.',
    build: (ctx) => { const t = times(ctx), c = closes(ctx); const a = sma(c, 50), b = sma(c, 200);
      return { lines: [
        { name: '50D SMA', target: 'price', color: '#4f8cff', points: zip(t, a) },
        { name: '200D SMA', target: 'price', color: '#ff6b2c', points: zip(t, b) },
      ], events: crossings(t, a, b, 'Golden cross', 'Death cross') }; } },
  { id: 'mayer', group: 'models', name: 'Mayer Multiple', grade: 'B', desc: 'Price ÷ 200-day SMA. Below 0.8 cheap, above 2.4 hot.',
    build: (ctx) => { const t = times(ctx), c = closes(ctx), a = sma(c, 200); return { lines: [{ name: 'Mayer', target: 'pane', format: 'num', levels: [0.8, 1, 2.4], points: zip(t, c.map((v, i) => (a[i] ? v / a[i] : null))) }] }; } },
  { id: 'power-law', group: 'models', name: 'Power law (fitted)', grade: 'B', desc: 'log(price) vs log(days since genesis), fitted to this chart\'s own data. Bands = 1st and 99th percentile.',
    build: (ctx) => {
      const f = powerLawFit(ctx.bars);
      const end = addDays(ctx.bars[ctx.bars.length - 1].t, 0);
      const pts = (off) => ctx.bars.filter((b, i) => i % 3 === 0 || b.t === end).map((b) => ({ time: b.t, value: Math.pow(10, f.at(b.t) + off) }));
      return { lines: [
        { name: 'Power law fit', target: 'price', color: '#8e9196', dashed: true, points: pts(0) },
        { name: 'Power law floor', target: 'price', color: '#30a46c', points: pts(f.lo) },
        { name: 'Power law ceiling', target: 'price', color: '#e5484d', points: pts(f.hi) },
      ], info: `Fit: log10(P) = ${f.a.toFixed(3)} + ${f.b.toFixed(3)}·log10(days)` };
    } },
  { id: 'rsi-weekly', group: 'models', name: 'Weekly RSI (14)', grade: 'B', desc: 'Above 70 overbought, below 30 oversold.',
    build: (ctx) => ({ lines: [{ name: 'Weekly RSI', target: 'pane', format: 'num', levels: [30, 70], points: weeklyIndicator(ctx.bars, (c) => rsi(c, 14)) }] }) },
  { id: 'rsi-daily', group: 'models', name: 'Daily RSI (14)', grade: 'B', desc: 'Above 70 overbought, below 30 oversold.',
    build: (ctx) => ({ lines: [{ name: 'Daily RSI', target: 'pane', format: 'num', levels: [30, 70], points: zip(times(ctx), rsi(closes(ctx), 14)) }] }) },
  { id: 'volatility', group: 'models', name: 'Realized volatility (30d)', grade: 'B', desc: 'Yearly-scaled 30-day volatility. Low vol often comes before a big move.',
    build: (ctx) => {
      const c = closes(ctx); const r = c.map((v, i) => (i ? Math.log(v / c[i - 1]) : null));
      const out = r.map((_, i) => { if (i < 31) return null; const w = r.slice(i - 29, i + 1); const m = w.reduce((a, b) => a + b, 0) / 30; return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 29) * Math.sqrt(365) * 100; });
      return { lines: [{ name: 'Vol 30d %', target: 'pane', format: 'pct', points: zip(times(ctx), out) }] };
    } },
  { id: 'volume', group: 'models', name: 'Volume (Bitstamp)', grade: 'B', desc: 'Bitstamp BTC volume. Only one exchange, so a sample, not the whole market.',
    build: (ctx) => ({ lines: [{ name: 'Volume BTC', target: 'pane', type: 'histogram', format: 'num', agg: 'sum', points: ctx.bars.filter((b) => b.v > 0).map((b) => ({ time: b.t, value: b.v })) }] }) },

  // ───────── Flows
  { id: 'etf-era', src: 'Hand-curated date', group: 'flows', name: 'Spot ETF era', grade: 'A', color: '#4f8cff', desc: 'US spot BTC ETFs trading since 2024-01-11.',
    build: () => ({ zones: [{ from: '2024-01-11', to: null, label: 'Spot ETF era' }], events: [{ d: '2024-01-11', label: 'Spot ETFs start trading' }] }) },
  { id: 'corporate', group: 'flows', name: 'Corporate & government buyers', grade: 'B', desc: 'MicroStrategy, Tesla, El Salvador, US Strategic Reserve.',
    build: () => ({ events: [...E.CRYPTO_EVENTS, ...E.POLICY_EVENTS].filter((e) => /MicroStrategy|Tesla|El Salvador|Strategic/i.test(e.label)).sort((a, b) => (a.d < b.d ? -1 : 1)) }) },
  { id: 'supply-overhang', group: 'flows', name: 'Big sellers (Mt. Gox, governments)', grade: 'B', desc: 'German government sales and Mt. Gox repayments in 2024.',
    build: () => ({ zones: E.SUPPLY_SHOCK_ZONES, events: E.CRYPTO_EVENTS.filter((e) => /repayments/i.test(e.label)) }) },

  // ───────── Derivatives
  { id: 'liquidations', group: 'deriv', name: 'Big liquidation crashes', grade: 'B', desc: 'Days when leverage got wiped out.',
    build: () => ({ events: [...E.CRYPTO_EVENTS, ...E.MACRO_SHOCKS].filter((e) => /COVID crash|May 19|liquidation|Yen carry|hash war/i.test(e.label)).sort((a, b) => (a.d < b.d ? -1 : 1)) }) },
  { id: 'opex-q', src: 'Computed: last Friday of Mar/Jun/Sep/Dec', group: 'deriv', name: 'Quarterly options expiry', grade: 'B', desc: 'Last Friday of Mar/Jun/Sep/Dec (Deribit, 08:00 UTC). From 2017.',
    build: () => ({ events: yearZones(2017, NOW_YEAR + 1, (y) => y).flatMap((y) => [3, 6, 9, 12].map((m) => ({ d: lastFriday(y, m), label: `Quarterly expiry ${y}-${String(m).padStart(2, '0')}` }))) }) },
  { id: 'opex-m', src: 'Computed: last Friday of each month', group: 'deriv', name: 'Monthly options expiry', grade: 'C', desc: 'Last Friday of every month (Deribit). From 2017.',
    build: () => ({ events: yearZones(2017, NOW_YEAR + 1, (y) => y).flatMap((y) => Array.from({ length: 12 }, (_, i) => ({ d: lastFriday(y, i + 1), label: `Monthly expiry ${y}-${String(i + 1).padStart(2, '0')}` }))) }) },
  { id: 'cme-launch', group: 'deriv', name: 'Futures & leverage milestones', grade: 'B', desc: 'CBOE/CME futures, first futures ETF.',
    build: () => ({ events: E.POLICY_EVENTS.filter((e) => /futures/i.test(e.label)) }) },

  // ───────── Sentiment & structure
  { id: 'fear-greed', group: 'sentiment', name: 'Fear & Greed Index (alternative.me)', grade: 'B', needs: ['feargreed'], desc: 'Source: Alternative.me Crypto Fear & Greed Index (alternative.me), from Feb 2018. Below 25 extreme fear, above 75 extreme greed.',
    build: (ctx) => ({ lines: [{ name: 'Fear & Greed · Source: alternative.me', target: 'pane', format: 'num', levels: [25, 50, 75], points: cols(ctx.get('feargreed')) }] }) },
  { id: 'eth-btc', group: 'sentiment', name: 'ETH/BTC ratio', grade: 'B', needs: ['ethbtc'], desc: 'Bitstamp, from Aug 2017. Rising = altcoin risk appetite.',
    build: (ctx) => ({ lines: [{ name: 'ETH/BTC', target: 'pane', format: 'num', points: cols(ctx.get('ethbtc')) }] }) },

  // ───────── Seasonality
  { id: 'septembers', src: 'Calendar', group: 'season', name: 'Every September', grade: 'C', color: '#e5484d', desc: 'Historically weak month.',
    build: () => ({ zones: yearZones(2010, NOW_YEAR, (y) => ({ from: `${y}-09-01`, to: `${y}-09-30`, label: `Sep ${y}` })) }) },
  { id: 'octobers', src: 'Calendar', group: 'season', name: 'Every October ("Uptober")', grade: 'C', color: '#30a46c', desc: 'Historically strong month.',
    build: () => ({ zones: yearZones(2010, NOW_YEAR, (y) => ({ from: `${y}-10-01`, to: `${y}-10-31`, label: `Oct ${y}` })) }) },
  { id: 'q4', src: 'Calendar', group: 'season', name: 'Every Q4', grade: 'C', desc: 'Oct–Dec.',
    build: () => ({ zones: yearZones(2010, NOW_YEAR, (y) => ({ from: `${y}-10-01`, to: `${y}-12-31`, label: `Q4 ${y}` })) }) },
  { id: 'weekends', src: 'Calendar', group: 'season', name: 'Weekends', grade: 'C', desc: 'Thin liquidity. Best on the daily chart.',
    build: (ctx) => ({ zones: ctx.bars.filter((b) => new Date(toMs(b.t)).getUTCDay() === 6).map((b) => ({ from: b.t, to: addDays(b.t, 1), label: 'Weekend' })) }) },
  { id: 'tax-day', src: 'Calendar', group: 'season', name: 'US tax day (Apr 15)', grade: 'C', desc: 'Tax selling folklore.',
    build: () => ({ events: yearZones(2011, NOW_YEAR + 1, (y) => ({ d: `${y}-04-15`, label: `Tax day ${y}` })) }) },
  { id: 'quarter-ends', src: 'Calendar', group: 'season', name: 'Quarter ends', grade: 'C', desc: 'Fund rebalancing dates.',
    build: () => ({ events: yearZones(2011, NOW_YEAR, (y) => y).flatMap((y) => ['03-31', '06-30', '09-30', '12-31'].map((md) => ({ d: `${y}-${md}`, label: `Quarter end ${y}-${md.slice(0, 2)}` }))) }) },

  // ───────── Long waves & folklore
  { id: 'benner', src: 'Samuel Benner 1875 cycle card', group: 'waves', name: 'Benner cycle (1875 card)', grade: 'C', desc: 'Folklore: panic years, good times (sell), hard times (buy). For curiosity only.',
    build: () => ({ events: [
      ...E.BENNER.panic.map((y) => ({ d: `${y}-01-01`, label: `Benner: panic year ${y}` })),
      ...E.BENNER.goodSell.map((y) => ({ d: `${y}-01-01`, label: `Benner: good times / sell ${y}` })),
      ...E.BENNER.hardBuy.map((y) => ({ d: `${y}-01-01`, label: `Benner: hard times / buy ${y}` })),
    ].filter((e) => e.d >= '2010-01-01').sort((a, b) => (a.d < b.d ? -1 : 1)) }) },
  { id: 'full-moons', src: 'Computed: mean lunar cycle from a known new moon (±1 day)', group: 'waves', name: 'Full moons', grade: 'C', desc: 'Fringe. No solid proof of any effect. ±1 day accuracy.',
    build: () => ({ events: moonDates('2010-07-01', addDays(today(), 400), 0.5).map((d) => ({ d, label: 'Full moon' })) }) },
  { id: 'new-moons', src: 'Computed: mean lunar cycle from a known new moon (±1 day)', group: 'waves', name: 'New moons', grade: 'C', desc: 'Fringe. No solid proof of any effect. ±1 day accuracy.',
    build: () => ({ events: moonDates('2010-07-01', addDays(today(), 400), 0).map((d) => ({ d, label: 'New moon' })) }) },
];

for (const it of ITEMS) { it.color = it.color || nextColor(); it.needs = it.needs || []; }

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Data key -> URL under /data
export const dataUrl = (key) => (key.startsWith('fred:') ? `/data/fred/${key.slice(5)}.json` : key === 'cm' ? '/data/coinmetrics.json' : `/data/${key}.json`);

// Instances used by the Compare table: events if the item has them, else zones.
export function compareInstances(built) {
  if (built.events?.length) return built.events.map((e) => ({ d: e.d, label: e.label }));
  if (built.zones?.length) return built.zones.map((z) => ({ from: z.from, to: z.to || today(), label: z.label }));
  return [];
}
