#!/usr/bin/env node
// Claude's remote control for the open chart tab.
//
//   node bin/chart.mjs list [search]          list overlay ids
//   node bin/chart.mjs state                  what the chart shows right now
//   node bin/chart.mjs on <id...>             turn overlays on
//   node bin/chart.mjs off <id...>            turn overlays off
//   node bin/chart.mjs only <id...>           show only these overlays
//   node bin/chart.mjs clear                  turn all overlays off
//   node bin/chart.mjs range <from> [to]      zoom to dates (YYYY-MM-DD)
//   node bin/chart.mjs fit                    show all history
//   node bin/chart.mjs tf <D|W|M>             timeframe
//   node bin/chart.mjs log <on|off>           log price scale
//   node bin/chart.mjs window <days>          before/after shading
//   node bin/chart.mjs compare <id>           open that item in the Compare table
//   node bin/chart.mjs note "<title>" "<text>" show an answer card on the chart
//   node bin/chart.mjs mark <date> "<label>" [color]
//   node bin/chart.mjs box <from> <to> "<label>" [color] [top] [bottom]
//   node bin/chart.mjs clear-notes            remove marks, boxes and the note
//   node bin/chart.mjs snap                   save screenshot to screenshots/latest.png
//   node bin/chart.mjs stats <id> [days]      BTC % before/during/after each instance (no browser needed)
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://127.0.0.1:${process.env.PORT || 5178}`;
const { ITEMS, ITEM_BY_ID, GROUPS, dataUrl, compareInstances } = await import(path.join(ROOT, 'public/js/catalog.js'));
const { compareStats } = await import(path.join(ROOT, 'public/js/calc.js'));

const { isDay } = await import(path.join(ROOT, 'public/js/calc.js'));
const [cmd, ...args] = process.argv.slice(2);
const needDay = (...ds) => { for (const d of ds) if (d != null && !isDay(d)) { console.error(`Bad date "${d}". Use YYYY-MM-DD.`); process.exit(1); } };
const hex = (c) => { if (c && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) { console.error(`Color must be hex like #e5484d, got "${c}".`); process.exit(1); } return c; };

async function send(msg) {
  let res;
  try {
    res = await fetch(BASE + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  } catch {
    console.error(`Chart server not running. Start it: npm start (in ${ROOT})`);
    process.exit(2);
  }
  const j = await res.json();
  if (!res.ok) { console.error(j.error || res.status); process.exit(3); }
  console.log(`sent ${msg.cmd} → ${j.delivered} tab(s)`);
}

function checkIds(ids) {
  const bad = ids.filter((id) => !ITEM_BY_ID[id]);
  if (bad.length) { console.error(`Unknown id(s): ${bad.join(', ')}. Run: node bin/chart.mjs list`); process.exit(1); }
  return ids;
}

const loadCtx = () => {
  const bars = JSON.parse(readFileSync(path.join(ROOT, 'data/btc.json'), 'utf8'));
  const cache = {};
  return { bars, get: (k) => (cache[k] ??= JSON.parse(readFileSync(path.join(ROOT, dataUrl(k)), 'utf8'))) };
};
const pct = (v) => (v == null ? '   —   ' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`.padStart(7));

switch (cmd) {
  case 'list': {
    const q = (args.join(' ') || '').toLowerCase();
    for (const g of GROUPS) {
      const items = ITEMS.filter((i) => i.group === g.id && (!q || `${i.id} ${i.name} ${i.desc}`.toLowerCase().includes(q)));
      if (!items.length) continue;
      console.log(`\n${g.name}`);
      for (const i of items) console.log(`  ${i.id.padEnd(20)} [${i.grade}] ${i.name}`);
    }
    break;
  }
  case 'state': {
    try { console.log(JSON.stringify(await (await fetch(BASE + '/api/state')).json(), null, 2)); }
    catch { console.error('Chart server not running.'); process.exit(2); }
    break;
  }
  case 'on': case 'off': case 'only': await send({ cmd, ids: checkIds(args) }); break;
  case 'compare': await send({ cmd, ids: checkIds(args.slice(0, 1)) }); break;
  case 'clear': case 'fit': await send({ cmd }); break;
  case 'clear-notes': await send({ cmd: 'clear-annotations' }); break;
  case 'range': needDay(args[0], args[1]); await send({ cmd, from: args[0], to: args[1] }); break;
  case 'tf': await send({ cmd, tf: (args[0] || 'D').toUpperCase() }); break;
  case 'log': await send({ cmd, on: args[0] !== 'off' }); break;
  case 'window': await send({ cmd, days: Number(args[0]) }); break;
  case 'note': await send({ cmd, title: args.length > 1 ? args[0] : 'Claude', text: args.length > 1 ? args.slice(1).join(' ') : args[0] }); break;
  case 'mark': needDay(args[0]); await send({ cmd, d: args[0], label: args[1], color: hex(args[2]) }); break;
  case 'box': needDay(args[0], args[1]); await send({ cmd, from: args[0], to: args[1], label: args[2], color: hex(args[3]), top: args[4] ? Number(args[4]) : undefined, bottom: args[5] ? Number(args[5]) : undefined }); break;
  case 'snap': {
    const file = path.join(ROOT, 'screenshots/latest.png');
    let before = 0; try { before = statSync(file).mtimeMs; } catch { /* first snap */ }
    await send({ cmd: 'snap' });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { if (statSync(file).mtimeMs > before) { console.log(file); process.exit(0); } } catch { /* not yet */ }
    }
    console.error('No screenshot arrived (is the tab visible?).'); process.exit(4);
  }
  case 'stats': {
    const id = checkIds([args[0]])[0];
    const days = Number(args[1] || 180);
    const ctx = loadCtx();
    const built = ITEM_BY_ID[id].build(ctx);
    const st = compareStats(ctx.bars, compareInstances(built), days);
    console.log(`${ITEM_BY_ID[id].name} — BTC % change, window ${days} days`);
    console.log('date(s)                  before  during   after  BTC at start  label');
    for (const r of st.rows) {
      const dates = (r.start + (r.end !== r.start ? '→' + r.end : '')).padEnd(23);
      const price = r.future ? 'future' : r.price == null ? '—' : '$' + r.price.toFixed(r.price < 10 ? 2 : 0);
      console.log(`${dates} ${pct(r.before)} ${pct(r.during)} ${pct(r.after)}  ${price.padStart(11)}  ${r.label}${r.ongoing ? ' (still running)' : ''}`);
    }
    console.log('(future and still-running rows are left out of average/median)');
    console.log(`${'average'.padEnd(23)} ${pct(st.avg.before)} ${pct(st.avg.during)} ${pct(st.avg.after)}`);
    console.log(`${'median'.padEnd(23)} ${pct(st.med.before)} ${pct(st.med.during)} ${pct(st.med.after)}`);
    break;
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//   ')).map((l) => l.slice(5)).join('\n'));
}
